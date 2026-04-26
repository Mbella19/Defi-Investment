import type { DefiLlamaPool, DefiLlamaProtocol } from "@/types/pool";
import type {
  StrategyCriteria,
  StrategyAllocation,
  InvestmentStrategy,
  CollaborationTrail,
  CritiquePoint,
  CritiqueCategory,
  CritiqueSeverity,
  ReviewerSource,
  ReviewerVerdict,
} from "@/types/strategy";
import type { ProtocolAnalysis } from "@/types/analysis";
import { fetchProtocols } from "./defillama";
import { fetchAllEnrichedPools } from "./pool-aggregator";
import { analyzeProtocol } from "./anthropic";
import { formatCurrency } from "./formatters";
import { getPoolStability, passesStabilityGate, type PoolStability } from "./pool-stability";
import { invokeCodex } from "./security/codex-client";
import { invokeGemini } from "./security/gemini-client";
import { extractJson, invokeClaude } from "./security/claude-client";
import type { JobStage } from "./strategy-jobs";

export interface StrategyProgressEvent {
  stage: JobStage;
  message: string;
  sub?: { done: number; total: number };
}

export interface GenerateStrategyOptions {
  onProgress?: (event: StrategyProgressEvent) => void;
}

interface ProtocolSummary {
  name: string;
  slug: string;
  category: string;
  tvl: number;
  chains: string[];
  audits: string;
  description: string;
  marketCap?: number;
  priceChange24h?: number;
  pools: {
    symbol: string;
    chain: string;
    apy: number;
    tvl: number;
    stablecoin: boolean;
    poolId: string;
    source?: string;
    autoCompound?: boolean;
    securityScore?: number;
    securityFlags?: string;
    apyPct7D?: number | null;
    apyPct30D?: number | null;
    stability?: PoolStability | null;
  }[];
  analysis?: ProtocolAnalysis;
}

function buildProtocolSummaries(
  pools: DefiLlamaPool[],
  protocols: DefiLlamaProtocol[],
  stabilityByPool?: Map<string, PoolStability | null>,
): ProtocolSummary[] {
  const protocolMap = new Map<string, DefiLlamaProtocol>();
  for (const p of protocols) {
    protocolMap.set(p.slug, p);
  }

  const grouped = new Map<string, DefiLlamaPool[]>();
  for (const pool of pools) {
    const existing = grouped.get(pool.project) || [];
    existing.push(pool);
    grouped.set(pool.project, existing);
  }

  const summaries: ProtocolSummary[] = [];
  for (const [slug, protocolPools] of grouped) {
    const proto = protocolMap.get(slug);
    const topPools = protocolPools
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, 5);

    summaries.push({
      name: proto?.name || slug,
      slug,
      category: proto?.category || "Unknown",
      tvl: proto?.tvl || 0,
      chains: proto?.chains || [...new Set(protocolPools.map((p) => p.chain))],
      audits: proto?.audits || "0",
      description: proto?.description || "",
      marketCap: proto?.mcap || undefined,
      pools: topPools.map((p) => ({
        symbol: p.symbol,
        chain: p.chain,
        apy: p.apy || 0,
        tvl: p.tvlUsd || 0,
        stablecoin: p.stablecoin,
        poolId: p.pool,
        source: p.source,
        autoCompound: p.autoCompound,
        securityScore: p.securityData?.securityScore,
        securityFlags: p.securityData?.flags?.join("; "),
        apyPct7D: p.apyPct7D,
        apyPct30D: p.apyPct30D,
        stability: stabilityByPool?.get(p.pool) ?? null,
      })),
    });
  }

  return summaries.sort((a, b) => b.tvl - a.tvl);
}

async function deepAnalyzeProtocols(
  summaries: ProtocolSummary[],
  qualifying: DefiLlamaPool[],
  allProtocols: DefiLlamaProtocol[],
  onProgress?: (done: number, total: number) => void
): Promise<ProtocolSummary[]> {
  const protocolMap = new Map<string, DefiLlamaProtocol>();
  for (const p of allProtocols) {
    protocolMap.set(p.slug, p);
  }

  const poolsByProject = new Map<string, DefiLlamaPool[]>();
  for (const pool of qualifying) {
    const existing = poolsByProject.get(pool.project) || [];
    existing.push(pool);
    poolsByProject.set(pool.project, existing);
  }

  // Run all deep analyses fully in parallel. With 3 AI subprocesses per
  // protocol this is heavy, but batching in serial chunks pushed total wall
  // time past the browser's tolerance for a synchronous request. Each
  // protocol's completion bumps the shared counter so progress streams in.
  const total = summaries.length;
  let completed = 0;
  onProgress?.(0, total);

  await Promise.allSettled(
    summaries.map(async (summary) => {
      const proto = protocolMap.get(summary.slug);
      if (!proto) {
        completed += 1;
        onProgress?.(completed, total);
        return;
      }
      const pools = poolsByProject.get(summary.slug) || [];
      try {
        const analysis = await analyzeProtocol(proto, pools);
        summary.analysis = analysis;
      } catch (err) {
        console.error(`Deep analysis failed for ${summary.slug}:`, err);
      } finally {
        completed += 1;
        onProgress?.(completed, total);
      }
    })
  );

  return summaries;
}

