import { spawn } from "child_process";
import type { DefiLlamaPool, DefiLlamaProtocol } from "@/types/pool";
import type {
  StrategyCriteria,
  InvestmentStrategy,
  CollaborationTrail,
  CritiquePoint,
  CritiqueCategory,
  CritiqueSeverity,
} from "@/types/strategy";
import type { ProtocolAnalysis } from "@/types/analysis";
import { fetchProtocols } from "./defillama";
import { fetchAllEnrichedPools } from "./pool-aggregator";
import { analyzeProtocol } from "./anthropic";
import { formatCurrency } from "./formatters";
import { invokeCodex } from "./security/codex-client";
import { extractJson } from "./security/claude-client";

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
  }[];
  analysis?: ProtocolAnalysis;
}

function buildProtocolSummaries(
  pools: DefiLlamaPool[],
  protocols: DefiLlamaProtocol[]
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

  // Analyze protocols in parallel batches of 5
  const BATCH_SIZE = 5;
  let completed = 0;

  for (let i = 0; i < summaries.length; i += BATCH_SIZE) {
    const batch = summaries.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (summary) => {
        const proto = protocolMap.get(summary.slug);
        if (!proto) return null;

        const pools = poolsByProject.get(summary.slug) || [];
        try {
          return await analyzeProtocol(proto, pools);
        } catch (err) {
          console.error(`Deep analysis failed for ${summary.slug}:`, err);
          return null;
        }
      })
    );

    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        batch[idx].analysis = result.value;
      }
    });

    completed += batch.length;
    onProgress?.(completed, summaries.length);
  }

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
        let line = `    ${p.symbol} | ${p.chain} | APY:${p.apy.toFixed(2)}% | TVL:${formatCurrency(p.tvl)} | Stable:${p.stablecoin ? "Y" : "N"} | ID:${p.poolId}`;
        if (p.source === "beefy") line += ` | Source:Beefy | AutoCompound:Y`;
        else if (p.autoCompound) line += ` | BeefyVault:Available`;
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
      securityLine = `\n  CONTRACT SECURITY (GoPlus): Score ${poolWithSecurity.securityScore}/100 | Flags: ${poolWithSecurity.securityFlags || "None"}`;
    }

    // Include market data if available
    let marketLine = "";
    if (s.marketCap) {
      marketLine = `\n  MARKET DATA (CoinGecko): MCap: ${formatCurrency(s.marketCap)}${s.priceChange24h !== undefined ? ` | 24h: ${s.priceChange24h > 0 ? "+" : ""}${s.priceChange24h.toFixed(2)}%` : ""}`;
    }

    return `${s.name} (${s.category}) | TVL:${formatCurrency(s.tvl)} | Audits:${s.audits} | Chains:${s.chains.join(",")}
  ${s.description.slice(0, 120)}${analysisLine}${securityLine}${marketLine}
  Top pools:\n${poolLines}`;
  }).join("\n\n");

  return `You are an expert DeFi investment strategist with deep security knowledge. A user needs a complete investment strategy.
IMPORTANT: Each protocol below has been through AI deep security analysis. USE the legitimacy scores, verdicts, and red flags to make your allocation decisions. Do NOT allocate to protocols with "caution" verdict unless the user has "high" risk appetite. Favor "high_confidence" protocols heavily.

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
- Pick 5-15 pools depending on budget size. More diversification for larger budgets
- CRITICAL: Use the AI safety analysis data. Protocols with legitimacy score below 50 should get minimal or zero allocation for low/medium risk
- For low risk: only allocate to protocols with legitimacy score >= 70 and "high_confidence" or "moderate_confidence" verdict
- For medium risk: protocols with score >= 50 are acceptable
- For high risk: all protocols acceptable but still favor higher scores
- Only use pools from the data above - use the exact poolId, symbol, chain, and apy values
- Include step-by-step instructions on how to actually make each investment
- Be specific about which chain to use and what the user needs (wallet, bridge, etc.)
- Include the legitimacyScore, verdict, and redFlags from the analysis data for each allocation
- If GoPlus contract security data is available, prefer protocols with score >= 70 for low/medium risk. Flag any protocol with honeypot detection or high sell tax
- If a pool has a Beefy auto-compound vault available, mention it in the steps as an alternative investment method
- Pools from Beefy (Source:Beefy) auto-compound yields — note this advantage in reasoning
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

/* ========== STAGE 2 — CODEX REVIEW ========== */

interface CodexCritique {
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

Use "approve" only if you find ZERO high or medium severity concerns. Use "revise" if there are concerns Claude can fix. Use "reject" only if the strategy is fundamentally broken.`;
}

function normalizeCritique(raw: unknown): CodexCritique {
  const r = (raw ?? {}) as Partial<CodexCritique> & Record<string, unknown>;
  const verdict = ["approve", "revise", "reject"].includes(String(r.verdict))
    ? (r.verdict as CodexCritique["verdict"])
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

function critiqueToPoints(c: CodexCritique): CritiquePoint[] {
  return c.concerns.map((concern) => {
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
    };
  });
}

/* ========== STAGE 3 — CLAUDE REVISION ========== */

