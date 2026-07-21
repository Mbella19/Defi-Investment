import { describe, expect, it } from "vitest";
import { passesStabilityGate, type PoolStability } from "@/lib/pool-stability";

function stability(overrides: Partial<PoolStability> = {}): PoolStability {
  return {
    poolId: "p",
    monthsOfHistory: 24,
    observations6m: 183,
    observations12m: 365,
    observations24m: 730,
    apyMean6m: 8,
    apyStdDev6m: 1,
    apyMean12m: 8,
    apyStdDev12m: 1,
    apyMean24m: 8,
    apyStdDev24m: 1,
    coefficientOfVariation6m: 0.12,
    coefficientOfVariation12m: 0.12,
    coefficientOfVariation24m: 0.12,
    worstDrawdown: 2,
    ...overrides,
  };
}

describe("passesStabilityGate", () => {
  it("high risk always passes — even with no history", () => {
    expect(passesStabilityGate(null, "high")).toBe(true);
    expect(passesStabilityGate(stability({ coefficientOfVariation12m: 5 }), "high")).toBe(true);
  });

  it("low risk requires 12 months, dense observations, and 12m CoV ≤ 0.6", () => {
    expect(passesStabilityGate(stability(), "low")).toBe(true);
    expect(passesStabilityGate(stability({ monthsOfHistory: 6 }), "low")).toBe(false);
    expect(passesStabilityGate(stability({ observations12m: 100 }), "low")).toBe(false);
    expect(passesStabilityGate(stability({ coefficientOfVariation12m: 0.7 }), "low")).toBe(false);
    expect(passesStabilityGate(null, "low")).toBe(false);
  });

  it("medium risk requires 6 months, dense observations, and 6m CoV ≤ 0.8", () => {
    expect(passesStabilityGate(stability({ monthsOfHistory: 7 }), "medium")).toBe(true);
    expect(passesStabilityGate(stability({ monthsOfHistory: 3 }), "medium")).toBe(false);
    expect(passesStabilityGate(stability({ observations6m: 50 }), "medium")).toBe(false);
    expect(passesStabilityGate(stability({ coefficientOfVariation6m: 0.9 }), "medium")).toBe(false);
    expect(passesStabilityGate(null, "medium")).toBe(false);
  });
});
