import type {
  AiSource,
  AuditFinding,
  CandidateSnippet,
  Consensus,
  DualAiMeta,
  SourceAuditReport,
  Severity,
  VulnerabilityCategory,
} from "@/types/security";
import { CHAIN_ID_TO_NAME, getContractSource, normalizeSourceCode } from "./etherscan";
import { tripleInvoke, tripleExtractJson, maxSeverity } from "./dual-llm";
import { createHash } from "crypto";

const cache = new Map<string, { report: SourceAuditReport; expiresAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

const MAX_CANDIDATES = 24;
const MIN_CONFIDENCE = 0.7;
const CONTEXT_LINES = 3;

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

/**
 * Peek at the audit cache without triggering a fresh audit. Returns the report
 * if a non-expired entry exists, null otherwise. Used by the protocol-analysis
 * pipeline to surface ground-truth audit data when a recent audit happens to
 * be cached.
 */
export function peekCachedAudit(
  chainId: number,
  contractAddress: string
): SourceAuditReport | null {
  const hit = cache.get(cacheKey(chainId, contractAddress));
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.report;
}

/* ==================== PATTERN EXTRACTION ==================== */
// We refuse to let the LLM hunt free-form. It can only evaluate snippets we
// surface here. Every pattern is a *candidate* — a region worth a closer look,
// not a declared vulnerability. Claude's job is to confirm or reject each one
// with evidence.

interface PatternDef {
  category: VulnerabilityCategory;
  regex: RegExp;
  reason: string;
}

const PATTERNS: PatternDef[] = [
  {
    category: "selfdestruct_risk",
    regex: /\bselfdestruct\s*\(/g,
    reason: "selfdestruct can permanently delete the contract",
  },
  {
    category: "delegatecall_risk",
    regex: /\.delegatecall\s*\(/g,
    reason: "delegatecall executes arbitrary code in this contract's context",
  },
  {
    category: "unchecked_call",
    regex: /\.call\s*\{[^}]*\}\s*\(|\.call\s*\(\s*[^)]*\)/g,
    reason: "low-level .call without checked return value may swallow failures",
  },
  {
    category: "owner_privilege",
    regex: /\b(onlyOwner|onlyAdmin|onlyRole\s*\(|onlyGovernance|onlyMinter)\b/g,
    reason: "privileged modifier — owner can invoke this restricted function",
  },
  {
    category: "unbounded_mint",
    regex: /function\s+\w*[Mm]int\w*\s*\([^)]*\)[^{]*\{/g,
    reason: "mint function — verify supply cap and authorization",
  },
  {
    category: "upgrade_proxy",
    regex: /\b(upgradeTo|upgradeToAndCall|_setImplementation|initialize)\s*\(/g,
    reason: "upgradeable proxy mechanism — implementation can change",
  },
  {
    category: "access_control",
    regex: /\b(transferOwnership|renounceOwnership|_transferOwnership)\s*\(/g,
    reason: "ownership transfer path",
  },
  {
    category: "unlimited_approval",
    regex: /type\s*\(\s*uint256\s*\)\s*\.\s*max|2\s*\*\*\s*256\s*-\s*1|0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff/gi,
    reason: "unlimited approval / uint256 max literal",
  },
  {
    category: "reentrancy",
    regex: /\.call\s*\{\s*value\s*:/g,
    reason: "external ETH transfer via .call — reentrancy candidate",
  },
  {
    category: "flash_loan_exposure",
    regex: /\b(flashLoan|flashloan|executeOperation|onFlashLoan)\s*\(/g,
    reason: "flash loan callback surface",
  },
  {
    category: "oracle_dependency",
    regex: /\b(getPrice|latestAnswer|latestRoundData|consult|getReserves)\s*\(/g,
    reason: "external price/reserve read — verify manipulation resistance",
  },
];

function computeLineIndex(source: string): number[] {
  const idx: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") idx.push(i + 1);
  }
  return idx;
}

function offsetToLine(offsets: number[], offset: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (offsets[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function extractSnippet(
  source: string,
  lines: string[],
  startLine: number,
  endLine: number
): { code: string; actualStart: number; actualEnd: number } {
  void source;
  const actualStart = Math.max(1, startLine - CONTEXT_LINES);
  const actualEnd = Math.min(lines.length, endLine + CONTEXT_LINES);
  const code = lines.slice(actualStart - 1, actualEnd).join("\n");
  return { code, actualStart, actualEnd };
}

function extractCandidates(source: string): CandidateSnippet[] {
  const offsets = computeLineIndex(source);
  const lines = source.split("\n");
  const seen = new Set<string>();
  const candidates: CandidateSnippet[] = [];

  for (const pat of PATTERNS) {
    pat.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pat.regex.exec(source)) !== null) {
      const line = offsetToLine(offsets, match.index);
      const snippet = extractSnippet(source, lines, line, line);
      const dedupe = `${pat.category}:${snippet.actualStart}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      candidates.push({
        id: createHash("sha1")
          .update(`${pat.category}:${snippet.actualStart}:${snippet.code.slice(0, 40)}`)
          .digest("hex")
          .slice(0, 10),
        category: pat.category,
        startLine: snippet.actualStart,
        endLine: snippet.actualEnd,
        code: snippet.code,
        reason: pat.reason,
      });
      if (candidates.length >= MAX_CANDIDATES) break;
    }
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  return candidates;
}

/* ==================== PROMPT + EVALUATION ==================== */

const AUDIT_SYSTEM = `You are a Solidity security reviewer evaluating a fixed list of candidate snippets.

HARD RULES — violations invalidate the response:
1. Evaluate ONLY the snippets provided. Do not invent new findings.
2. For each candidate, decide confirm OR reject. Always return the ID.
3. "codeSnippet" field MUST be copied verbatim from the provided snippet (whitespace included). If you cannot reproduce it exactly, reject the candidate.
4. If the candidate is benign (properly guarded, standard OpenZeppelin, safe math, checked return), REJECT it with reason.
5. "confidence" is your certainty the vulnerability is real AND exploitable, on [0,1]. Use <0.7 if you are not sure — those will be filtered out.
6. Do not use words like "may", "might", "could potentially" — you must be specific or reject.
7. "description" must reference code elements by name (function, modifier, variable) from the snippet, not generic language.
8. "severity": critical (direct loss of funds possible), high (loss likely under realistic scenario), medium (risk under specific conditions), low (hygiene), info (non-issue but worth noting).

Output: ONLY a JSON object.
{
  "findings": [
    {
      "id": "<candidate id>",
      "status": "confirmed" | "rejected",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "title": "<short>",
      "description": "<specific, references code elements>",
      "codeSnippet": "<verbatim copy from the candidate>",
      "startLine": <int>,
      "endLine": <int>,
      "confidence": <0..1>,
      "recommendation": "<concrete fix>"
    }
  ]
}`;

interface ModelFinding {
  id: string;
  status: "confirmed" | "rejected";
  severity: Severity;
  title: string;
  description: string;
  codeSnippet: string;
  startLine: number;
  endLine: number;
  confidence: number;
  recommendation: string;
}

function buildAuditPrompt(candidates: CandidateSnippet[], contractName: string): string {
  const candidateText = candidates
    .map(
      (c) =>
        `--- CANDIDATE ${c.id} ---
category: ${c.category}
lines: ${c.startLine}-${c.endLine}
pattern reason: ${c.reason}
code:
${c.code}
`
    )
    .join("\n");

  return `${AUDIT_SYSTEM}

Contract: ${contractName}

Evaluate these ${candidates.length} candidate snippets. Respond with findings for EACH by id.

${candidateText}

Return ONLY the JSON object.`;
}

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Verify a Claude-returned snippet actually exists verbatim (modulo whitespace)
 * within the candidate's source region. This is the hallucination guard:
 * anything Claude invents fails this check and gets rejected.
 */
function verifySnippet(claimed: string, candidateCode: string): boolean {
  if (!claimed || claimed.length < 5) return false;
  const normClaimed = normalizeForCompare(claimed);
  const normCandidate = normalizeForCompare(candidateCode);
  if (normCandidate.includes(normClaimed)) return true;
  // allow partial overlap for multi-line constructs
  const claimedLines = claimed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (claimedLines.length === 0) return false;
  const matchingLines = claimedLines.filter((line) =>
    candidateCode.includes(line)
  );
  return matchingLines.length / claimedLines.length >= 0.7;
}

interface ConfirmedFinding {
  source: AiSource;
  finding: ModelFinding;
}

/**
 * Per-source reconciliation: filter raw model findings down to verified, high-
 * confidence confirmations. Returns confirmed (with source label) and rejected count.
 */
function reconcilePerSource(
  source: AiSource,
  candidates: CandidateSnippet[],
  modelFindings: ModelFinding[]
): { confirmed: ConfirmedFinding[]; rejected: number } {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const confirmed: ConfirmedFinding[] = [];
  let rejected = 0;

  for (const mf of modelFindings) {
    if (mf.status !== "confirmed") {
      rejected++;
      continue;
    }
    const cand = byId.get(mf.id);
    if (!cand || mf.confidence < MIN_CONFIDENCE) {
      rejected++;
      continue;
    }
    if (!verifySnippet(mf.codeSnippet, cand.code)) {
      rejected++;
      continue;
    }
    confirmed.push({ source, finding: mf });
  }

  return { confirmed, rejected };
}

/**
 * Pick the entry with the longest text (usually the most specific).
 * Ignores undefined entries.
 */
function pickLongest<T extends ModelFinding | undefined>(entries: T[], field: "title" | "description" | "recommendation"): string {
  let best = "";
  for (const e of entries) {
    if (!e) continue;
    const v = e[field];
    if (typeof v === "string" && v.length > best.length) best = v;
  }
  return best;
}

/**
 * Merge confirmations from all three AIs into a single AuditFinding[] keyed by
 * candidate id. Consensus buckets:
 * - all-three: flagged by Claude, Codex, and Gemini
 * - two-of-three: any two AIs agreed
 * - one-only: only one AI flagged it
 * Confidence boost scales with agreement count.
 */
function mergeTripleFindings(
  candidates: CandidateSnippet[],
  claudeConfirmed: ConfirmedFinding[],
  codexConfirmed: ConfirmedFinding[],
  geminiConfirmed: ConfirmedFinding[]
): { findings: AuditFinding[]; allThreeConfirmed: number; twoOfThreeConfirmed: number; oneOnly: number } {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const claudeMap = new Map(claudeConfirmed.map((c) => [c.finding.id, c.finding]));
  const codexMap = new Map(codexConfirmed.map((c) => [c.finding.id, c.finding]));
  const geminiMap = new Map(geminiConfirmed.map((c) => [c.finding.id, c.finding]));
  const allIds = new Set<string>([...claudeMap.keys(), ...codexMap.keys(), ...geminiMap.keys()]);

  const findings: AuditFinding[] = [];
  let allThreeConfirmed = 0;
  let twoOfThreeConfirmed = 0;
  let oneOnly = 0;

  for (const id of allIds) {
    const cand = byId.get(id);
    if (!cand) continue;
    const cl = claudeMap.get(id);
    const cx = codexMap.get(id);
    const gm = geminiMap.get(id);

    const confirmedBy: AiSource[] = [];
    if (cl) confirmedBy.push("claude");
    if (cx) confirmedBy.push("codex");
    if (gm) confirmedBy.push("gemini");

    let consensus: Consensus;
    if (confirmedBy.length === 3) {
      consensus = "all-three";
      allThreeConfirmed++;
    } else if (confirmedBy.length === 2) {
      consensus = "two-of-three";
      twoOfThreeConfirmed++;
    } else {
      consensus = "one-only";
      oneOnly++;
    }

    const present = [cl, cx, gm].filter(Boolean) as ModelFinding[];
    const severity = present
      .map((p) => p.severity)
      .reduce((best, s) => maxSeverity(best, s), present[0].severity);
    const title = pickLongest([cl, cx, gm], "title").slice(0, 140);
    const description = pickLongest([cl, cx, gm], "description").slice(0, 600);
    const recommendation = pickLongest([cl, cx, gm], "recommendation").slice(0, 400);

    // Average confidence across AIs that flagged it, plus consensus boost
    const avgConfidence =
      present.reduce((sum, p) => sum + p.confidence, 0) / present.length;
    // Boost: 0 for 1/3, +0.1 for 2/3, +0.2 for 3/3
    const consensusBoost = (confirmedBy.length - 1) * 0.1;
    const confidence = Math.max(0, Math.min(1, avgConfidence + consensusBoost));

    findings.push({
      id: cand.id,
      category: cand.category,
      severity,
      title,
      description,
      startLine: cand.startLine,
      endLine: cand.endLine,
      codeSnippet: cand.code,
      confidence,
      verified: true,
      recommendation,
      consensus,
      confirmedBy,
      claudeConfidence: cl?.confidence,
      codexConfidence: cx?.confidence,
      geminiConfidence: gm?.confidence,
    });
  }

  const consensusRank = (c: Consensus | undefined): number => {
    if (c === "all-three") return 3;
    if (c === "two-of-three") return 2;
    return 1;
  };

  findings.sort((a, b) => {
    // Highest consensus first, then severity, then confidence
    const cRank = consensusRank(b.consensus) - consensusRank(a.consensus);
    if (cRank !== 0) return cRank;
    const rank: Record<Severity, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1,
    };
    const sevDiff = rank[b.severity] - rank[a.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  return { findings, allThreeConfirmed, twoOfThreeConfirmed, oneOnly };
}

function scoreFromFindings(findings: AuditFinding[]): {
  score: number;
  verdict: "clean" | "review" | "dangerous";
} {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "critical") score -= 35;
    else if (f.severity === "high") score -= 18;
    else if (f.severity === "medium") score -= 8;
    else if (f.severity === "low") score -= 3;
  }
  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 80 ? "clean" : score >= 50 ? "review" : "dangerous";
  return { score, verdict };
}

/* ==================== ENTRY POINT ==================== */

export async function auditContract(
  chainId: number,
  contractAddress: string
): Promise<SourceAuditReport> {
  const key = cacheKey(chainId, contractAddress);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.report;

  const src = await getContractSource(chainId, contractAddress);
  if (!src) {
    throw new Error(
      `Source code not verified on Etherscan for ${contractAddress} (chain ${chainId}). An unverified contract cannot be safely audited — treat it as high-risk.`
    );
  }

  const { combined } = normalizeSourceCode(src.SourceCode);
  const linesOfCode = combined.split("\n").length;
  const candidates = extractCandidates(combined);

  if (candidates.length === 0) {
    const report: SourceAuditReport = {
      contractAddress: contractAddress.toLowerCase(),
      chainId,
      chainName: CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`,
      contractName: src.ContractName || "Unknown",
      compilerVersion: src.CompilerVersion || "Unknown",
      isVerified: true,
      linesOfCode,
      candidatesScanned: 0,
      findings: [],
      overallScore: 95,
      overallVerdict: "clean",
      analyzedAt: new Date().toISOString(),
      rejectedFindings: 0,
    };
    cache.set(key, { report, expiresAt: Date.now() + CACHE_TTL });
    return report;
  }

  const prompt = buildAuditPrompt(candidates, src.ContractName || "Unknown");

  // Run Claude Opus 4.7 (max), Codex GPT-5.5 (xhigh), and Gemini 3.1 Pro in
  // parallel. Any one failing does not abort the others; partial results still
  // produce a valid report, with consensus bucketing downweighting one-only flags.
  const raw = await tripleInvoke(prompt, { timeoutMs: 360_000 });
  const parsed = tripleExtractJson<{ findings: ModelFinding[] }>(raw);

  if (!parsed.claude && !parsed.codex && !parsed.gemini) {
    const detail = parsed.errors.map((e) => `${e.source}: ${e.error}`).join(" | ");
    throw new Error(`Triple AI audit failed: all models unavailable (${detail})`);
  }

  const claudeFindings = Array.isArray(parsed.claude?.findings) ? parsed.claude!.findings : [];
  const codexFindings = Array.isArray(parsed.codex?.findings) ? parsed.codex!.findings : [];
  const geminiFindings = Array.isArray(parsed.gemini?.findings) ? parsed.gemini!.findings : [];

  const { confirmed: claudeConfirmed, rejected: claudeRejected } = reconcilePerSource(
    "claude",
    candidates,
    claudeFindings
  );
  const { confirmed: codexConfirmed, rejected: codexRejected } = reconcilePerSource(
    "codex",
    candidates,
    codexFindings
  );
  const { confirmed: geminiConfirmed, rejected: geminiRejected } = reconcilePerSource(
    "gemini",
    candidates,
    geminiFindings
  );

  const { findings, allThreeConfirmed, twoOfThreeConfirmed, oneOnly } = mergeTripleFindings(
    candidates,
    claudeConfirmed,
    codexConfirmed,
    geminiConfirmed
  );

  const { score, verdict } = scoreFromFindings(findings);

  const dualAi: DualAiMeta = {
    claudeOk: parsed.claude !== null,
    codexOk: parsed.codex !== null,
    geminiOk: parsed.gemini !== null,
    allThreeConfirmed,
    twoOfThreeConfirmed,
    oneOnly,
    errors: parsed.errors,
  };

  const report: SourceAuditReport = {
    contractAddress: contractAddress.toLowerCase(),
    chainId,
    chainName: CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`,
    contractName: src.ContractName || "Unknown",
    compilerVersion: src.CompilerVersion || "Unknown",
    isVerified: true,
    linesOfCode,
    candidatesScanned: candidates.length,
    findings,
    overallScore: score,
    overallVerdict: verdict,
    analyzedAt: new Date().toISOString(),
    rejectedFindings: claudeRejected + codexRejected + geminiRejected,
    dualAi,
  };

  cache.set(key, { report, expiresAt: Date.now() + CACHE_TTL });
  return report;
}