function buildStrategyPrompt(
  criteria: StrategyCriteria,
  summaries: ProtocolSummary[],
  totalPoolsScanned: number
): string {
  const protocolDataLines = summaries.map((s) => {
    const poolLines = s.pools
      .map((p) => {
        const fmtPct = (v: number | null | undefined) =>
          v == null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
        let line = `    ${p.symbol} | ${p.chain} | APY:${p.apy.toFixed(2)}% | 7dΔ:${fmtPct(p.apyPct7D)} | 30dΔ:${fmtPct(p.apyPct30D)} | TVL:${formatCurrency(p.tvl)} | Stable:${p.stablecoin ? "Y" : "N"} | ID:${p.poolId}`;
        if (p.stability) {
          line += ` | Hist:${p.stability.monthsOfHistory.toFixed(1)}mo | 12mAvg:${p.stability.apyMean12m.toFixed(2)}% | 6mCoV:${p.stability.coefficientOfVariation6m.toFixed(2)} | 12mCoV:${p.stability.coefficientOfVariation12m.toFixed(2)} | 24mCoV:${p.stability.coefficientOfVariation24m.toFixed(2)} | maxDD:${p.stability.worstDrawdown.toFixed(1)}pp`;
        }
        if (p.source === "beefy") line += ` | Source:AutoCompounder | AutoCompound:Y`;
        else if (p.autoCompound) line += ` | AutoCompoundVault:Available`;
        return line;
      })
      .join("\n");

    // Include deep analysis data if available
    let analysisLine = "";
    if (s.analysis) {
      const a = s.analysis;
      analysisLine = `\n  AI SAFETY ANALYSIS:
    Legitimacy Score: ${a.legitimacyScore}/100 | Verdict: ${a.overallVerdict}
    Summary: ${a.summary}
    Audit Score: ${a.sections.auditHistory.score}/100 | Team Score: ${a.sections.teamReputation.score}/100 | TVL Score: ${a.sections.tvlAnalysis.score}/100 | Smart Contract Score: ${a.sections.smartContractRisk.score}/100 | Maturity Score: ${a.sections.protocolMaturity.score}/100
    Red Flags: ${a.redFlags.length > 0 ? a.redFlags.join("; ") : "None"}
    Positive Signals: ${a.positiveSignals.join("; ")}`;
    }

    // Include GoPlus security data if available from any pool
    let securityLine = "";
    const poolWithSecurity = s.pools.find((p) => p.securityScore !== undefined);
    if (poolWithSecurity && poolWithSecurity.securityScore !== undefined) {
      securityLine = `\n  CONTRACT SECURITY: Score ${poolWithSecurity.securityScore}/100 | Flags: ${poolWithSecurity.securityFlags || "None"}`;
    }

    // Include market data if available
    let marketLine = "";
    if (s.marketCap) {
      marketLine = `\n  MARKET DATA: MCap: ${formatCurrency(s.marketCap)}${s.priceChange24h !== undefined ? ` | 24h: ${s.priceChange24h > 0 ? "+" : ""}${s.priceChange24h.toFixed(2)}%` : ""}`;
    }

    return `${s.name} (${s.category}) | TVL:${formatCurrency(s.tvl)} | Audits:${s.audits} | Chains:${s.chains.join(",")}
  ${s.description.slice(0, 120)}${analysisLine}${securityLine}${marketLine}
  Top pools:\n${poolLines}`;
  }).join("\n\n");

  const volatilityGuidance =
    criteria.riskAppetite === "low"
      ? `APY STABILITY (low-risk user): All pools below have ≥12 months history and 12mCoV ≤ 0.6 (CoV = stdev/mean — lower is steadier). Within that surviving set, STRONGLY prefer the steadier end of the range: lower 12mCoV (target <0.4), |7dΔ| < 10%, |30dΔ| < 25%. When 24mCoV is available it's a stronger signal than 12mCoV — use it. Pools with maxDD > 10pp deserve heavy scrutiny even if they passed the gate.`
      : criteria.riskAppetite === "medium"
      ? `APY STABILITY (balanced user): All pools below have ≥6 months history and 6mCoV ≤ 0.8 (CoV = stdev/mean — lower is steadier). Within that surviving set, prefer lower 6mCoV (target <0.5), |7dΔ| < 25%, |30dΔ| < 60%. When 12mCoV/24mCoV are also available they reinforce the signal — use them. Pools at the upper end of the CoV range can appear at small weights only with strong justification.`
      : `APY STABILITY (high-risk user): Multi-year history was NOT required. Note any swings in reasoning but volatility alone is not a disqualifier.`;
  return `You are an expert DeFi investment strategist with deep security knowledge. A user needs a complete investment strategy.
IMPORTANT: Each protocol below has been through AI deep security analysis. USE the legitimacy scores, verdicts, and red flags to make your allocation decisions. Do NOT allocate to protocols with "caution" verdict unless the user has "high" risk appetite. Favor "high_confidence" protocols heavily.

${volatilityGuidance}

Each pool line includes 7dΔ and 30dΔ — the percent change in APY over the trailing 7 and 30 days. Treat these as volatility/stability signals, NOT as forecasts.

USER PARAMETERS:
- Budget: $${criteria.budget.toLocaleString()}
- Risk appetite: ${criteria.riskAppetite}
- Target APY range: ${criteria.targetApyMin}% - ${criteria.targetApyMax}%

I scanned ${totalPoolsScanned} yield pools across DeFi and ran deep AI security analysis on all ${summaries.length} qualifying protocols. Here is the complete data:

${protocolDataLines}

Create a detailed investment strategy. Return ONLY a JSON object with this structure:
{
  "summary": "<2-3 paragraph strategy overview explaining the approach and how safety analysis influenced decisions>",
  "projectedApy": <weighted average APY number>,
  "projectedYearlyReturn": <dollar amount>,
  "riskAssessment": "<paragraph on overall portfolio risk, referencing legitimacy scores>",
  "allocations": [
    {
      "protocol": "<protocol name>",
      "chain": "<chain>",
      "symbol": "<pool symbol>",
      "poolId": "<pool ID from data above>",
      "apy": <number>,
      "tvl": <number>,
      "stablecoin": <boolean>,
      "allocationAmount": <dollar amount to invest>,
      "allocationPercent": <percentage of budget>,
      "reasoning": "<why this specific pool, referencing the safety analysis>",
      "legitimacyScore": <the protocol's legitimacy score from the analysis>,
      "verdict": "<the protocol's verdict from the analysis>",
      "redFlags": ["<any red flags from the analysis for this protocol>"]
    }
  ],
  "diversificationNotes": "<explain how the portfolio is diversified across protocols, chains, and asset types>",
  "warnings": ["<risk warning 1>", "<risk warning 2>"],
  "steps": ["<step 1: what to do first>", "<step 2>", "<step 3>"]
}

RULES:
- Allocations MUST sum to exactly $${criteria.budget.toLocaleString()}
- Choose the pool count that GENUINELY fits this strategy — not a default. There is no required range. Decide based on conviction, budget, and risk:
  • If a few protocols are clearly best-in-class for the user's risk profile, concentrate (2-4 pools is fine — even 2 if conviction is overwhelming and concentration is the right call)
  • If multiple solid protocols compete and diversification meaningfully reduces protocol risk, spread wider (10-20+ pools for large budgets where any single failure must not crater the portfolio)
  • For small budgets ($1k-$10k), too many pools dilutes capital below useful thresholds — prefer 2-5
  • For mid budgets ($10k-$100k), typically 4-10 unless one cluster is dominant
  • For large budgets ($100k+), genuine spread across protocol/chain/asset risk usually warrants 10-25+
  NEVER pad with low-conviction pools to hit a count. NEVER over-concentrate because picks look strong on paper if a single exploit would be catastrophic. Justify the count you chose in diversificationNotes.
- CRITICAL: Use the AI safety analysis data. Protocols with legitimacy score below 50 should get minimal or zero allocation for low/medium risk
- For low risk: only allocate to protocols with legitimacy score >= 70 and "high_confidence" or "moderate_confidence" verdict
- For medium risk: protocols with score >= 50 are acceptable
- For high risk: all protocols acceptable but still favor higher scores
- Only use pools from the data above - use the exact poolId, symbol, chain, and apy values
- Include step-by-step instructions on how to actually make each investment
- Be specific about which chain to use and what the user needs (wallet, bridge, etc.)
- Include the legitimacyScore, verdict, and redFlags from the analysis data for each allocation
- If contract security data is available, prefer protocols with score >= 70 for low/medium risk. Flag any protocol with honeypot detection or high sell tax
- If a pool has an auto-compound vault available, mention it in the steps as an alternative investment method
- Pools sourced from auto-compounders (Source:AutoCompounder) auto-compound yields — note this advantage in reasoning
- Return ONLY valid JSON, no other text`;
}

