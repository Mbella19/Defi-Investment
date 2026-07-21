import type { InvestmentStrategy, StrategyAllocation } from "@/types/strategy";

const VERDICTS = new Set<StrategyAllocation["verdict"]>([
  "high_confidence",
  "moderate_confidence",
  "low_confidence",
  "caution",
]);

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength: number,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => validText(item, maxItemLength))
  );
}

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
    /** Permit server-side budget normalization for an untrusted AI draft. */
    allowBudgetNormalization?: boolean;
  } = {},
): string | undefined {
  if (!Number.isFinite(criteria.budget) || criteria.budget <= 0) {
    return "strategy criteria has invalid budget";
  }
  if (!obj || typeof obj !== "object") return "strategy is not an object";
  const r = obj as Partial<InvestmentStrategy> & Record<string, unknown>;
  for (const [field, maxLength] of [
    ["summary", 8_000],
    ["riskAssessment", 6_000],
    ["diversificationNotes", 6_000],
  ] as const) {
    if (!validText(r[field], maxLength)) return `strategy has invalid ${field}`;
  }
  if (!validStringArray(r.warnings, 30, 2_000)) return "strategy has invalid warnings[]";
  if (!validStringArray(r.steps, 50, 3_000)) return "strategy has invalid steps[]";
  if (!Array.isArray(r.allocations)) return "strategy missing allocations[]";
  if (r.allocations.length < 2) return `strategy has ${r.allocations.length} allocations (need >=2)`;
  if (r.allocations.length > 50) return "strategy has too many allocations (max 50)";
  const poolIds = new Set<string>();
  for (let i = 0; i < r.allocations.length; i++) {
    const a = r.allocations[i] as Partial<StrategyAllocation> | undefined;
    if (!a || typeof a !== "object") return `allocation ${i} not an object`;
    if (typeof a.poolId !== "string" || a.poolId.length === 0 || a.poolId.length > 200)
      return `allocation ${i} missing or invalid poolId`;
    if (poolIds.has(a.poolId)) return `allocation ${i} duplicates poolId ${a.poolId}`;
    poolIds.add(a.poolId);
    for (const field of ["protocol", "chain", "symbol"] as const) {
      const value = a[field];
      if (typeof value !== "string" || value.trim().length === 0 || value.length > 160) {
        return `allocation ${i} has invalid ${field}`;
      }
    }
    if (typeof a.allocationAmount !== "number" || !Number.isFinite(a.allocationAmount) || a.allocationAmount <= 0)
      return `allocation ${i} has invalid allocationAmount`;
    if (typeof a.apy !== "number" || !Number.isFinite(a.apy) || a.apy < 0 || a.apy > 1_000_000)
      return `allocation ${i} has invalid apy`;
    if (typeof a.tvl !== "number" || !Number.isFinite(a.tvl) || a.tvl < 0)
      return `allocation ${i} has invalid tvl`;
    if (typeof a.stablecoin !== "boolean") return `allocation ${i} has invalid stablecoin flag`;
    if (!validText(a.reasoning, 6_000)) return `allocation ${i} has invalid reasoning`;
    if (
      typeof a.legitimacyScore !== "number" ||
      !Number.isFinite(a.legitimacyScore) ||
      a.legitimacyScore < 0 ||
      a.legitimacyScore > 100
    ) return `allocation ${i} has invalid legitimacyScore`;
    if (!VERDICTS.has(a.verdict as StrategyAllocation["verdict"])) {
      return `allocation ${i} has invalid verdict`;
    }
    if (!validStringArray(a.redFlags, 30, 1_000)) {
      return `allocation ${i} has invalid redFlags[]`;
    }
    if (
      a.contractAddress !== undefined &&
      (typeof a.contractAddress !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(a.contractAddress))
    ) return `allocation ${i} has invalid contractAddress`;
    if (a.auditChain !== undefined && !validText(a.auditChain, 160)) {
      return `allocation ${i} has invalid auditChain`;
    }
    if (
      typeof a.allocationPercent !== "number" ||
      !Number.isFinite(a.allocationPercent) ||
      a.allocationPercent <= 0 ||
      a.allocationPercent > 100
    ) return `allocation ${i} has invalid allocationPercent`;
  }
  if (
    r.projectedApy !== undefined &&
    (typeof r.projectedApy !== "number" ||
      !Number.isFinite(r.projectedApy) ||
      r.projectedApy < 0 ||
      r.projectedApy > 1_000_000)
  ) {
    return "strategy has invalid projectedApy";
  }
  if (
    opts.requireProjectedApy &&
    (typeof r.projectedApy !== "number" || !Number.isFinite(r.projectedApy))
  ) {
    return "strategy has invalid projectedApy";
  }
  if (
    typeof r.projectedYearlyReturn !== "number" ||
    !Number.isFinite(r.projectedYearlyReturn) ||
    r.projectedYearlyReturn < 0
  ) {
    return "strategy has invalid projectedYearlyReturn";
  }
  if (
    r.generatedAt !== undefined &&
    (typeof r.generatedAt !== "string" ||
      r.generatedAt.length > 80 ||
      !Number.isFinite(Date.parse(r.generatedAt)))
  ) {
    return "strategy has invalid generatedAt";
  }
  // Tight accounting tolerance. This is a monitoring mandate, but accepting
  // a materially different total makes every return/risk metric misleading.
  if (!opts.allowBudgetNormalization) {
    const sum = r.allocations.reduce(
      (acc: number, a) => acc + ((a as StrategyAllocation).allocationAmount ?? 0),
      0,
    );
    const tolerance = Math.max(0.01, criteria.budget * 0.0005);
    if (Math.abs(sum - criteria.budget) > tolerance) {
      return `allocations sum to $${sum.toFixed(0)} but budget is $${criteria.budget} (off by $${(sum - criteria.budget).toFixed(0)})`;
    }
    const percentSum = r.allocations.reduce(
      (acc: number, a) => acc + ((a as StrategyAllocation).allocationPercent ?? 0),
      0,
    );
    if (Math.abs(percentSum - 100) > 0.1) {
      return `allocation percentages sum to ${percentSum.toFixed(2)} instead of 100`;
    }
  }
  return undefined;
}

export type RiskAppetite = "low" | "medium" | "high";

export function isRiskAppetite(v: unknown): v is RiskAppetite {
  return v === "low" || v === "medium" || v === "high";
}
