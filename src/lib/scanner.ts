import type { DefiLlamaPool } from "@/types/pool";
import type { ScannerCriteria, ScanResult, ScanResponse, RiskAppetite } from "@/types/scanner";
import { fetchAllPools } from "./defillama";
import { RISK_PROFILES, classifyPoolRisk } from "./risk";

function calculateMatchScore(pool: DefiLlamaPool, criteria: ScannerCriteria): number {
  const profile = RISK_PROFILES[criteria.riskAppetite];
  let score = 0;

  const tvl = pool.tvlUsd || 0;
  const apy = pool.apy || 0;

  // TVL score (0-25 points) - logarithmic scale relative to minimum
  const tvlRatio = tvl / profile.minTvl;
  if (tvlRatio >= 100) score += 25;
  else if (tvlRatio >= 10) score += 20;
  else if (tvlRatio >= 5) score += 15;
  else if (tvlRatio >= 2) score += 10;
  else score += 5;

  // APY sweet-spot score (0-30 points) - bell curve around ideal target
  const idealApy = criteria.riskAppetite === "low" ? 6
    : criteria.riskAppetite === "medium" ? 12
    : 25;
  const apyDistance = Math.abs(apy - idealApy) / idealApy;
  if (apyDistance < 0.2) score += 30;
  else if (apyDistance < 0.4) score += 25;
  else if (apyDistance < 0.6) score += 20;
  else if (apyDistance < 0.8) score += 15;
  else if (apyDistance < 1.0) score += 10;
  else score += 5;

  // APY stability (0-20 points) - lower 7d volatility is better
  if (pool.apyPct7D !== null) {
    const volatility = Math.abs(pool.apyPct7D);
    if (volatility < 2) score += 20;
    else if (volatility < 5) score += 16;
    else if (volatility < 10) score += 12;
    else if (volatility < 20) score += 8;
    else score += 3;
  } else {
    score += 10; // neutral if no data
  }

  // Stablecoin alignment (0-10 points)
  if (criteria.assetType === "stablecoins" && pool.stablecoin) {
    score += 10;
  } else if (criteria.assetType === "all") {
    score += 7;
  } else {
    score += 3;
  }

  // IL risk (0-10 points)
  if (pool.ilRisk !== "yes") {
    score += 10;
  } else if (criteria.riskAppetite === "high") {
    score += 5;
  }

  // Volume bonus (0-5 points) - pools with trading volume are healthier
  if (pool.volumeUsd7d && pool.volumeUsd7d > 1_000_000) score += 5;
  else if (pool.volumeUsd7d && pool.volumeUsd7d > 100_000) score += 3;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function allocateBudget(results: ScanResult[], budget: number, riskAppetite: RiskAppetite): void {
  if (results.length === 0) return;

  const maxConcentration =
    riskAppetite === "low" ? 0.20 : riskAppetite === "medium" ? 0.30 : 0.40;

  const totalScore = results.reduce((sum, r) => sum + r.matchScore, 0);
  if (totalScore === 0) return;

  let remainingBudget = budget;

  for (const result of results) {
    const weight = result.matchScore / totalScore;
    let allocation = Math.round(budget * weight);
    allocation = Math.min(allocation, Math.round(budget * maxConcentration));
    allocation = Math.min(allocation, remainingBudget);
    result.suggestedAllocation = allocation;
    remainingBudget -= allocation;
  }

  if (remainingBudget > 0 && results.length > 0) {
    results[0].suggestedAllocation += remainingBudget;
  }
}

export async function scanPools(criteria: ScannerCriteria): Promise<ScanResponse> {
  const allPools = await fetchAllPools();
  const profile = RISK_PROFILES[criteria.riskAppetite];

  const filtered = allPools.filter((pool) => {
    if (!pool.apy || pool.apy <= 0) return false;
    if (!pool.tvlUsd || pool.tvlUsd <= 0) return false;

    if (criteria.chain && pool.chain.toLowerCase() !== criteria.chain.toLowerCase()) {
      return false;
    }

    if (criteria.assetType === "stablecoins" && !pool.stablecoin) {
      return false;
    }

    if (pool.tvlUsd < profile.minTvl) return false;
    if (pool.apy < profile.apyRange.min || pool.apy > profile.apyRange.max) return false;
    if (!profile.ilRiskAcceptable && pool.ilRisk === "yes") return false;

    return true;
  });

  const scored: ScanResult[] = filtered.map((pool) => ({
    pool,
    riskClassification: classifyPoolRisk(pool),
    matchScore: calculateMatchScore(pool, criteria),
    suggestedAllocation: 0,
  }));

  // Sort by score descending, then APY descending
  scored.sort((a, b) => b.matchScore - a.matchScore || (b.pool.apy! - a.pool.apy!));

  allocateBudget(scored, criteria.budget, criteria.riskAppetite);

  return {
    criteria,
    results: scored,
    totalMatchingPools: filtered.length,
    scannedAt: new Date().toISOString(),
  };
}