function parseStrategyResponse(text: string): InvestmentStrategy {
  let jsonStr = text.trim();

  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const startIdx = jsonStr.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < jsonStr.length; i++) {
      if (jsonStr[i] === "{") depth++;
      else if (jsonStr[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
  }

  const parsed = JSON.parse(jsonStr);
  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
}

/* ========== STAGE 2 — COLD-EYES REVIEW (CODEX + GEMINI IN PARALLEL) ========== */

interface ReviewerCritique {
  verdict: "approve" | "revise" | "reject";
  concerns: Array<{
    category: string;
    severity: string;
    issue: string;
    suggestion: string;
  }>;
  rejectedPoolIds: string[];
  missingConsiderations: string[];
  overallNote: string;
}
/** @deprecated use ReviewerCritique */
type CodexCritique = ReviewerCritique;

function buildCritiquePrompt(
  criteria: StrategyCriteria,
  proposal: InvestmentStrategy,
  summaries: ProtocolSummary[],
  totalPoolsScanned: number
): string {
  const proposalJson = JSON.stringify(
    {
      summary: proposal.summary,
      projectedApy: proposal.projectedApy,
      projectedYearlyReturn: proposal.projectedYearlyReturn,
      riskAssessment: proposal.riskAssessment,
      allocations: proposal.allocations,
      diversificationNotes: proposal.diversificationNotes,
      warnings: proposal.warnings,
    },
    null,
    2
  );

  // Compact protocol catalogue Codex can reference
  const protocolCatalogue = summaries
    .map((s) => {
      const a = s.analysis;
      const safety = a
        ? `legitimacy=${a.legitimacyScore} verdict=${a.overallVerdict} flags="${a.redFlags.join("|")}"`
        : "no-deep-analysis";
      const pools = s.pools
        .map(
          (p) =>
            `    ${p.poolId} | ${p.symbol} on ${p.chain} | APY=${p.apy.toFixed(2)}% TVL=${formatCurrency(p.tvl)} stable=${p.stablecoin ? "Y" : "N"}`
        )
        .join("\n");
      return `- ${s.name} (${s.category}) TVL=${formatCurrency(s.tvl)} ${safety}\n${pools}`;
    })
    .join("\n");

  return `You are a senior DeFi risk reviewer. Your job is COLD-EYES ADVERSARIAL REVIEW of another AI's investment strategy proposal. Be specific. Cite poolIds. No hedging.

USER CRITERIA:
- Budget: $${criteria.budget.toLocaleString()}
- Risk appetite: ${criteria.riskAppetite}
- Target APY: ${criteria.targetApyMin}%-${criteria.targetApyMax}%
- Asset filter: ${criteria.assetType ?? "all"}

THE FULL PROTOCOL CATALOGUE THAT WAS AVAILABLE (${totalPoolsScanned} pools were scanned, ${summaries.length} protocols qualified):
${protocolCatalogue}

THE STRATEGY PROPOSAL (from another AI) TO REVIEW:
${proposalJson}

REVIEW MANDATE — flag every concrete problem you find. Categories:
- concentration: too much weight in one protocol/chain/asset
- safety: allocations to caution-verdict protocols, ignored red flags, missing audits
- risk_mismatch: low-risk user given high-volatility pools, or vice versa
- allocation: amounts that don't sum to budget, percentages off, illogical sizing
- diversification: missing chain/asset/category spread
- reasoning: weak or unsupported justifications, copy-paste reasoning
- missing_data: ignored a high-quality candidate from the catalogue
- other: anything else worth fixing

For each concern, propose a CONCRETE FIX (which poolId to add/drop, what % to shift, what to clarify).

Return ONLY this JSON:
{
  "verdict": "approve" | "revise" | "reject",
  "concerns": [
    {
      "category": "concentration|safety|risk_mismatch|allocation|diversification|reasoning|missing_data|other",
      "severity": "high|medium|low",
      "issue": "<specific problem, cite poolIds or numbers>",
      "suggestion": "<concrete fix>"
    }
  ],
  "rejectedPoolIds": ["<poolIds you think should be removed entirely>"],
  "missingConsiderations": ["<important pools/protocols ignored in the proposal>"],
  "overallNote": "<2-3 sentences on whether the proposal is acceptable as-is or needs revision>"
}

Use "approve" only if you find ZERO high or medium severity concerns. Use "revise" if there are concerns the lead architect can fix. Use "reject" only if the strategy is fundamentally broken.`;
}

function normalizeCritique(raw: unknown): ReviewerCritique {
  const r = (raw ?? {}) as Partial<ReviewerCritique> & Record<string, unknown>;
  const verdict = ["approve", "revise", "reject"].includes(String(r.verdict))
    ? (r.verdict as ReviewerCritique["verdict"])
    : "revise";
  return {
    verdict,
    concerns: Array.isArray(r.concerns)
      ? (r.concerns as Record<string, unknown>[])
          .map((c) => ({
            category: String(c.category ?? "other"),
            severity: String(c.severity ?? "medium"),
            issue: String(c.issue ?? "").trim(),
            suggestion: String(c.suggestion ?? "").trim(),
          }))
          .filter((c) => c.issue.length > 0)
          .slice(0, 20)
      : [],
    rejectedPoolIds: Array.isArray(r.rejectedPoolIds)
      ? (r.rejectedPoolIds as unknown[]).map(String).slice(0, 20)
      : [],
    missingConsiderations: Array.isArray(r.missingConsiderations)
      ? (r.missingConsiderations as unknown[]).map(String).slice(0, 10)
      : [],
    overallNote: String(r.overallNote ?? "").trim(),
  };
}

/**
 * Invoke a single reviewer (Codex or Gemini) and parse its critique.
 * Resolves to null with error on any failure — caller handles partial results.
 */
async function runReviewer(
  source: ReviewerSource,
  prompt: string,
  timeoutMs: number
): Promise<{ critique: ReviewerCritique | null; error: string | null }> {
  try {
    const output =
      source === "codex"
        ? await invokeCodex(prompt, { timeoutMs })
        : await invokeGemini(prompt, { timeoutMs });
    const parsed = extractJson<ReviewerCritique>(output);
    return { critique: normalizeCritique(parsed), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { critique: null, error: message };
  }
}

/**
 * Merge critiques from both reviewers into a single deduplicated concern list.
 * Overlapping concerns (same issue text normalized) are collapsed with their
 * `sources` list tracking both AIs. Severity is escalated to the highest bucket
 * either reviewer assigned.
 */
function mergeReviewerCritiques(
  codex: ReviewerCritique | null,
  gemini: ReviewerCritique | null
): {
  concerns: Array<ReviewerCritique["concerns"][number] & { sources: ReviewerSource[] }>;
  rejectedPoolIds: string[];
  missingConsiderations: string[];
  combinedNote: string;
} {
  const bucket = new Map<
    string,
    ReviewerCritique["concerns"][number] & { sources: ReviewerSource[] }
  >();
  const sevRank: Record<string, number> = { high: 3, medium: 2, low: 1 };

  const addConcerns = (source: ReviewerSource, c: ReviewerCritique | null) => {
    if (!c) return;
    for (const concern of c.concerns) {
      const key = `${concern.category}::${concern.issue.toLowerCase().replace(/\s+/g, " ").trim()}`;
      const existing = bucket.get(key);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        if ((sevRank[concern.severity] ?? 0) > (sevRank[existing.severity] ?? 0)) {
          existing.severity = concern.severity;
        }
        if (concern.suggestion.length > existing.suggestion.length) {
          existing.suggestion = concern.suggestion;
        }
      } else {
        bucket.set(key, { ...concern, sources: [source] });
      }
    }
  };

  addConcerns("codex", codex);
  addConcerns("gemini", gemini);

  const rejectedPoolIds = Array.from(
    new Set([...(codex?.rejectedPoolIds ?? []), ...(gemini?.rejectedPoolIds ?? [])])
  ).slice(0, 30);
  const missingConsiderations = Array.from(
    new Set([...(codex?.missingConsiderations ?? []), ...(gemini?.missingConsiderations ?? [])])
  ).slice(0, 15);

  const notes: string[] = [];
  if (codex?.overallNote) notes.push(`Reviewer A: ${codex.overallNote}`);
  if (gemini?.overallNote) notes.push(`Reviewer B: ${gemini.overallNote}`);
  const combinedNote = notes.join(" | ");

  const concerns = Array.from(bucket.values())
    .sort((a, b) => {
      // Higher severity, then more-sources (consensus) first
      const sevDiff = (sevRank[b.severity] ?? 0) - (sevRank[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return b.sources.length - a.sources.length;
    })
    .slice(0, 30);

  return { concerns, rejectedPoolIds, missingConsiderations, combinedNote };
}

const VALID_CRITIQUE_CATEGORIES: CritiqueCategory[] = [
  "concentration",
  "safety",
  "risk_mismatch",
  "allocation",
  "diversification",
  "reasoning",
  "missing_data",
  "other",
];

function critiqueToPoints(
  concerns: Array<ReviewerCritique["concerns"][number] & { sources?: ReviewerSource[] }>
): CritiquePoint[] {
  return concerns.map((concern) => {
    const cat = (
      VALID_CRITIQUE_CATEGORIES.includes(concern.category as CritiqueCategory)
        ? concern.category
        : "other"
    ) as CritiqueCategory;
    const sev = (["high", "medium", "low"].includes(concern.severity)
      ? concern.severity
      : "medium") as CritiqueSeverity;
    return {
      category: cat,
      severity: sev,
      issue: concern.issue.slice(0, 400),
      suggestion: concern.suggestion.slice(0, 400),
      sources: concern.sources,
    };
  });
}

/* ========== STAGE 3 — CLAUDE REVISION ========== */

interface MergedCritiqueForRevision {
  concerns: Array<ReviewerCritique["concerns"][number] & { sources: ReviewerSource[] }>;
  rejectedPoolIds: string[];
  missingConsiderations: string[];
  combinedNote: string;
  codexVerdict: ReviewerVerdict;
  geminiVerdict: ReviewerVerdict;
}

function buildRevisionPrompt(
  criteria: StrategyCriteria,
  initial: InvestmentStrategy,
  merged: MergedCritiqueForRevision,
  summaries: ProtocolSummary[]
): string {
  const initialJson = JSON.stringify(
    {
      summary: initial.summary,
      projectedApy: initial.projectedApy,
      projectedYearlyReturn: initial.projectedYearlyReturn,
      riskAssessment: initial.riskAssessment,
      allocations: initial.allocations,
      diversificationNotes: initial.diversificationNotes,
      warnings: initial.warnings,
      steps: initial.steps,
    },
    null,
    2
  );

  const concernsBlock = merged.concerns.length
    ? merged.concerns
        .map(
          (c, i) =>
            `${i + 1}. [${c.severity.toUpperCase()} · ${c.category} · flagged by: ${c.sources.join("+")}] ${c.issue}\n   FIX: ${c.suggestion}`
        )
        .join("\n")
    : "(no specific concerns)";

  const rejectedBlock = merged.rejectedPoolIds.length
    ? `Pool IDs reviewers want REMOVED: ${merged.rejectedPoolIds.join(", ")}`
    : "";
  const missingBlock = merged.missingConsiderations.length
    ? `Considerations reviewers think were missed:\n- ${merged.missingConsiderations.join("\n- ")}`
    : "";

  const protocolCatalogue = summaries
    .map((s) => {
      const a = s.analysis;
      const safety = a
        ? `legitimacy=${a.legitimacyScore} verdict=${a.overallVerdict}`
        : "no-deep-analysis";
      const fmtPct = (v: number | null | undefined) =>
        v == null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
      const pools = s.pools
        .map((p) => {
          const stab = p.stability
            ? ` | hist=${p.stability.monthsOfHistory.toFixed(1)}mo | 6mCoV=${p.stability.coefficientOfVariation6m.toFixed(2)} | 12mCoV=${p.stability.coefficientOfVariation12m.toFixed(2)} | 24mCoV=${p.stability.coefficientOfVariation24m.toFixed(2)}`
            : "";
          return `    ${p.poolId} | ${p.symbol} | ${p.chain} | APY=${p.apy.toFixed(2)}% | 7dΔ=${fmtPct(p.apyPct7D)} | 30dΔ=${fmtPct(p.apyPct30D)} | TVL=${formatCurrency(p.tvl)} | stable=${p.stablecoin ? "Y" : "N"}${stab}`;
        })
        .join("\n");
      return `${s.name} (${s.category}) ${safety}\n${pools}`;
    })
    .join("\n\n");

  return `You are revising your DeFi investment strategy after a peer-review by two independent AI reviewers (Codex GPT-5.5 and Gemini 3.1 Pro). Your goal: produce ONE final strategy that resolves the reviewers' valid concerns. Concerns flagged by BOTH reviewers are consensus signals — treat them as priority. You may push back IN THE STRATEGY ITSELF (e.g., keep an allocation but justify it more clearly) but you must address every HIGH severity concern.

USER CRITERIA:
- Budget: $${criteria.budget.toLocaleString()}
- Risk appetite: ${criteria.riskAppetite}
- Target APY: ${criteria.targetApyMin}%-${criteria.targetApyMax}%

YOUR INITIAL PROPOSAL:
${initialJson}

REVIEWER VERDICTS — Codex: ${merged.codexVerdict} · Gemini: ${merged.geminiVerdict}
Overall notes: ${merged.combinedNote}

Concerns to resolve (each tagged with flagging reviewer(s)):
${concernsBlock}

${rejectedBlock}
${missingBlock}

FULL PROTOCOL CATALOGUE (use exact poolIds from here):
${protocolCatalogue}

REVISE THE STRATEGY. Return ONLY a JSON object with the SAME structure as your original proposal:
{
  "summary": "<2-3 paragraph summary, MUST mention what changed from initial proposal and why>",
  "projectedApy": <number>,
  "projectedYearlyReturn": <number>,
  "riskAssessment": "<paragraph>",
  "allocations": [
    {
      "protocol": "<name>",
      "chain": "<chain>",
      "symbol": "<symbol>",
      "poolId": "<exact poolId from catalogue>",
      "apy": <number>,
      "tvl": <number>,
      "stablecoin": <boolean>,
      "allocationAmount": <dollars>,
      "allocationPercent": <percent>,
      "reasoning": "<why this pool, addressing reviewer concerns where relevant>",
      "legitimacyScore": <number>,
      "verdict": "<high_confidence|moderate_confidence|low_confidence|caution>",
      "redFlags": ["..."]
    }
  ],
  "diversificationNotes": "<paragraph>",
  "warnings": ["...","..."],
  "steps": ["...","..."],
  "revisionNotes": "<1-2 sentences on what you changed in response to the review and what you kept>",
  "rejections": [
    {
      "concernIndex": <1-based index of a concern from the list above that you DID NOT address>,
      "rationale": "<one sentence explaining why you consciously kept the disputed decision instead of acting on this concern>"
    }
  ]
}

RULES:
- Allocations MUST sum to exactly $${criteria.budget.toLocaleString()}
- Address EVERY high-severity concern OR add it to "rejections" with a rationale — silent rejection is not allowed for high-severity concerns
- Address medium concerns where possible; if not, listing in "rejections" is encouraged but not required
- "rejections" must use the 1-based concernIndex from the list above (1, 2, 3, …)
- If you keep an allocation the reviewer flagged, justify it specifically in that allocation's reasoning AND add the concern to "rejections"
- Use only poolIds from the catalogue
- Return ONLY valid JSON, no other text`;
}

interface RevisedStrategyShape extends InvestmentStrategy {
  revisionNotes?: string;
  rejections?: Array<{ concernIndex?: number; rationale?: string } | unknown>;
}

/**
 * Enforce that a parsed revision object has the shape we expect. Returns an
 * error message if malformed; undefined if valid. Used to gate whether we
 * accept the revision or fall back to the initial proposal.
 */
function validateRevisedStrategy(
  obj: unknown,
  criteria: StrategyCriteria
): string | undefined {
  if (!obj || typeof obj !== "object") return "revision is not an object";
  const r = obj as Partial<InvestmentStrategy> & Record<string, unknown>;
  if (!Array.isArray(r.allocations)) return "revision missing allocations[]";
  if (r.allocations.length < 2) return `revision has ${r.allocations.length} allocations (need >=2)`;
  for (let i = 0; i < r.allocations.length; i++) {
    const a = r.allocations[i] as Partial<StrategyAllocation> | undefined;
    if (!a || typeof a !== "object") return `allocation ${i} not an object`;
    if (typeof a.poolId !== "string" || a.poolId.length === 0) return `allocation ${i} missing poolId`;
    if (typeof a.allocationAmount !== "number" || !Number.isFinite(a.allocationAmount) || a.allocationAmount <= 0)
      return `allocation ${i} has invalid allocationAmount`;
    if (typeof a.apy !== "number" || !Number.isFinite(a.apy)) return `allocation ${i} has invalid apy`;
  }
  // Budget tolerance: ±1% OR $50, whichever is larger
  const sum = r.allocations.reduce((acc: number, a) => acc + (a.allocationAmount ?? 0), 0);
  const tolerance = Math.max(50, criteria.budget * 0.01);
  if (Math.abs(sum - criteria.budget) > tolerance) {
    return `allocations sum to $${sum.toFixed(0)} but budget is $${criteria.budget} (off by $${(sum - criteria.budget).toFixed(0)})`;
  }
  return undefined;
}

/**
 * Recompute projected APY as the allocation-weighted average from the
 * actual allocations, rather than trusting the model's stated projectedApy.
 * This catches the case where Claude's revision changes allocations but
 * forgets to update the top-level projectedApy field.
 */
function recomputeWeightedApy(strategy: InvestmentStrategy): number {
  const total = strategy.allocations.reduce((acc, a) => acc + a.allocationAmount, 0);
  if (total <= 0) return strategy.projectedApy;
  const weighted = strategy.allocations.reduce(
    (acc, a) => acc + a.apy * (a.allocationAmount / total),
    0
  );
  return Number.isFinite(weighted) ? Number(weighted.toFixed(4)) : strategy.projectedApy;
}

/* ========== HELPERS ========== */

async function invokeClaudeCli(prompt: string, timeoutMs: number): Promise<string> {
  return invokeClaude(prompt, { effort: "max", timeoutMs });
}

function diffPoolIds(initial: InvestmentStrategy, revised: InvestmentStrategy): {
  dropped: string[];
  added: string[];
} {
  const initialIds = new Set(initial.allocations.map((a) => a.poolId));
  const revisedIds = new Set(revised.allocations.map((a) => a.poolId));
  const dropped = [...initialIds].filter((id) => !revisedIds.has(id));
  const added = [...revisedIds].filter((id) => !initialIds.has(id));
  return { dropped, added };
}

export async function generateStrategy(
  criteria: StrategyCriteria,
  opts: GenerateStrategyOptions = {}
): Promise<{ strategy: InvestmentStrategy; poolsScanned: number; protocolsAnalyzed: number; protocolsDeepAnalyzed: number }> {
  const emit = (event: StrategyProgressEvent) => {
    try {
      opts.onProgress?.(event);
    } catch {
      // progress sinks must never break the pipeline
    }
  };

  // 1. Fetch everything from DeFiLlama
  emit({ stage: "fetching_data", message: "Fetching pools and protocols from the live yield feed…" });
  const [allPools, allProtocols] = await Promise.all([
    fetchAllEnrichedPools(),
    fetchProtocols(),
  ]);

  // 2. Filter pools by APY range
  emit({
    stage: "filtering_pools",
    message: `Filtering ${allPools.length.toLocaleString()} pools by APY ${criteria.targetApyMin}-${criteria.targetApyMax}%, risk=${criteria.riskAppetite}…`,
  });
  const qualifying = allPools.filter((p) => {
    if (!p.apy || p.apy <= 0) return false;
    if (!p.tvlUsd || p.tvlUsd <= 0) return false;
    if (p.apy < criteria.targetApyMin || p.apy > criteria.targetApyMax) return false;
    if (criteria.assetType === "stablecoins" && !p.stablecoin) return false;

    const minTvl =
      criteria.riskAppetite === "low" ? 5_000_000
      : criteria.riskAppetite === "medium" ? 500_000
      : 50_000;
    if (p.tvlUsd < minTvl) return false;

    // APY-stability gate for safe/balanced tiers. Pools with extreme recent
    // swings (e.g. APY oscillating 0%→25% on a tiny TVL base) get dropped
    // before the AI ever sees them — the AI prompt only carries a snapshot
    // APY, so without this filter chart-noisy pools could land in a "safe"
    // strategy. Aggressive ("high") keeps full reach.
    if (criteria.riskAppetite === "low" || criteria.riskAppetite === "medium") {
      const pct7 = p.apyPct7D == null ? 0 : Math.abs(p.apyPct7D);
      const pct30 = p.apyPct30D == null ? 0 : Math.abs(p.apyPct30D);
      const cap7 = criteria.riskAppetite === "low" ? 25 : 60;
      const cap30 = criteria.riskAppetite === "low" ? 50 : 120;
      if (pct7 > cap7 || pct30 > cap30) return false;
    }

    return true;
  });

  // 2b. Long-horizon stability gate (safe + balanced only). Fetch full chart
  // history for the top candidates by TVL and compute multi-year stability
  // metrics. Pools without enough history (or with high coefficient of
  // variation over 12/24m) are dropped before the AI sees them. High-risk
  // skips this gate per spec — a few months of history is fine there.
  const stabilityByPool = new Map<string, PoolStability | null>();
  let qualifyingAfterStability = qualifying;
  if (criteria.riskAppetite === "low" || criteria.riskAppetite === "medium") {
    const candidates = [...qualifying]
      .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
      .slice(0, 200);
    emit({
      stage: "filtering_pools",
      message: `Fetching multi-year APY history for top ${candidates.length} candidate pools to enforce long-term stability…`,
    });
    const stabilityResults = await Promise.all(
      candidates.map(async (p) => ({ poolId: p.pool, stab: await getPoolStability(p.pool) })),
    );
    for (const { poolId, stab } of stabilityResults) {
      stabilityByPool.set(poolId, stab);
    }
    const candidateIds = new Set(candidates.map((c) => c.pool));
    qualifyingAfterStability = qualifying.filter((p) => {
      if (!candidateIds.has(p.pool)) return false; // outside the candidate window — drop
      return passesStabilityGate(stabilityByPool.get(p.pool) ?? null, criteria.riskAppetite);
    });
    const dropped = qualifying.length - qualifyingAfterStability.length;
    console.log(
      `[strategy] long-term stability gate: ${candidates.length} candidates → ${qualifyingAfterStability.length} survive (dropped ${dropped})`,
    );
  }

  // 3. Build protocol summaries
  const summaries = buildProtocolSummaries(qualifyingAfterStability, allProtocols, stabilityByPool);

  // 4. Cap deep analysis at the top 10 protocols by TVL. Each runs the
  // triple-AI ensemble (Claude+Codex+Gemini) plus a Claude synthesis call,
  // so the wall time scales fast. Beyond ~10 the strategy request reliably
  // outruns the browser's connection budget and the user sees a generic
  // "page couldn't load" instead of the strategy.
  const protocolsToAnalyze = summaries.slice(0, 10);

  // 5. Run deep AI security analysis on each protocol
  console.log(`Running deep AI analysis on ${protocolsToAnalyze.length} protocols...`);
  emit({
    stage: "deep_analysis",
    message: `Running triple-model security analysis on ${protocolsToAnalyze.length} protocols (three reasoning models in parallel per protocol)…`,
    sub: { done: 0, total: protocolsToAnalyze.length },
  });
  const analyzedSummaries = await deepAnalyzeProtocols(
    protocolsToAnalyze,
    qualifyingAfterStability,
    allProtocols,
    (done, total) => {
      console.log(`  Analyzed ${done}/${total} protocols`);
      emit({
        stage: "deep_analysis",
        message: `Analyzed ${done}/${total} protocols — running ground-truth checks, AI scoring, synthesis, and heuristic vetoes…`,
        sub: { done, total },
      });
    }
  );

  const protocolsDeepAnalyzed = analyzedSummaries.filter((s) => s.analysis).length;
  console.log(`Deep analysis complete: ${protocolsDeepAnalyzed} protocols analyzed successfully`);

  // ===== STAGE 1 — Claude proposes initial strategy =====
  console.log("[strategy] stage 1: Claude proposing initial strategy");
  emit({
    stage: "claude_proposer",
    message: `The lead architect is composing an initial allocation across ${protocolsDeepAnalyzed} analyzed protocols…`,
  });
  const initialPrompt = buildStrategyPrompt(criteria, analyzedSummaries, qualifying.length);
  const initialOutput = await invokeClaudeCli(initialPrompt, 600_000);
  const initialStrategy = parseStrategyResponse(initialOutput);

  // ===== STAGE 2 — Codex GPT-5.5 + Gemini 3.1 Pro review IN PARALLEL =====
  console.log("[strategy] stage 2: Codex + Gemini reviewing proposal in parallel");
  emit({
    stage: "reviewers",
    message: `Two independent reviewers are stress-testing the architect's ${initialStrategy.allocations?.length ?? "?"}-pool proposal in parallel…`,
  });
  const critiquePrompt = buildCritiquePrompt(
    criteria,
    initialStrategy,
    analyzedSummaries,
    qualifying.length
  );
  const [codexResult, geminiResult] = await Promise.all([
    runReviewer("codex", critiquePrompt, 480_000),
    runReviewer("gemini", critiquePrompt, 480_000),
  ]);

  const codexCritique = codexResult.critique;
  const geminiCritique = geminiResult.critique;
  const codexVerdictRaw: ReviewerVerdict = codexCritique ? codexCritique.verdict : "unavailable";
  const geminiVerdictRaw: ReviewerVerdict = geminiCritique ? geminiCritique.verdict : "unavailable";
  console.log(
    `[strategy] stage 2 done: codex=${codexVerdictRaw}${codexCritique ? `(${codexCritique.concerns.length})` : ""} gemini=${geminiVerdictRaw}${geminiCritique ? `(${geminiCritique.concerns.length})` : ""}`
  );

  // If BOTH reviewers unavailable, return Claude's proposal unreviewed.
  if (!codexCritique && !geminiCritique) {
    emit({
      stage: "finalizing",
      message: "Reviewers unavailable — returning the architect's proposal unreviewed.",
    });
    const detail = [codexResult.error, geminiResult.error].filter(Boolean).join(" | ");
    const collaboration: CollaborationTrail = {
      bothAisAvailable: false,
      critiquePoints: [],
      initialProjectedApy: initialStrategy.projectedApy,
      finalProjectedApy: initialStrategy.projectedApy,
      droppedPoolIds: [],
      addedPoolIds: [],
      codexVerdict: "unavailable",
      reviewerVerdicts: { codex: "unavailable", gemini: "unavailable" },
      revisionNotes: `Both reviewers unavailable${detail ? ` (${detail.slice(0, 200)})` : ""}; strategy is from the lead architect only.`,
    };
    return {
      strategy: { ...initialStrategy, collaboration },
      poolsScanned: qualifying.length,
      protocolsAnalyzed: summaries.length,
      protocolsDeepAnalyzed,
    };
  }

  const merged = mergeReviewerCritiques(codexCritique, geminiCritique);

  // If every available reviewer approved with no concerns, skip revision.
  const availableCritiques: ReviewerCritique[] = [codexCritique, geminiCritique].filter(
    (c): c is ReviewerCritique => c !== null
  );
  const allApproveNoConcerns = availableCritiques.every(
    (c) => c.verdict === "approve" && c.concerns.length === 0
  );
  if (allApproveNoConcerns) {
    console.log("[strategy] stage 3 skipped: all available reviewers approved without concerns");
    emit({
      stage: "finalizing",
      message: "Reviewers approved with zero concerns — skipping revision.",
    });
    const collaboration: CollaborationTrail = {
      bothAisAvailable: codexCritique !== null && geminiCritique !== null,
      critiquePoints: [],
      initialProjectedApy: initialStrategy.projectedApy,
      finalProjectedApy: initialStrategy.projectedApy,
      droppedPoolIds: [],
      addedPoolIds: [],
      codexVerdict: codexVerdictRaw,
      reviewerVerdicts: { codex: codexVerdictRaw, gemini: geminiVerdictRaw },
      revisionNotes: merged.combinedNote || "Reviewers approved the initial proposal as-is.",
    };
    return {
      strategy: { ...initialStrategy, collaboration },
      poolsScanned: qualifying.length,
      protocolsAnalyzed: summaries.length,
      protocolsDeepAnalyzed,
    };
  }

  // ===== STAGE 3 — Claude revises in response to merged critique =====
  console.log(
    `[strategy] stage 3: Claude revising against ${merged.concerns.length} merged concerns`
  );
  emit({
    stage: "claude_revision",
    message: `The architect is revising the strategy against ${merged.concerns.length} reviewer concern${merged.concerns.length === 1 ? "" : "s"} (reviewer A=${codexVerdictRaw}, reviewer B=${geminiVerdictRaw})…`,
  });
  let revisedStrategy: InvestmentStrategy = initialStrategy;
  let revisionFailed = false;
  let revisionFailureReason: string | null = null;
  try {
    const revisionPrompt = buildRevisionPrompt(
      criteria,
      initialStrategy,
      {
        concerns: merged.concerns,
        rejectedPoolIds: merged.rejectedPoolIds,
        missingConsiderations: merged.missingConsiderations,
        combinedNote: merged.combinedNote,
        codexVerdict: codexVerdictRaw,
        geminiVerdict: geminiVerdictRaw,
      },
      analyzedSummaries
    );
    const revisedOutput = await invokeClaudeCli(revisionPrompt, 600_000);
    const parsedRevised = parseStrategyResponse(revisedOutput) as RevisedStrategyShape;
    const validationError = validateRevisedStrategy(parsedRevised, criteria);
    if (validationError) {
      throw new Error(`revision validation failed: ${validationError}`);
    }
    revisedStrategy = parsedRevised;
  } catch (err) {
    revisionFailed = true;
    revisionFailureReason = err instanceof Error ? err.message : String(err);
    console.warn(`[strategy] stage 3 failed: ${revisionFailureReason}`);
  }

  // Recompute projected APY from the actual allocations in case the model's
  // top-level number got out of sync with its revised allocations.
  const recomputedApy = recomputeWeightedApy(revisedStrategy);
  const recomputedYearlyReturn = Number((criteria.budget * (recomputedApy / 100)).toFixed(2));
  revisedStrategy = {
    ...revisedStrategy,
    projectedApy: recomputedApy,
    projectedYearlyReturn: recomputedYearlyReturn,
  };

  const { dropped, added } = diffPoolIds(initialStrategy, revisedStrategy);
  const droppedSet = new Set(dropped);

  const initialByPoolId = new Map(initialStrategy.allocations.map((a) => [a.poolId, a]));
  const revisedByPoolId = new Map(revisedStrategy.allocations.map((a) => [a.poolId, a]));

  /**
   * Returns the result of verifying whether `point` is addressed AND whether
   * it was *verifiable in principle*. A concern is verifiable when it cites a
   * specific poolId (we can check drop / cut / rewrite) or is in the
   * "allocation" category (we can check budget sum). Abstract concerns
   * (style, reasoning, missing data with no poolId) cannot be deterministically
   * verified — those are tagged advisory and excluded from the X/Y headline.
   */
  const resolveConcern = (point: CritiquePoint): { addressed: boolean; verifiable: boolean } => {
    if (revisionFailed) return { addressed: false, verifiable: false };
    const haystack = `${point.issue} ${point.suggestion}`.toLowerCase();
    const mentionedPoolIds = [...initialByPoolId.keys()].filter((id) =>
      haystack.includes(id.toLowerCase())
    );

    if (mentionedPoolIds.length > 0) {
      const addressed = mentionedPoolIds.every((id) => {
        if (droppedSet.has(id)) return true;
        const initial = initialByPoolId.get(id);
        const revised = revisedByPoolId.get(id);
        if (!initial || !revised) return false;
        const amountDropped =
          initial.allocationAmount > 0 &&
          (initial.allocationAmount - revised.allocationAmount) / initial.allocationAmount >= 0.2;
        const reasoningChanged =
          (revised.reasoning || "").trim() !== (initial.reasoning || "").trim() &&
          (revised.reasoning || "").length >= (initial.reasoning || "").length;
        return amountDropped || reasoningChanged;
      });
      return { addressed, verifiable: true };
    }

    if (point.category === "allocation") {
      const sum = revisedStrategy.allocations.reduce((acc, a) => acc + a.allocationAmount, 0);
      const tolerance = Math.max(50, criteria.budget * 0.01);
      return { addressed: Math.abs(sum - criteria.budget) <= tolerance, verifiable: true };
    }
    return { addressed: false, verifiable: false };
  };

  // Map Claude's per-concern rejection rationales (1-based concernIndex from
  // the prompt) onto the critique points so the UI can show what Claude said
  // when it consciously kept a disputed decision.
  const rejectionMap = new Map<number, string>();
  const rawRejections = (revisedStrategy as RevisedStrategyShape).rejections;
  if (Array.isArray(rawRejections)) {
    for (const r of rawRejections) {
      if (!r || typeof r !== "object") continue;
      const obj = r as { concernIndex?: unknown; rationale?: unknown };
      const idx = typeof obj.concernIndex === "number" ? obj.concernIndex : NaN;
      const rationale = typeof obj.rationale === "string" ? obj.rationale.trim() : "";
      if (Number.isInteger(idx) && idx >= 1 && rationale.length > 0) {
        rejectionMap.set(idx, rationale.slice(0, 400));
      }
    }
  }

  const critiquePoints: CritiquePoint[] = critiqueToPoints(merged.concerns).map((p, i) => {
    const { addressed, verifiable } = resolveConcern(p);
    const rejection = rejectionMap.get(i + 1);
    return {
      ...p,
      addressed,
      verifiable,
      claudeRejection: rejection,
    };
  });

  // High-severity concerns that were not addressed AND not explicitly rejected
  // with a rationale → those are the truly silent ones and warrant a warning.
  const unresolvedHigh = critiquePoints.filter(
    (p) => p.severity === "high" && !p.addressed && !p.claudeRejection,
  );
  const extraWarnings: string[] = [];
  if (unresolvedHigh.length > 0) {
    const sources = Array.from(
      new Set(unresolvedHigh.flatMap((p) => p.sources ?? []))
    );
    const sourcesLabel =
      sources.length === 0 ? "reviewers" : sources.map((s) => (s === "codex" ? "Reviewer A" : "Reviewer B")).join(" & ");
    extraWarnings.push(
      `REVIEWER NOTE — ${unresolvedHigh.length} high-severity concern${
        unresolvedHigh.length === 1 ? "" : "s"
      } from ${sourcesLabel} remained unaddressed and the lead architect provided no rejection rationale. Review the dual-reviewer trail below before depositing.`
    );
  }

  const revisionNotes =
    (revisedStrategy as RevisedStrategyShape).revisionNotes ||
    (revisionFailed
      ? `Revision step failed${revisionFailureReason ? ` (${revisionFailureReason.slice(0, 200)})` : ""}; serving initial proposal with reviewer concerns attached.`
      : merged.combinedNote);

  const bothReviewersSucceeded = codexCritique !== null && geminiCritique !== null;

  const collaboration: CollaborationTrail = {
    bothAisAvailable: bothReviewersSucceeded && !revisionFailed,
    critiquePoints,
    initialProjectedApy: initialStrategy.projectedApy,
    finalProjectedApy: revisedStrategy.projectedApy,
    droppedPoolIds: dropped,
    addedPoolIds: added,
    codexVerdict: codexVerdictRaw,
    reviewerVerdicts: { codex: codexVerdictRaw, gemini: geminiVerdictRaw },
    revisionNotes: String(revisionNotes).slice(0, 600),
  };

  // Enrich each allocation with the protocol's primary contract address +
  // deployment chain so the UI can deep-link to the multi-engine audit page.
  // DefiLlama's `chain` is sometimes "Multi-Chain"; fall back to chains[0] in
  // that case (typically the canonical L1 deployment).
  const protocolByName = new Map<string, DefiLlamaProtocol>();
  for (const p of allProtocols) protocolByName.set(p.name.toLowerCase(), p);

  const enrichedAllocations: StrategyAllocation[] = revisedStrategy.allocations.map((a) => {
    const proto = protocolByName.get(a.protocol.toLowerCase());
    if (!proto) return a;
    const rawAddr = proto.address?.trim();
    if (!rawAddr || !/^0x[a-fA-F0-9]{40}$/.test(rawAddr)) return a;
    const chainName =
      proto.chain && proto.chain !== "Multi-Chain"
        ? proto.chain
        : proto.chains?.[0] ?? proto.chain ?? "Ethereum";
    return { ...a, contractAddress: rawAddr, auditChain: chainName };
  });

  const finalStrategy: InvestmentStrategy = {
    ...revisedStrategy,
    allocations: enrichedAllocations,
    warnings: [...(revisedStrategy.warnings || []), ...extraWarnings],
    collaboration,
  };

  emit({ stage: "finalizing", message: "Packaging strategy and collaboration trail…" });

  return {
    strategy: finalStrategy,
    poolsScanned: qualifying.length,
    protocolsAnalyzed: summaries.length,
    protocolsDeepAnalyzed,
  };
}