function buildRevisionPrompt(
  criteria: StrategyCriteria,
  initial: InvestmentStrategy,
  critique: CodexCritique,
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

  const concernsBlock = critique.concerns.length
    ? critique.concerns
        .map(
          (c, i) =>
            `${i + 1}. [${c.severity.toUpperCase()} · ${c.category}] ${c.issue}\n   FIX: ${c.suggestion}`
        )
        .join("\n")
    : "(no specific concerns)";

  const rejectedBlock = critique.rejectedPoolIds.length
    ? `Pool IDs the reviewer wants REMOVED: ${critique.rejectedPoolIds.join(", ")}`
    : "";
  const missingBlock = critique.missingConsiderations.length
    ? `Considerations the reviewer thinks were missed:\n- ${critique.missingConsiderations.join("\n- ")}`
    : "";

  const protocolCatalogue = summaries
    .map((s) => {
      const a = s.analysis;
      const safety = a
        ? `legitimacy=${a.legitimacyScore} verdict=${a.overallVerdict}`
        : "no-deep-analysis";
      const pools = s.pools
        .map(
          (p) =>
            `    ${p.poolId} | ${p.symbol} | ${p.chain} | APY=${p.apy.toFixed(2)}% | TVL=${formatCurrency(p.tvl)} | stable=${p.stablecoin ? "Y" : "N"}`
        )
        .join("\n");
      return `${s.name} (${s.category}) ${safety}\n${pools}`;
    })
    .join("\n\n");

  return `You are revising your DeFi investment strategy after a peer-review by another AI. Your goal: produce ONE final strategy that resolves the reviewer's valid concerns. You may push back IN THE STRATEGY ITSELF (e.g., keep an allocation but justify it more clearly) but you must address every HIGH severity concern.

USER CRITERIA:
- Budget: $${criteria.budget.toLocaleString()}
- Risk appetite: ${criteria.riskAppetite}
- Target APY: ${criteria.targetApyMin}%-${criteria.targetApyMax}%

YOUR INITIAL PROPOSAL:
${initialJson}

REVIEWER (GPT-5.5) FEEDBACK — verdict: ${critique.verdict}
Overall note: ${critique.overallNote}

Concerns to resolve:
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
  "revisionNotes": "<1-2 sentences on what you changed in response to the review and what you kept>"
}

RULES:
- Allocations MUST sum to exactly $${criteria.budget.toLocaleString()}
- Address EVERY high-severity concern; address medium concerns where possible
- If you keep an allocation the reviewer flagged, justify it specifically in that allocation's reasoning
- Use only poolIds from the catalogue
- Return ONLY valid JSON, no other text`;
}

interface RevisedStrategyShape extends InvestmentStrategy {
  revisionNotes?: string;
}

/* ========== HELPERS ========== */

