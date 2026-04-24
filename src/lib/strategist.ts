import { spawn } from "child_process";
import type { DefiLlamaPool, DefiLlamaProtocol } from "@/types/pool";
import type { StrategyCriteria, InvestmentStrategy } from "@/types/strategy";
import type { ProtocolAnalysis } from "@/types/analysis";
import { fetchProtocols } from "./defillama";
import { fetchAllEnrichedPools } from "./pool-aggregator";
import { analyzeProtocol } from "./anthropic";
import { formatCurrency } from "./formatters";

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

  // 6. Build prompt with safety data and call Claude for strategy
  const prompt = buildStrategyPrompt(criteria, analyzedSummaries, qualifying.length);

  const stdout = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    const proc = spawn("claude", ["-p", "--output-format", "text", "--model", "claude-opus-4-7", "--effort", "max"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("close", (code) => {
      const output = Buffer.concat(chunks).toString("utf-8");
      if (code === 0 && output.trim()) {
        resolve(output);
      } else {
        const stderr = Buffer.concat(errChunks).toString("utf-8");
        reject(new Error(`claude CLI exited with code ${code}: ${stderr || "no output"}`));
      }
    });

    proc.on("error", reject);

    proc.stdin.write(prompt);
    proc.stdin.end();

    // 10 minute timeout (deep analysis takes longer)
    setTimeout(() => {
      proc.kill();
      reject(new Error("Strategy generation timed out after 10 minutes"));
    }, 600_000);
  });

  const strategy = parseStrategyResponse(stdout);

  return {
    strategy,
    poolsScanned: qualifying.length,
    protocolsAnalyzed: summaries.length,
    protocolsDeepAnalyzed,
  };
}
