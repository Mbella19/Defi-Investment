import { describe, expect, it } from "vitest";
import {
  customizeStrategy,
  makeDefaultPicks,
  normalizePicks,
  totalIncludedPercent,
} from "@/lib/strategy-customize";
import type { InvestmentStrategy } from "@/types/strategy";

function strategy(): InvestmentStrategy {
  return {
    summary: "s",
    projectedApy: 8,
    projectedYearlyReturn: 800,
    riskAssessment: "r",
    allocations: [
      {
        protocol: "A",
        chain: "Ethereum",
        symbol: "USDC",
        poolId: "a",
        apy: 10,
        tvl: 1e6,
        stablecoin: true,
        allocationAmount: 6_000,
        allocationPercent: 60,
        reasoning: "",
        legitimacyScore: 80,
        verdict: "high_confidence",
        redFlags: [],
      },
      {
        protocol: "B",
        chain: "Base",
        symbol: "ETH",
        poolId: "b",
        apy: 5,
        tvl: 2e6,
        stablecoin: false,
        allocationAmount: 4_000,
        allocationPercent: 40,
        reasoning: "",
        legitimacyScore: 70,
        verdict: "moderate_confidence",
        redFlags: [],
      },
    ],
    diversificationNotes: "",
    warnings: [],
    steps: [],
    generatedAt: new Date().toISOString(),
  } as unknown as InvestmentStrategy;
}

describe("strategy customization", () => {
  it("default picks mirror the AI allocation", () => {
    const picks = makeDefaultPicks(strategy());
    expect(picks).toHaveLength(2);
    expect(totalIncludedPercent(picks)).toBeCloseTo(100, 1);
  });

  it("normalizePicks rescales included picks to 100", () => {
    const picks = makeDefaultPicks(strategy());
    picks[1].included = false;
    const normalized = normalizePicks(picks);
    expect(totalIncludedPercent(normalized)).toBeCloseTo(100, 1);
    expect(normalized[0].percent).toBeCloseTo(100, 1);
  });

  it("customizeStrategy recomputes amounts, APY, and yearly return", () => {
    const original = strategy();
    const picks = [
      { poolId: "a", included: true, percent: 50 },
      { poolId: "b", included: true, percent: 50 },
    ];
    const out = customizeStrategy(original, picks, 10_000);
    expect(out.strategy.allocations.map((a) => a.allocationAmount)).toEqual([5_000, 5_000]);
    expect(out.strategy.projectedApy).toBeCloseTo(7.5, 2);
    expect(out.strategy.projectedYearlyReturn).toBe(750);
    expect(out.changedPoolIds.sort()).toEqual(["a", "b"]);
  });

  it("excluded pools are dropped and reported", () => {
    const out = customizeStrategy(
      strategy(),
      [
        { poolId: "a", included: true, percent: 100 },
        { poolId: "b", included: false, percent: 40 },
      ],
      10_000,
    );
    expect(out.strategy.allocations).toHaveLength(1);
    expect(out.removedPoolIds).toEqual(["b"]);
    expect(out.strategy.projectedApy).toBeCloseTo(10, 2);
  });
});
