import {
  tripleInvoke,
  tripleExtractJson,
  type AiSource,
} from "../dual-llm";
import type {
  AiExplanation,
  AuditSeverity,
  ConsensusFinding,
} from "@/types/audit";

/**
 * AI explainer
 * ------------
 * The triple-AI ensemble (Claude Opus 4.7, Codex GPT-5.5 xhigh, Gemini 3.1 Pro
 * Preview) is demoted from "find vulnerabilities" to "explain tool-grounded
 * findings". This is a deliberate constraint: the analyzers (Slither, Aderyn,
 * Mythril, on-chain interrogator) ground every finding in real source or live
 * state, so the AIs cannot hallucinate issues — only enrich what the tools
 * already detected.
 *
 * For each finding, all three AIs produce: whatHappened, whyItMatters,
 * exploitScenario, recommendedFix, finalSeverity. Disagreement is recorded
 * as `aiConsensus` ∈ {all, majority, split, single} so users can see which
 * findings are safe to act on vs. which need a human eye.
 */

const PER_FINDING_TIMEOUT_MS = 180_000;
const FINDING_BATCH_SIZE = 4;

const SEVERITY_RANK: Record<AuditSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

interface AiExplanationRaw {
  whatHappened?: string;
  whyItMatters?: string;
  exploitScenario?: string;
  recommendedFix?: string;
  finalSeverity?: string;
  isReal?: boolean;
  notes?: string;
}

/**
 * Explain each consensus finding via all three AIs in parallel. Returns the
 * findings array enriched with `aiExplanation`. Findings without an
 * explanation (all three AIs failed) are returned unchanged.
 */
export async function explainFindings(
  findings: ConsensusFinding[],
  onProgress?: (done: number, total: number) => void
): Promise<ConsensusFinding[]> {
  if (findings.length === 0) return findings;

  // Cap explanations to the top 25 findings by severity*confidence — past
  // that, the marginal value of an AI explanation drops sharply and we'd
  // burn 60s+ per finding for "info" code-quality nits.
  const ranked = [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      b.toolsAgreed.length - a.toolsAgreed.length
  );
  const toExplain = ranked.slice(0, 25);
  const explained = new Map<string, AiExplanation>();

  // Process in small batches — three CLI subprocesses per finding × N
  // parallel = lots of concurrent processes if unbounded.
  for (let i = 0; i < toExplain.length; i += FINDING_BATCH_SIZE) {
    const batch = toExplain.slice(i, i + FINDING_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map(explainOne));
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j];
      if (r.status === "fulfilled" && r.value) {
        explained.set(batch[j].id, r.value);
      }
    }
    onProgress?.(Math.min(i + batch.length, toExplain.length), toExplain.length);
  }

  return findings.map((f) => {
    const exp = explained.get(f.id);
    return exp ? { ...f, aiExplanation: exp } : f;
  });
}

