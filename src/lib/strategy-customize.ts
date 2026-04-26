import type { InvestmentStrategy, StrategyAllocation } from "@/types/strategy";

export interface AllocationPick {
  poolId: string;
  included: boolean;
  /** User-chosen percent of total budget (0–100). Sum of included picks should = 100. */
  percent: number;
}

export interface CustomizationResult {
  strategy: InvestmentStrategy;
  /** Sum of included percents — caller validates against 100. */
  totalPercent: number;
  /** Pool IDs that were excluded by the user. */
  removedPoolIds: string[];
  /** Pool IDs whose percent moved by ≥0.5 from the AI's original. */
  changedPoolIds: string[];
}

const PERCENT_TOLERANCE = 0.5;

export function makeDefaultPicks(strategy: InvestmentStrategy): AllocationPick[] {
  return strategy.allocations.map((a) => ({
    poolId: a.poolId,
    included: true,
    percent: Number((a.allocationPercent ?? 0).toFixed(2)),
  }));
}

export function totalIncludedPercent(picks: AllocationPick[]): number {
  return picks.filter((p) => p.included).reduce((s, p) => s + (Number.isFinite(p.percent) ? p.percent : 0), 0);
}

/**
 * Returns a new picks array with included percents normalized so they sum to 100.
 * Excluded picks keep their stored percent (ignored at activation).
 */
export function normalizePicks(picks: AllocationPick[]): AllocationPick[] {
  const total = totalIncludedPercent(picks);
  if (total <= 0) return picks;
  const factor = 100 / total;
  return picks.map((p) =>
    p.included ? { ...p, percent: Number((p.percent * factor).toFixed(2)) } : p,
  );
}

/**
 * Build a customized strategy from the AI's original + user picks.
 * - Filters out excluded allocations
 * - Overrides allocationPercent with the user's value
 * - Recomputes allocationAmount = budget * percent / 100
 * - Recomputes projectedApy as the allocation-weighted average APY
 * - Recomputes projectedYearlyReturn from the new APY + budget
 *
 * Caller must verify totalIncludedPercent(picks) is within tolerance of 100
 * before calling — this function trusts the input.
 */
export function customizeStrategy(
  original: InvestmentStrategy,
  picks: AllocationPick[],
  budget: number,
): CustomizationResult {
  const pickByPool = new Map<string, AllocationPick>();
  for (const p of picks) pickByPool.set(p.poolId, p);

  const removedPoolIds: string[] = [];
  const changedPoolIds: string[] = [];

  const customizedAllocations: StrategyAllocation[] = [];
  for (const alloc of original.allocations) {
    const pick = pickByPool.get(alloc.poolId);
    if (!pick || !pick.included) {
      removedPoolIds.push(alloc.poolId);
      continue;
    }
    const newPercent = Number(pick.percent.toFixed(2));
    const newAmount = Math.round((budget * newPercent) / 100);
    if (Math.abs(newPercent - (alloc.allocationPercent ?? 0)) >= PERCENT_TOLERANCE) {
      changedPoolIds.push(alloc.poolId);
    }
    customizedAllocations.push({
      ...alloc,
      allocationPercent: newPercent,
      allocationAmount: newAmount,
    });
  }

  const totalPercent = customizedAllocations.reduce((s, a) => s + a.allocationPercent, 0);
  const weightedApy =
    totalPercent > 0
      ? customizedAllocations.reduce((s, a) => s + a.apy * a.allocationPercent, 0) / totalPercent
      : 0;

  const projectedApy = Number(weightedApy.toFixed(2));
  // Compute yield from actual deployed dollars rather than budget × apy.
  // For 100% allocations these are identical; for leveraged (>100%) or
  // under-deployed (<100%) strategies, the sum-of-yields form is honest.
  const projectedYearlyReturn = Math.round(
    customizedAllocations.reduce((s, a) => s + (a.allocationAmount * a.apy) / 100, 0),
  );

  const customized: InvestmentStrategy = {
    ...original,
    allocations: customizedAllocations,
    projectedApy,
    projectedYearlyReturn,
  };

  return {
    strategy: customized,
    totalPercent,
    removedPoolIds,
    changedPoolIds,
  };
}
