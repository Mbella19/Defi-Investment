import { fetchPoolHistory } from "@/lib/defillama";

/**
 * Long-horizon APY stability metrics. Distinct from `apy-forecast.ts` which
 * focuses on the 30/90-day window for forecasting; this module looks at 12-
 * and 24-month windows so safe/balanced strategies can require multi-year
 * stability instead of just a few-month snapshot.
 */
export interface PoolStability {
  poolId: string;
  /** Total months of APY history available (≈ days / 30). */
  monthsOfHistory: number;
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
const cache = new Map<string, { value: PoolStability | null; expiresAt: number }>();

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
    cache.set(poolId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    cache.set(poolId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const series = raw
    .filter((p) => typeof p.apy === "number" && Number.isFinite(p.apy))
    .map((p) => ({ ts: new Date(p.timestamp).getTime(), apy: p.apy as number }))
    .sort((a, b) => a.ts - b.ts);

  if (series.length === 0) {
    cache.set(poolId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const days = series.length;
  const monthsOfHistory = days / 30;

  const last6m = series.slice(-180).map((p) => p.apy);
  const last12m = series.slice(-365).map((p) => p.apy);
  const last24m = series.slice(-730).map((p) => p.apy);

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

  cache.set(poolId, { value: stability, expiresAt: Date.now() + CACHE_TTL_MS });
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
      stability.coefficientOfVariation12m <= 0.6
    );
  }
  // medium / balanced
  return (
    stability.monthsOfHistory >= 6 &&
    stability.coefficientOfVariation6m <= 0.8
  );
}
