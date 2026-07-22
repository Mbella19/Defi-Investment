import type { ProtocolVerdict } from "@/types/analysis";
import type { StrategyCriteria } from "@/types/strategy";

export const MIN_STRATEGY_ALLOCATIONS = 2;

export interface FeasibilityAnalysis {
  legitimacyScore: number;
  overallVerdict: ProtocolVerdict;
}

export interface FeasibilityPool {
  poolId: string;
  stablecoin: boolean;
}

export interface FeasibilityProtocol {
  slug: string;
  analysis?: FeasibilityAnalysis;
  pools: readonly FeasibilityPool[];
}

const VALID_VERDICTS = new Set<ProtocolVerdict>([
  "high_confidence",
  "moderate_confidence",
  "low_confidence",
  "caution",
]);

/** Keep this predicate aligned with the server-owned checks during catalogue grounding. */
export function isProtocolEligibleForStrategy(
  criteria: StrategyCriteria,
  analysis: FeasibilityAnalysis | undefined,
): boolean {
  if (
    !analysis ||
    !Number.isFinite(analysis.legitimacyScore) ||
    !VALID_VERDICTS.has(analysis.overallVerdict)
  ) {
    return false;
  }
  if (criteria.riskAppetite === "high") return true;
  if (analysis.overallVerdict === "caution" || analysis.legitimacyScore < 50) return false;
  if (
    criteria.riskAppetite === "low" &&
    (analysis.legitimacyScore < 70 || analysis.overallVerdict === "low_confidence")
  ) {
    return false;
  }
  return true;
}

export function isPoolEligibleForStrategy(
  criteria: StrategyCriteria,
  pool: FeasibilityPool,
): boolean {
  if (!pool.poolId.trim()) return false;
  return criteria.assetType !== "stablecoins" || pool.stablecoin;
}

export interface StrategyFeasibility {
  eligiblePoolCount: number;
  eligibleProtocolCount: number;
  eligiblePoolIds: string[];
}

export function assessStrategyFeasibility(
  criteria: StrategyCriteria,
  protocols: readonly FeasibilityProtocol[],
): StrategyFeasibility {
  const poolIds = new Set<string>();
  const protocolSlugs = new Set<string>();

  for (const protocol of protocols) {
    if (!isProtocolEligibleForStrategy(criteria, protocol.analysis)) continue;
    let protocolHasEligiblePool = false;
    for (const pool of protocol.pools) {
      if (!isPoolEligibleForStrategy(criteria, pool)) continue;
      poolIds.add(pool.poolId);
      protocolHasEligiblePool = true;
    }
    if (protocolHasEligiblePool) protocolSlugs.add(protocol.slug);
  }

  return {
    eligiblePoolCount: poolIds.size,
    eligibleProtocolCount: protocolSlugs.size,
    eligiblePoolIds: [...poolIds],
  };
}
