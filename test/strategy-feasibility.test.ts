import { describe, expect, it } from "vitest";
import {
  assessStrategyFeasibility,
  isProtocolEligibleForStrategy,
  MIN_STRATEGY_ALLOCATIONS,
  type FeasibilityProtocol,
} from "@/lib/strategy-feasibility";
import {
  criteriaTooRestrictiveError,
  describeStrategyFailure,
  insufficientReviewedProtocolsError,
} from "@/lib/strategy-errors";
import type { StrategyCriteria } from "@/types/strategy";

const mediumStable: StrategyCriteria = {
  budget: 100_000,
  riskAppetite: "medium",
  targetApyMin: 10,
  targetApyMax: 30,
  assetType: "stablecoins",
};

const protocols: FeasibilityProtocol[] = [
  {
    slug: "morpho-blue",
    analysis: { legitimacyScore: 68, overallVerdict: "moderate_confidence" },
    pools: [
      { poolId: "morpho-usdc", stablecoin: true },
      { poolId: "morpho-eth", stablecoin: false },
    ],
  },
  {
    slug: "yearn-finance",
    analysis: { legitimacyScore: 58, overallVerdict: "caution" },
    pools: [{ poolId: "yearn-usdc", stablecoin: true }],
  },
  {
    slug: "lagoon",
    analysis: { legitimacyScore: 48, overallVerdict: "moderate_confidence" },
    pools: [{ poolId: "lagoon-usdc", stablecoin: true }],
  },
];

describe("strategy feasibility", () => {
  it("detects the exact one-market medium-risk stablecoin edge case", () => {
    expect(assessStrategyFeasibility(mediumStable, protocols)).toEqual({
      eligiblePoolCount: 1,
      eligibleProtocolCount: 1,
      eligiblePoolIds: ["morpho-usdc"],
    });
  });

  it("keeps the feasibility safety floor aligned with risk semantics", () => {
    expect(
      isProtocolEligibleForStrategy(mediumStable, {
        legitimacyScore: 58,
        overallVerdict: "caution",
      }),
    ).toBe(false);
    expect(
      isProtocolEligibleForStrategy(
        { ...mediumStable, riskAppetite: "high" },
        { legitimacyScore: 20, overallVerdict: "caution" },
      ),
    ).toBe(true);
    expect(
      isProtocolEligibleForStrategy(
        { ...mediumStable, riskAppetite: "low" },
        { legitimacyScore: 69, overallVerdict: "moderate_confidence" },
      ),
    ).toBe(false);
  });

  it("counts duplicate pool ids once", () => {
    const duplicated = [
      protocols[0],
      {
        slug: "duplicate-feed-row",
        analysis: { legitimacyScore: 80, overallVerdict: "high_confidence" as const },
        pools: [{ poolId: "morpho-usdc", stablecoin: true }],
      },
    ];
    expect(assessStrategyFeasibility(mediumStable, duplicated).eligiblePoolCount).toBe(1);
  });

  it("classifies restrictive criteria as actionable and non-retryable", () => {
    const error = criteriaTooRestrictiveError({
      criteria: mediumStable,
      eligiblePoolCount: 1,
      eligibleProtocolCount: 1,
      requiredPoolCount: MIN_STRATEGY_ALLOCATIONS,
    });
    const failure = describeStrategyFailure(error);

    expect(failure.retryable).toBe(false);
    expect(failure.code).toBe("criteria_too_restrictive");
    expect(failure.publicMessage).toContain("Only 1 market passed");
    expect(failure.publicMessage).toContain("turn off “Stablecoin sleeves only”");
  });

  it("keeps unknown provider and parsing failures retryable but generic", () => {
    const failure = describeStrategyFailure(new Error("provider leaked internal detail"));
    expect(failure.retryable).toBe(true);
    expect(failure.code).toBe("generation_failed");
    expect(failure.publicMessage).not.toContain("leaked internal detail");
  });

  it("treats a fully analyzed one-protocol catalogue as non-retryable", () => {
    const failure = describeStrategyFailure(
      insufficientReviewedProtocolsError({
        criteria: mediumStable,
        eligibleProtocolCount: 1,
        requiredProtocolCount: 2,
      }),
    );
    expect(failure.retryable).toBe(false);
    expect(failure.publicMessage).toContain("Only 1 independently reviewed protocol passed");
  });
});
