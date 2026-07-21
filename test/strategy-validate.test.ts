import { describe, expect, it } from "vitest";
import { isRiskAppetite, validateStrategyShape } from "@/lib/strategy-validate";

const criteria = { budget: 10_000 };

function validStrategy() {
  return {
    summary: "Diversified stablecoin strategy.",
    projectedApy: 7.5,
    projectedYearlyReturn: 750,
    riskAssessment: "Protocol and smart-contract risk remain.",
    diversificationNotes: "Split across protocols and chains.",
    warnings: ["Yields can change."],
    steps: ["Connect a supported wallet."],
    generatedAt: "2026-07-20T00:00:00.000Z",
    allocations: [
      {
        poolId: "a",
        protocol: "Protocol A",
        chain: "Ethereum",
        symbol: "USDC",
        allocationAmount: 6_000,
        allocationPercent: 60,
        apy: 8,
        tvl: 10_000_000,
        stablecoin: true,
        reasoning: "Large, established market.",
        legitimacyScore: 85,
        verdict: "high_confidence" as const,
        redFlags: ["Smart-contract risk"],
      },
      {
        poolId: "b",
        protocol: "Protocol B",
        chain: "Base",
        symbol: "USDT",
        allocationAmount: 4_000,
        allocationPercent: 40,
        apy: 6.7,
        tvl: 5_000_000,
        stablecoin: true,
        reasoning: "Diversifies chain exposure.",
        legitimacyScore: 80,
        verdict: "moderate_confidence" as const,
        redFlags: ["Bridge risk"],
      },
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

  it("rejects malformed model-controlled narrative fields", () => {
    const badWarnings = validStrategy();
    (badWarnings as { warnings: unknown }).warnings = "not-an-array";
    expect(validateStrategyShape(badWarnings, criteria)).toMatch(/warnings/);

    const badReasoning = validStrategy();
    (badReasoning.allocations[0] as { reasoning: unknown }).reasoning = { injected: true };
    expect(validateStrategyShape(badReasoning, criteria)).toMatch(/reasoning/);

    const badVerdict = validStrategy();
    (badVerdict.allocations[0] as { verdict: unknown }).verdict = "guaranteed_safe";
    expect(validateStrategyShape(badVerdict, criteria)).toMatch(/verdict/);
  });

  it("rejects allocations that miss the budget beyond tolerance", () => {
    const s = validStrategy();
    s.allocations[0].allocationAmount = 8_000; // sum 12k vs 10k budget
    expect(validateStrategyShape(s, criteria)).toMatch(/budget/);
  });

  it("allows only immaterial rounding drift", () => {
    const s = validStrategy();
    s.allocations[0].allocationAmount = 6_004; // sum 10,004 — within 0.05%
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
