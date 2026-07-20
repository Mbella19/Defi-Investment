import { describe, expect, it } from "vitest";
import { isRiskAppetite, validateStrategyShape } from "@/lib/strategy-validate";

const criteria = { budget: 10_000 };

function validStrategy() {
  return {
    projectedApy: 7.5,
    allocations: [
      { poolId: "a", allocationAmount: 6_000, apy: 8 },
      { poolId: "b", allocationAmount: 4_000, apy: 6.7 },
    ],
  };
}

describe("validateStrategyShape", () => {
  it("accepts a well-formed strategy", () => {
    expect(validateStrategyShape(validStrategy(), criteria)).toBeUndefined();
  });

  it("rejects non-objects and missing allocations", () => {
    expect(validateStrategyShape(null, criteria)).toBeTruthy();
    expect(validateStrategyShape("x", criteria)).toBeTruthy();
    expect(validateStrategyShape({ allocations: "nope" }, criteria)).toBeTruthy();
  });

  it("rejects fewer than 2 allocations", () => {
    const s = validStrategy();
    s.allocations = [s.allocations[0]];
    expect(validateStrategyShape(s, criteria)).toMatch(/allocations/);
  });

  it("rejects allocations with bad fields", () => {
    const noPool = validStrategy();
    (noPool.allocations[0] as { poolId?: string }).poolId = undefined;
    expect(validateStrategyShape(noPool, criteria)).toMatch(/poolId/);

    const badAmount = validStrategy();
    (badAmount.allocations[1] as { allocationAmount: unknown }).allocationAmount = "4000";
    expect(validateStrategyShape(badAmount, criteria)).toMatch(/allocationAmount/);

    const badApy = validStrategy();
    (badApy.allocations[0] as { apy: unknown }).apy = Number.NaN;
    expect(validateStrategyShape(badApy, criteria)).toMatch(/apy/);
  });

  it("rejects allocations that miss the budget beyond tolerance", () => {
    const s = validStrategy();
    s.allocations[0].allocationAmount = 8_000; // sum 12k vs 10k budget
    expect(validateStrategyShape(s, criteria)).toMatch(/budget/);
  });

  it("allows ±1%/$50 budget drift", () => {
    const s = validStrategy();
    s.allocations[0].allocationAmount = 6_080; // sum 10,080 — within 1%
    expect(validateStrategyShape(s, criteria)).toBeUndefined();
  });

  it("enforces projectedApy only when required", () => {
    const s = validStrategy();
    (s as { projectedApy?: unknown }).projectedApy = undefined;
    expect(validateStrategyShape(s, criteria)).toBeUndefined();
    expect(validateStrategyShape(s, criteria, { requireProjectedApy: true })).toMatch(
      /projectedApy/,
    );
  });
});

describe("isRiskAppetite", () => {
  it("accepts only the three known values", () => {
    expect(isRiskAppetite("low")).toBe(true);
    expect(isRiskAppetite("medium")).toBe(true);
    expect(isRiskAppetite("high")).toBe(true);
    expect(isRiskAppetite("aggressive")).toBe(false);
    expect(isRiskAppetite(undefined)).toBe(false);
    expect(isRiskAppetite(3)).toBe(false);
  });
});
