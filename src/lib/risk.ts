import type { DefiLlamaPool } from "@/types/pool";
import type { RiskAppetite } from "@/types/scanner";

export interface RiskProfile {
  minTvl: number;
  apyRange: { min: number; max: number };
  stablecoinsPreferred: boolean;
  ilRiskAcceptable: boolean;
}

export const RISK_PROFILES: Record<RiskAppetite, RiskProfile> = {
  low: {
    minTvl: 10_000_000,
    apyRange: { min: 1, max: 3 },
    stablecoinsPreferred: true,
    ilRiskAcceptable: false,
  },
  medium: {
    minTvl: 1_000_000,
    apyRange: { min: 4, max: 7 },
    stablecoinsPreferred: false,
    ilRiskAcceptable: true,
  },
  high: {
    minTvl: 100_000,
    apyRange: { min: 8, max: 1000 },
    stablecoinsPreferred: false,
    ilRiskAcceptable: true,
  },
};

export function classifyPoolRisk(pool: DefiLlamaPool): RiskAppetite {
  const tvl = pool.tvlUsd || 0;
  const apy = pool.apy || 0;

  if (tvl >= 10_000_000 && apy <= 15 && pool.stablecoin && pool.ilRisk !== "yes") {
    return "low";
  }
  if (tvl >= 1_000_000 && apy <= 30) {
    return "medium";
  }
  return "high";
}

export function getRiskDescription(risk: RiskAppetite): {
  label: string;
  description: string;
  apyRange: string;
  minTvl: string;
} {
  switch (risk) {
    case "low":
      return {
        label: "Conservative",
        description: "Established protocols, stablecoin yields, minimal risk exposure",
        apyRange: "1% - 3%",
        minTvl: "$10M+",
      };
    case "medium":
      return {
        label: "Balanced",
        description: "Mixed asset exposure, moderate yields, proven protocols",
        apyRange: "4% - 7%",
        minTvl: "$1M+",
      };
    case "high":
      return {
        label: "Aggressive",
        description: "Maximum yield potential, higher risk tolerance, emerging protocols",
        apyRange: "8%+",
        minTvl: "$100K+",
      };
  }
}
