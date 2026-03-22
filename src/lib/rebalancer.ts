import type { PortfolioPosition } from "@/types/portfolio";
import type { DefiLlamaPool } from "@/types/pool";
import { classifyPoolRisk } from "./risk";

export interface RebalanceSuggestion {
  positionId: string;
  currentProtocol: string;
  currentSymbol: string;
  currentChain: string;
  currentApy: number;
  suggestedPoolId: string;
  suggestedProtocol: string;
  suggestedSymbol: string;
  suggestedChain: string;
  suggestedApy: number;
  suggestedTvl: number;
  suggestedStablecoin: boolean;
  apyImprovement: number;
  investedAmount: number;
  yearlyGain: number;
  reason: string;
}

export function generateRebalanceSuggestions(
  positions: PortfolioPosition[],
  allPools: DefiLlamaPool[],
  currentPoolMap: Map<string, DefiLlamaPool>
): RebalanceSuggestion[] {
  const suggestions: RebalanceSuggestion[] = [];

  for (const pos of positions) {
    const currentPool = currentPoolMap.get(pos.poolId);
    const currentApy = currentPool?.apy || 0;

    // Find better pools with similar or lower risk
    const candidates = allPools
      .filter((p) => {
        if (p.pool === pos.poolId) return false;
        if (!p.apy || p.apy <= currentApy * 1.2) return false; // At least 20% better APY
        if (!p.tvlUsd || p.tvlUsd < 500_000) return false;

        // Match risk level
        const poolRisk = classifyPoolRisk(p);
        if (pos.riskAppetite === "low" && poolRisk !== "low") return false;
        if (pos.riskAppetite === "medium" && poolRisk === "high") return false;

        // Prefer same stablecoin type
        if (currentPool?.stablecoin && !p.stablecoin) return false;

        return true;
      })
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, 3); // Top 3 alternatives

    for (const candidate of candidates) {
      const apyImprovement = (candidate.apy || 0) - currentApy;
      const yearlyGain = pos.investedAmount * (apyImprovement / 100);

      let reason = `${candidate.apy!.toFixed(2)}% APY vs your current ${currentApy.toFixed(2)}%`;
      if (candidate.tvlUsd > (currentPool?.tvlUsd || 0)) {
        reason += ". Higher TVL provides more security";
      }
      if (candidate.stablecoin) {
        reason += ". Stablecoin pool reduces volatility risk";
      }

      suggestions.push({
        positionId: pos.id,
        currentProtocol: pos.protocol,
        currentSymbol: pos.symbol,
        currentChain: pos.chain,
        currentApy,
        suggestedPoolId: candidate.pool,
        suggestedProtocol: candidate.project,
        suggestedSymbol: candidate.symbol,
        suggestedChain: candidate.chain,
        suggestedApy: candidate.apy || 0,
        suggestedTvl: candidate.tvlUsd,
        suggestedStablecoin: candidate.stablecoin,
        apyImprovement: Math.round(apyImprovement * 100) / 100,
        investedAmount: pos.investedAmount,
        yearlyGain: Math.round(yearlyGain * 100) / 100,
        reason,
      });
    }
  }

  // Sort by yearly gain descending
  return suggestions.sort((a, b) => b.yearlyGain - a.yearlyGain);
}
