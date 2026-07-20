import type { InvestmentStrategy, StrategyAllocation } from "@/types/strategy";

/**
 * Structural validation for a strategy object. Shared by the strategist
 * pipeline (gating AI revisions) and the activation API route (gating
 * client-supplied bodies — an unvalidated activation once inserted rows that
 * crashed the monitor sweep for every user).
 *
 * Returns an error message if malformed; undefined if valid.
 */
export function validateStrategyShape(
  obj: unknown,
  criteria: { budget: number },
  opts: {
    /**
     * The activation route requires a numeric projectedApy (NOT NULL column);
     * the strategist pipeline doesn't — a missing value there is recomputed
     * from the allocations afterwards.
     */
    requireProjectedApy?: boolean;
  } = {},
): string | undefined {
  if (!obj || typeof obj !== "object") return "strategy is not an object";
  const r = obj as Partial<InvestmentStrategy> & Record<string, unknown>;
  if (!Array.isArray(r.allocations)) return "strategy missing allocations[]";
  if (r.allocations.length < 2) return `strategy has ${r.allocations.length} allocations (need >=2)`;
  for (let i = 0; i < r.allocations.length; i++) {
    const a = r.allocations[i] as Partial<StrategyAllocation> | undefined;
    if (!a || typeof a !== "object") return `allocation ${i} not an object`;
    if (typeof a.poolId !== "string" || a.poolId.length === 0) return `allocation ${i} missing poolId`;
    if (typeof a.allocationAmount !== "number" || !Number.isFinite(a.allocationAmount) || a.allocationAmount <= 0)
      return `allocation ${i} has invalid allocationAmount`;
    if (typeof a.apy !== "number" || !Number.isFinite(a.apy)) return `allocation ${i} has invalid apy`;
  }
  if (
    opts.requireProjectedApy &&
    (typeof r.projectedApy !== "number" || !Number.isFinite(r.projectedApy))
  ) {
    return "strategy has invalid projectedApy";
  }
  // Budget tolerance: ±1% OR $50, whichever is larger
  const sum = r.allocations.reduce((acc: number, a) => acc + ((a as StrategyAllocation).allocationAmount ?? 0), 0);
  const tolerance = Math.max(50, criteria.budget * 0.01);
  if (Math.abs(sum - criteria.budget) > tolerance) {
    return `allocations sum to $${sum.toFixed(0)} but budget is $${criteria.budget} (off by $${(sum - criteria.budget).toFixed(0)})`;
  }
  return undefined;
}

export type RiskAppetite = "low" | "medium" | "high";

export function isRiskAppetite(v: unknown): v is RiskAppetite {
  return v === "low" || v === "medium" || v === "high";
}