async function invokeClaudeCli(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    const proc = spawn(
      "claude",
      ["-p", "--output-format", "text", "--model", "claude-opus-4-7", "--effort", "max"],
      { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env } }
    );

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`claude CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const output = Buffer.concat(chunks).toString("utf-8");
      if (code === 0 && output.trim()) {
        resolve(output);
      } else {
        const stderr = Buffer.concat(errChunks).toString("utf-8");
        reject(new Error(`claude CLI exited with code ${code}: ${stderr || "no output"}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.stdin.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    proc.stdin.end(prompt);
  });
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
  criteria: StrategyCriteria
): Promise<{ strategy: InvestmentStrategy; poolsScanned: number; protocolsAnalyzed: number; protocolsDeepAnalyzed: number }> {
  // 1. Fetch everything from DeFiLlama
  const [allPools, allProtocols] = await Promise.all([
    fetchAllEnrichedPools(),
    fetchProtocols(),
  ]);

  // 2. Filter pools by APY range
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

    return true;
  });

  // 3. Build protocol summaries
  const summaries = buildProtocolSummaries(qualifying, allProtocols);

  // 4. Limit to top 30 protocols by TVL for deep analysis (keeps it practical)
  const protocolsToAnalyze = summaries.slice(0, 30);

  // 5. Run deep AI security analysis on each protocol
  console.log(`Running deep AI analysis on ${protocolsToAnalyze.length} protocols...`);
  const analyzedSummaries = await deepAnalyzeProtocols(
    protocolsToAnalyze,
    qualifying,
    allProtocols,
    (done, total) => console.log(`  Analyzed ${done}/${total} protocols`)
  );

  const protocolsDeepAnalyzed = analyzedSummaries.filter((s) => s.analysis).length;
  console.log(`Deep analysis complete: ${protocolsDeepAnalyzed} protocols analyzed successfully`);

  // ===== STAGE 1 — Claude proposes initial strategy =====
  console.log("[strategy] stage 1: Claude proposing initial strategy");
  const initialPrompt = buildStrategyPrompt(criteria, analyzedSummaries, qualifying.length);
  const initialOutput = await invokeClaudeCli(initialPrompt, 600_000);
  const initialStrategy = parseStrategyResponse(initialOutput);

  // ===== STAGE 2 — Codex GPT-5.5 reviews =====
  console.log("[strategy] stage 2: Codex reviewing proposal");
  let critique: CodexCritique | null = null;
  let codexError: string | null = null;
  try {
    const critiquePrompt = buildCritiquePrompt(
      criteria,
      initialStrategy,
      analyzedSummaries,
      qualifying.length
    );
    const critiqueOutput = await invokeCodex(critiquePrompt, { timeoutMs: 480_000 });
    const parsed = extractJson<CodexCritique>(critiqueOutput);
    critique = normalizeCritique(parsed);
    console.log(`[strategy] stage 2 done: verdict=${critique.verdict} concerns=${critique.concerns.length}`);
  } catch (err) {
    codexError = err instanceof Error ? err.message : String(err);
    console.warn(`[strategy] stage 2 failed (Codex unavailable): ${codexError}`);
  }

  // If reviewer unavailable, return Claude's proposal with collaboration metadata
  // marking it as single-AI. Don't block the user on Codex outage.
  if (!critique) {
    const collaboration: CollaborationTrail = {
      bothAisAvailable: false,
      critiquePoints: [],
      initialProjectedApy: initialStrategy.projectedApy,
      finalProjectedApy: initialStrategy.projectedApy,
      droppedPoolIds: [],
      addedPoolIds: [],
      codexVerdict: "unavailable",
      revisionNotes: codexError
        ? `Reviewer unavailable (${codexError.slice(0, 200)}); strategy is from Claude only.`
        : "Reviewer unavailable; strategy is from Claude only.",
    };
    return {
      strategy: { ...initialStrategy, collaboration },
      poolsScanned: qualifying.length,
      protocolsAnalyzed: summaries.length,
      protocolsDeepAnalyzed,
    };
  }

  // If Codex approves with no concerns, skip the revision round-trip.
  if (critique.verdict === "approve" && critique.concerns.length === 0) {
    console.log("[strategy] stage 3 skipped: Codex approved without concerns");
    const collaboration: CollaborationTrail = {
      bothAisAvailable: true,
      critiquePoints: [],
      initialProjectedApy: initialStrategy.projectedApy,
      finalProjectedApy: initialStrategy.projectedApy,
      droppedPoolIds: [],
      addedPoolIds: [],
      codexVerdict: "approve",
      revisionNotes: critique.overallNote || "Reviewer approved the initial proposal as-is.",
    };
    return {
      strategy: { ...initialStrategy, collaboration },
      poolsScanned: qualifying.length,
      protocolsAnalyzed: summaries.length,
      protocolsDeepAnalyzed,
    };
  }

  // ===== STAGE 3 — Claude revises in response to critique =====
  console.log("[strategy] stage 3: Claude revising in response to critique");
  let revisedStrategy: InvestmentStrategy = initialStrategy;
  let revisionFailed = false;
  try {
    const revisionPrompt = buildRevisionPrompt(
      criteria,
      initialStrategy,
      critique,
      analyzedSummaries
    );
    const revisedOutput = await invokeClaudeCli(revisionPrompt, 600_000);
    const parsedRevised = parseStrategyResponse(revisedOutput) as RevisedStrategyShape;
    revisedStrategy = parsedRevised;
  } catch (err) {
    revisionFailed = true;
    console.warn(
      `[strategy] stage 3 failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const { dropped, added } = diffPoolIds(initialStrategy, revisedStrategy);
  const droppedSet = new Set(dropped);
  const structuralChange = dropped.length > 0 || added.length > 0;

  const initialPools = new Set(initialStrategy.allocations.map((a) => a.poolId));
  const concernAddressed = (issue: string, suggestion: string): boolean => {
    if (revisionFailed) return false;
    const haystack = `${issue} ${suggestion}`.toLowerCase();
    // Find any poolId from the initial strategy mentioned in this concern
    const mentionedPoolIds = [...initialPools].filter((id) => haystack.includes(id.toLowerCase()));
    if (mentionedPoolIds.length > 0) {
      // Concern is addressed if all mentioned pools were dropped from the revision
      return mentionedPoolIds.every((id) => droppedSet.has(id));
    }
    // Non-pool-specific concern: addressed if the revision made structural changes
    return structuralChange;
  };

  const revisionNotes =
    (revisedStrategy as RevisedStrategyShape).revisionNotes ||
    (revisionFailed
      ? "Revision step failed; serving initial proposal with reviewer concerns attached."
      : critique.overallNote);

  const collaboration: CollaborationTrail = {
    bothAisAvailable: !revisionFailed,
    critiquePoints: critiqueToPoints(critique).map((p) => ({
      ...p,
      addressed: concernAddressed(p.issue, p.suggestion),
    })),
    initialProjectedApy: initialStrategy.projectedApy,
    finalProjectedApy: revisedStrategy.projectedApy,
    droppedPoolIds: dropped,
    addedPoolIds: added,
    codexVerdict: critique.verdict,
    revisionNotes: String(revisionNotes).slice(0, 600),
  };

  return {
    strategy: { ...revisedStrategy, collaboration },
    poolsScanned: qualifying.length,
    protocolsAnalyzed: summaries.length,
    protocolsDeepAnalyzed,
  };
}
