import { describe, expect, it } from "vitest";
import { runMonitorScan } from "@/lib/monitor";
import { DEFAULT_ALERT_CONFIG } from "@/types/portfolio";
import type { PortfolioPosition } from "@/types/portfolio";
import type { DefiLlamaPool } from "@/types/pool";
import type { PoolStability } from "@/lib/pool-stability";

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    id: "pos-1",
    poolId: "pool-1",
    protocol: "aave-v3",
    chain: "Ethereum",
    symbol: "USDC",
    investedAmount: 10_000,
    entryApy: 10,
    entryTvl: 5_000_000,
    entryDate: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    riskAppetite: "medium",
    ...overrides,
  };
}

function pool(overrides: Partial<DefiLlamaPool> = {}): DefiLlamaPool {
  return {
    pool: "pool-1",
    chain: "Ethereum",
    project: "aave-v3",
    symbol: "USDC",
    tvlUsd: 5_000_000,
    apy: 10,
    ...overrides,
  } as DefiLlamaPool;
}

function stability(stdDev6m: number): PoolStability {
  return {
    poolId: "pool-1",
    monthsOfHistory: 24,
    observations6m: 183,
    observations12m: 365,
    observations24m: 730,
    apyMean6m: 10,
    apyStdDev6m: stdDev6m,
    apyMean12m: 10,
    apyStdDev12m: stdDev6m,
    apyMean24m: 10,
    apyStdDev24m: stdDev6m,
    coefficientOfVariation6m: stdDev6m / 10,
    coefficientOfVariation12m: stdDev6m / 10,
    coefficientOfVariation24m: stdDev6m / 10,
    worstDrawdown: 5,
  };
}

describe("runMonitorScan", () => {
  it("fires a critical APY-drop alert on a real collapse", () => {
    const alerts = runMonitorScan([position()], [pool({ apy: 3 })], DEFAULT_ALERT_CONFIG);
    const apyAlerts = alerts.filter((a) => a.type === "apy_drop");
    expect(apyAlerts).toHaveLength(1);
    expect(apyAlerts[0].severity).toBe("critical");
  });

  it("suppresses drops inside the pool's historical volatility band", () => {
    // stdev 4 → floor = 2.5 × 4 = 10pp; a 7pp drop is normal noise.
    const stabilityByPool = new Map([["pool-1", stability(4)]]);
    const alerts = runMonitorScan(
      [position()],
      [pool({ apy: 3 })],
      DEFAULT_ALERT_CONFIG,
      stabilityByPool,
    );
    expect(alerts.filter((a) => a.type === "apy_drop")).toHaveLength(0);
  });

  it("suppresses mean-reversion from an entry spike", () => {
    // Entry 15% locked in a spike vs 30d mean of 8; current 7.5 ≥ 0.9×mean.
    const alerts = runMonitorScan(
      [position({ entryApy: 15 })],
      [pool({ apy: 7.5, apyMean30d: 8 })],
      DEFAULT_ALERT_CONFIG,
    );
    expect(alerts.filter((a) => a.type === "apy_drop")).toHaveLength(0);
  });

  it("fires a TVL-drain alert past the critical threshold", () => {
    const alerts = runMonitorScan(
      [position()],
      [pool({ tvlUsd: 1_000_000 })],
      DEFAULT_ALERT_CONFIG,
    );
    const drain = alerts.filter((a) => a.type === "tvl_drain");
    expect(drain).toHaveLength(1);
    expect(drain[0].severity).toBe("critical");
  });

  it("does not turn missing APY data into a false 100% collapse", () => {
    const alerts = runMonitorScan(
      [position()],
      [pool({ apy: null })],
      DEFAULT_ALERT_CONFIG,
    );
    expect(alerts.filter((alert) => alert.type === "apy_drop")).toHaveLength(0);
  });

  it("does not turn invalid TVL data into a false 100% drain", () => {
    const alerts = runMonitorScan(
      [position()],
      [pool({ tvlUsd: Number.NaN })],
      DEFAULT_ALERT_CONFIG,
    );
    expect(alerts.filter((alert) => alert.type === "tvl_drain")).toHaveLength(0);
  });

  it("skips TVL alerts for small entry pools", () => {
    const alerts = runMonitorScan(
      [position({ entryTvl: 500_000 })],
      [pool({ tvlUsd: 100_000 })],
      DEFAULT_ALERT_CONFIG,
    );
    expect(alerts.filter((a) => a.type === "tvl_drain")).toHaveLength(0);
  });

  it("alerts on a missing pool only after the position is 7+ days old", () => {
    const oldPos = position();
    const freshPos = position({ id: "pos-2", poolId: "pool-2", entryDate: new Date().toISOString() });
    const alerts = runMonitorScan([oldPos, freshPos], [], DEFAULT_ALERT_CONFIG);
    expect(alerts.map((a) => a.positionId)).toEqual(["pos-1"]);
  });
});
