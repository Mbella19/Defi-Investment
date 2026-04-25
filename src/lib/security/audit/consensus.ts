import { createHash } from "crypto";
import type {
  AuditCategory,
  AuditConfidence,
  AuditSeverity,
  ConsensusFinding,
  ToolFinding,
  ToolName,
} from "@/types/audit";

/**
 * Consensus scorer
 * ----------------
 * Multiple analysis tools (Slither, Aderyn, Mythril, on-chain interrogator,
 * regex patterns) often surface the same underlying issue. Without
 * deduplication you'd show users 4 copies of "reentrancy in withdraw()".
 *
 * Strategy: group findings by *bucket key* (category + file + nearby line +
 * function-or-contract name when known). When ≥2 tools agree, escalate
 * confidence; this is the strongest signal we have outside formal
 * verification because the tools have completely different implementations.
 */

const SEVERITY_RANK: Record<AuditSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const CONFIDENCE_RANK: Record<AuditConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
  confirmed: 3,
};

const LINE_BUCKET_SIZE = 10;

/** Group findings into consensus clusters. */
export function buildConsensus(toolFindings: ToolFinding[]): ConsensusFinding[] {
  const buckets = new Map<string, ToolFinding[]>();

  for (const f of toolFindings) {
    const key = bucketKey(f);
    const arr = buckets.get(key);
    if (arr) arr.push(f);
    else buckets.set(key, [f]);
  }

  const consensus: ConsensusFinding[] = [];
  for (const findings of buckets.values()) {
    consensus.push(mergeBucket(findings));
  }

  // Sort by severity desc, then by tool agreement desc
  consensus.sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) return sev;
    return b.toolsAgreed.length - a.toolsAgreed.length;
  });

  return consensus;
}

/** Bucket key — what counts as "the same issue". */
function bucketKey(f: ToolFinding): string {
  const file = f.filePath ? normalizePath(f.filePath) : "";
  const lineBucket = f.startLine !== undefined ? Math.floor(f.startLine / LINE_BUCKET_SIZE) : "";
  const fnOrContract = (f.function ?? f.contract ?? "").toLowerCase();
  return `${f.category}::${file}::${lineBucket}::${fnOrContract}`;
}

function normalizePath(p: string): string {
  // Strip common workspace prefixes so /tmp/sov-audit-abc/contracts/X.sol
  // and contracts/X.sol bucket together.
  return p
    .replace(/^.*\/sov-audit-[a-zA-Z0-9]+\//, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

/** Merge a bucket of findings into one ConsensusFinding. */
function mergeBucket(findings: ToolFinding[]): ConsensusFinding {
  // Pick the "canonical" finding — highest severity × highest confidence.
  const canonical = [...findings].sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) return sev;
    return CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
  })[0];

  const toolsAgreed = uniq(findings.map((f) => f.tool));

  // Severity: take max across all tools (critical wins).
  const severity = findings.reduce<AuditSeverity>(
    (max, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[max] ? f.severity : max),
    "info"
  );

  // Confidence: max base confidence, then escalate if multiple distinct tools agree.
  const baseConfidence = findings.reduce<AuditConfidence>(
    (max, f) => (CONFIDENCE_RANK[f.confidence] > CONFIDENCE_RANK[max] ? f.confidence : max),
    "low"
  );
  const confidence = escalateConfidence(baseConfidence, toolsAgreed);

  // Description: prefer the longest non-empty one, since tool descriptions
  // vary in detail and the longest is usually the most informative.
  const description = pickBestDescription(findings) ?? canonical.description;

  // Code snippet: prefer the canonical's; fall back to any finding that has one.
  const codeSnippet = canonical.codeSnippet ?? findings.find((f) => f.codeSnippet)?.codeSnippet;

  const id = createHash("sha1")
    .update(`consensus|${canonical.category}|${canonical.filePath ?? ""}|${canonical.startLine ?? 0}|${canonical.function ?? canonical.contract ?? ""}`)
    .digest("hex")
    .slice(0, 16);

  return {
    id,
    category: canonical.category,
    severity,
    confidence,
    title: canonical.title,
    description,
    filePath: canonical.filePath,
    startLine: canonical.startLine,
    endLine: canonical.endLine,
    codeSnippet,
    contract: canonical.contract,
    function: canonical.function,
    toolsAgreed,
    sourceFindingIds: findings.map((f) => f.id),
  };
}

function escalateConfidence(base: AuditConfidence, tools: ToolName[]): AuditConfidence {
  // Cross-engine agreement is a strong signal: two completely independent
  // analyzers flagging the same bug is much harder to dismiss than one.
  // We bump up by one level per additional independent tool, capped at
  // "confirmed". The on-chain interrogator findings are pre-graded
  // "high"/"confirmed" because they read live state, not source.
  const nondegenerate = tools.filter((t) => t !== "ai_explainer");
  if (nondegenerate.length >= 3) return "confirmed";
  if (nondegenerate.length === 2 && CONFIDENCE_RANK[base] >= CONFIDENCE_RANK.medium) return "confirmed";
  if (nondegenerate.length === 2) return "high";
  return base;
}

function pickBestDescription(findings: ToolFinding[]): string | undefined {
  const candidates = findings
    .map((f) => f.description?.trim())
    .filter((d): d is string => !!d && d.length > 30);
  if (candidates.length === 0) return undefined;
  return candidates.sort((a, b) => b.length - a.length)[0];
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/* ==================== AGGREGATE RISK SCORE ==================== */

export interface RiskAggregate {
  riskScore: number; // 0-100
  verdict: "clean" | "review" | "dangerous" | "critical";
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

const SEVERITY_WEIGHT: Record<AuditSeverity, number> = {
  critical: 30,
  high: 12,
  medium: 4,
  low: 1,
  info: 0,
};

const CONFIDENCE_MULTIPLIER: Record<AuditConfidence, number> = {
  confirmed: 1.0,
  high: 0.85,
  medium: 0.55,
  low: 0.25,
};

/**
 * Compute a 0-100 risk score from consensus findings. Higher = more risk.
 * Critical confirmed findings dominate; low-confidence info findings barely
 * register. Hard floors: any confirmed critical → 90+; any confirmed high → 65+.
 */
export function aggregateRisk(findings: ConsensusFinding[]): RiskAggregate {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let raw = 0;

  for (const f of findings) {
    counts[f.severity]++;
    raw += SEVERITY_WEIGHT[f.severity] * CONFIDENCE_MULTIPLIER[f.confidence];
  }

  // Sigmoid-style cap: 100 * (1 - e^(-raw/40)) — diminishing returns past ~150.
  let score = Math.round(100 * (1 - Math.exp(-raw / 40)));

  // Apply floors so consensus findings can't be diluted by bulk info-noise.
  const confirmedCritical = findings.filter((f) => f.severity === "critical" && f.confidence === "confirmed").length;
  const confirmedHigh = findings.filter((f) => f.severity === "high" && f.confidence === "confirmed").length;
  if (confirmedCritical > 0) score = Math.max(score, 90);
  else if (confirmedHigh > 0) score = Math.max(score, 65);
  else if (counts.high > 0) score = Math.max(score, 45);
  else if (counts.medium >= 3) score = Math.max(score, 30);

  score = Math.min(100, Math.max(0, score));

  let verdict: RiskAggregate["verdict"];
  if (score >= 80 || confirmedCritical > 0) verdict = "critical";
  else if (score >= 55) verdict = "dangerous";
  else if (score >= 25) verdict = "review";
  else verdict = "clean";

  return { riskScore: score, verdict, counts };
}
