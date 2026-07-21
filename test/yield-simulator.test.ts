import { describe, expect, it } from "vitest";
import { simulate, type PoolMeta } from "@/lib/tools/yield-simulator";
import type { PoolSeries } from "@/lib/tools/pool-history";

function series(poolId: string, days = 60, apy = 0): PoolSeries {
  return {
    poolId,
    points: Array.from({ length: days }, (_, index) => {
      const ts = Date.UTC(2026, 0, index + 1);
      return {
        date: new Date(ts).toISOString().slice(0, 10),
        ts,
        apy,
        tvlUsd: 10_000_000,
      };
    }),
  };
}

const stableMeta: PoolMeta = {
  symbol: "USDC",
  protocol: "Aave",
  chain: "Ethereum",
  stablecoin: true,
};

describe("scenario simulator", () => {
  it("models an immediate stablecoin depeg as drawdown from original principal", () => {
    const result = simulate({
      allocations: [{ poolId: "stable", weightPct: 100 }],
      seriesById: new Map([["stable", series("stable")]]),
      metaById: new Map([["stable", stableMeta]]),
      principalUsd: 10_000,
      horizonDays: 30,
      scenario: "depeg",
    });

    expect(result.series[0].totalUsd).toBe(10_000);
    expect(result.series[1].totalUsd).toBe(9_500);
    expect(result.maxDrawdownPct).toBeCloseTo(-5, 8);
    expect(result.scenarioImpactUsd).toBeCloseTo(-500, 8);
  });

  it("is deterministic and reports its bootstrap methodology", () => {
    const args = {
      allocations: [{ poolId: "volatile", weightPct: 100 }],
      seriesById: new Map([["volatile", series("volatile", 90, 8)]]),
      metaById: new Map([
        [
          "volatile",
          { ...stableMeta, symbol: "ETH", stablecoin: false },
        ],
      ]),
      principalUsd: 25_000,
      horizonDays: 90,
      scenario: "baseline" as const,
    };
    const first = simulate(args);
    const second = simulate(args);
    expect(first.series).toEqual(second.series);
    expect(first.methodology).toBe("deterministic_block_bootstrap");
    expect(first.historyDaysByPool.volatile).toBe(90);
  });

  it("refuses pools with fewer than 30 observations", () => {
    expect(() =>
      simulate({
        allocations: [{ poolId: "short", weightPct: 100 }],
        seriesById: new Map([["short", series("short", 29, 5)]]),
        metaById: new Map([["short", stableMeta]]),
        principalUsd: 10_000,
        horizonDays: 30,
        scenario: "baseline",
      }),
    ).toThrow("enough history");
  });

  it("reports the same winsorized APY range used by the model", () => {
    const result = simulate({
      allocations: [{ poolId: "launch", weightPct: 100 }],
      seriesById: new Map([["launch", series("launch", 60, 50_000)]]),
      metaById: new Map([["launch", stableMeta]]),
      principalUsd: 10_000,
      horizonDays: 30,
      scenario: "baseline",
    });

    expect(result.weightedApy).toBe(1_000);
    expect(result.poolBreakdown[0].meanApy).toBe(1_000);
  });
});