async function explainOne(finding: ConsensusFinding): Promise<AiExplanation | null> {
  const prompt = buildPrompt(finding);
  const raw = await tripleInvoke(prompt, { timeoutMs: PER_FINDING_TIMEOUT_MS });
  const { claude, codex, gemini, errors } = tripleExtractJson<AiExplanationRaw>(raw);

  const reviewedBy: AiSource[] = [];
  const explanations: { source: AiSource; data: AiExplanationRaw }[] = [];
  if (claude) {
    reviewedBy.push("claude");
    explanations.push({ source: "claude", data: claude });
  }
  if (codex) {
    reviewedBy.push("codex");
    explanations.push({ source: "codex", data: codex });
  }
  if (gemini) {
    reviewedBy.push("gemini");
    explanations.push({ source: "gemini", data: gemini });
  }

  if (explanations.length === 0) {
    return null;
  }

  // Consensus on whether the finding is real
  const realVotes = explanations.filter((e) => e.data.isReal !== false).length;
  const totalVotes = explanations.length;
  let aiConsensus: AiExplanation["aiConsensus"];
  if (totalVotes === 1) aiConsensus = "single";
  else if (realVotes === totalVotes) aiConsensus = "all";
  else if (realVotes > totalVotes / 2) aiConsensus = "majority";
  else aiConsensus = "split";

  // Pick the most detailed explanation as the canonical text.
  const canonical = explanations.reduce((best, cur) => {
    const lenCur =
      (cur.data.whatHappened?.length ?? 0) +
      (cur.data.whyItMatters?.length ?? 0) +
      (cur.data.recommendedFix?.length ?? 0);
    const lenBest =
      (best.data.whatHappened?.length ?? 0) +
      (best.data.whyItMatters?.length ?? 0) +
      (best.data.recommendedFix?.length ?? 0);
    return lenCur > lenBest ? cur : best;
  });

  // Final severity: max across AIs, but never escalate past "high" unless
  // all three agree (prevents one model alone from raising to critical).
  const reportedSeverities = explanations
    .map((e) => normalizeSeverity(e.data.finalSeverity))
    .filter((s): s is AuditSeverity => !!s);
  let finalSeverity: AuditSeverity = finding.severity;
  if (reportedSeverities.length > 0) {
    const maxAi = reportedSeverities.reduce((max, s) =>
      SEVERITY_RANK[s] > SEVERITY_RANK[max] ? s : max
    );
    if (
      SEVERITY_RANK[maxAi] > SEVERITY_RANK[finalSeverity] &&
      (SEVERITY_RANK[maxAi] <= SEVERITY_RANK.high || aiConsensus === "all")
    ) {
      finalSeverity = maxAi;
    }
  }

  const notesParts: string[] = [];
  if (errors.length > 0) {
    notesParts.push(`AI failures: ${errors.map((e) => `${e.source}: ${e.error.slice(0, 80)}`).join("; ")}`);
  }
  if (aiConsensus === "split") {
    notesParts.push("AI panel disagreed on whether this finding is exploitable in practice — manual review recommended.");
  }

  return {
    whatHappened: (canonical.data.whatHappened ?? finding.description).trim().slice(0, 1_500),
    whyItMatters: (canonical.data.whyItMatters ?? "").trim().slice(0, 1_500),
    exploitScenario: canonical.data.exploitScenario?.trim().slice(0, 1_500),
    recommendedFix: (canonical.data.recommendedFix ?? "Apply the standard mitigation for this category.").trim().slice(0, 1_500),
    finalSeverity,
    reviewedBy,
    aiConsensus,
    notes: notesParts.length > 0 ? notesParts.join(" | ") : undefined,
  };
}

function normalizeSeverity(s: string | undefined): AuditSeverity | null {
  if (!s) return null;
  const k = s.toLowerCase().trim();
  if (k === "critical" || k === "high" || k === "medium" || k === "low" || k === "info" || k === "informational") {
    return k === "informational" ? "info" : (k as AuditSeverity);
  }
  return null;
}

function buildPrompt(finding: ConsensusFinding): string {
  const codeBlock = finding.codeSnippet
    ? `\n\n=== CODE SNIPPET ===\n${finding.filePath ? `File: ${finding.filePath}${finding.startLine ? `:${finding.startLine}` : ""}\n` : ""}\`\`\`solidity\n${finding.codeSnippet}\n\`\`\``
    : "";

  return `You are a senior smart-contract security auditor. The static-analysis pipeline (Slither, Aderyn, Mythril, on-chain interrogator) has flagged a finding. Your job is to *explain* it for the end user — NOT to invent new findings.

**Critical rules:**
1. You must NOT add new vulnerabilities or speculate about issues outside the flagged finding.
2. If, after reviewing the evidence, you believe this is a false positive or a non-issue, set "isReal": false in your response and explain why in "notes".
3. Be concrete. Reference the actual code shown when explaining.
4. Recommend a specific code-level fix, not generic advice.

=== FINDING (from tools) ===
- Category: ${finding.category}
- Tool-reported severity: ${finding.severity}
- Confidence: ${finding.confidence}
- Tools that agreed: ${finding.toolsAgreed.join(", ")}
- Title: ${finding.title}
- Description from tools: ${finding.description}
${finding.contract ? `- Contract: ${finding.contract}` : ""}
${finding.function ? `- Function: ${finding.function}` : ""}
${codeBlock}

Respond with JSON only — no markdown fences, no commentary outside the JSON object. Schema:

{
  "isReal": true,
  "whatHappened": "1-3 sentence plain-English explanation of what's wrong, referencing the code.",
  "whyItMatters": "1-3 sentences on impact: who can exploit this, what they can take, what breaks.",
  "exploitScenario": "Concrete step-by-step exploit walkthrough (3-6 sentences). Skip if the issue is not exploitable.",
  "recommendedFix": "Specific code-level fix — the exact Solidity change or pattern to apply. Reference OZ libraries, CEI pattern, etc. by name.",
  "finalSeverity": "critical | high | medium | low | info — your reassessment of severity given the actual exploitability.",
  "notes": "Optional: anything the user should know that doesn't fit above (e.g., 'only exploitable if X', 'partially mitigated by Y')."
}`;
}
