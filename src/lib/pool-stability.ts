import { fetchPoolHistory } from "@/lib/defillama";
import { boundCache } from "@/lib/cache-utils";

/**
 * Long-horizon APY stability metrics over 6-, 12-, and 24-month windows so
 * safe/balanced strategies can require sustained history instead of a short
 * snapshot. These are descriptive stability metrics, not return forecasts.
 */
export interface PoolStability {
  poolId: string;
  /** Total months of APY history available (≈ days / 30). */
  monthsOfHistory: number;
  observations6m: number;
  observations12m: number;
  observations24m: number;
  /** Mean APY over the trailing 6 months. */
  apyMean6m: number;
  /** Standard deviation of APY over the trailing 6 months. */
  apyStdDev6m: number;
  /** Mean APY over the trailing 12 months. */
  apyMean12m: number;
  /** Standard deviation of APY over the trailing 12 months. */
  apyStdDev12m: number;
  /** Mean APY over the trailing 24 months. */
  apyMean24m: number;
  /** Standard deviation of APY over the trailing 24 months. */
  apyStdDev24m: number;
  /**
   * Coefficient of variation = stdDev / mean. Unitless stability score; lower
   * is steadier. Use this for cross-pool comparison since absolute stdev is
   * meaningless without normalising by APY level.
   */
  coefficientOfVariation6m: number;
  coefficientOfVariation12m: number;
  coefficientOfVariation24m: number;
  /** Largest peak-to-trough APY drawdown over the available history (percent points). */
  worstDrawdown: number;
}

interface ChartPoint {
  timestamp: string;
  apy: number | null;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 2_000;
const cache = new Map<string, { value: PoolStability | null; expiresAt: number }>();

function cacheResult(poolId: string, value: PoolStability | null): void {
  cache.set(poolId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  boundCache(cache, CACHE_MAX);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > worst) worst = dd;
  }
  return worst;
}

export async function getPoolStability(poolId: string): Promise<PoolStability | null> {
  const cached = cache.get(poolId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let raw: ChartPoint[];
  try {
    raw = (await fetchPoolHistory(poolId)) as ChartPoint[];
  } catch {
    cacheResult(poolId, null);
    return null;
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    cacheResult(poolId, null);
    return null;
  }

  const byDay = new Map<number, { ts: number; apy: number }>();
  for (const point of raw) {
    if (!point || typeof point !== "object") continue;
    if (typeof point.apy !== "number" || !Number.isFinite(point.apy)) continue;
    const parsed = new Date(point.timestamp);
    if (!Number.isFinite(parsed.getTime())) continue;
    const ts = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    byDay.set(ts, { ts, apy: point.apy });
  }
  const series = [...byDay.values()].sort((a, b) => a.ts - b.ts);

  if (series.length === 0) {
    cacheResult(poolId, null);
    return null;
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const latestTs = series[series.length - 1].ts;
  const spanDays = Math.max(1, (latestTs - series[0].ts) / DAY_MS + 1);
  const monthsOfHistory = spanDays / 30.4375;

  const windowValues = (days: number): number[] =>
    series
      .filter((point) => point.ts >= latestTs - (days - 1) * DAY_MS)
      .map((point) => point.apy);
  const last6m = windowValues(183);
  const last12m = windowValues(365);
  const last24m = windowValues(730);

  const apyMean6m = mean(last6m);
  const apyStdDev6m = stdev(last6m);
  const apyMean12m = mean(last12m);
  const apyStdDev12m = stdev(last12m);
  const apyMean24m = mean(last24m);
  const apyStdDev24m = stdev(last24m);

  const coefficientOfVariation6m = apyMean6m > 0 ? apyStdDev6m / apyMean6m : Infinity;
  const coefficientOfVariation12m = apyMean12m > 0 ? apyStdDev12m / apyMean12m : Infinity;
  const coefficientOfVariation24m = apyMean24m > 0 ? apyStdDev24m / apyMean24m : Infinity;

  const stability: PoolStability = {
    poolId,
    monthsOfHistory: Math.round(monthsOfHistory * 10) / 10,
    observations6m: last6m.length,
    observations12m: last12m.length,
    observations24m: last24m.length,
    apyMean6m: Math.round(apyMean6m * 100) / 100,
    apyStdDev6m: Math.round(apyStdDev6m * 100) / 100,
    apyMean12m: Math.round(apyMean12m * 100) / 100,
    apyStdDev12m: Math.round(apyStdDev12m * 100) / 100,
    apyMean24m: Math.round(apyMean24m * 100) / 100,
    apyStdDev24m: Math.round(apyStdDev24m * 100) / 100,
    coefficientOfVariation6m:
      Number.isFinite(coefficientOfVariation6m)
        ? Math.round(coefficientOfVariation6m * 100) / 100
        : 99,
    coefficientOfVariation12m:
      Number.isFinite(coefficientOfVariation12m)
        ? Math.round(coefficientOfVariation12m * 100) / 100
        : 99,
    coefficientOfVariation24m:
      Number.isFinite(coefficientOfVariation24m)
        ? Math.round(coefficientOfVariation24m * 100) / 100
        : 99,
    worstDrawdown: Math.round(maxDrawdown(last24m) * 100) / 100,
  };

  cacheResult(poolId, stability);
  return stability;
}

/**
 * Risk-tier hard filter. Returns true if the pool meets the minimum long-term
 * stability bar for the given risk appetite. Pools without enough history are
 * REJECTED for safe/balanced (we can't verify multi-year stability without
 * the data) and ACCEPTED for high-risk (a few months is fine per spec).
 */
export function passesStabilityGate(
  stability: PoolStability | null,
  riskAppetite: "low" | "medium" | "high",
): boolean {
  if (riskAppetite === "high") return true;
  if (!stability) return false;

  if (riskAppetite === "low") {
    return (
      stability.monthsOfHistory >= 12 &&
      stability.observations12m >= 300 &&
      stability.coefficientOfVariation12m <= 0.6
    );
  }
  // medium / balanced
  return (
    stability.monthsOfHistory >= 6 &&
    stability.observations6m >= 150 &&
    stability.coefficientOfVariation6m <= 0.8
  );
}
