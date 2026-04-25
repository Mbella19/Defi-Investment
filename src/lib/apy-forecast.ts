import { fetchPoolHistory } from "@/lib/defillama";

export type ForecastDirection = "rising" | "stable" | "falling" | "volatile" | "unknown";
export type ForecastConfidence = "high" | "medium" | "low";

export interface ApyForecast {
  poolId: string;
  currentApy: number;
  projectedApy30d: number;
  direction: ForecastDirection;
  confidence: ForecastConfidence;
  sampleDays: number;
  details: {
    /** Linear regression slope: APY % change per day. */
    slopePerDay: number;
    /** Coefficient of determination 0–1 (how well the line fits 30d data). */
    rSquared: number;
    /** Standard deviation of last 30d APY samples. */
    stdev30d: number;
    /** 90-day median (mean-reversion anchor). */
    median90d: number;
    /** Weight given to trend extrapolation vs mean reversion (0=all reversion, 1=all trend). */
    trendWeight: number;
  };
}

interface ChartPoint {
  timestamp: string;
  apy: number | null;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { value: ApyForecast; expiresAt: number }>();

const SHORT_WINDOW_DAYS = 30;
const LONG_WINDOW_DAYS = 90;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Fits y = a + b*x by ordinary least squares.
 * Returns slope, intercept, and R² (coefficient of determination).
 */
function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 };
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * xs[i];
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

function classifyDirection(
  current: number,
  projected: number,
  stdev30: number,
  rSquared: number,
): ForecastDirection {
  const diff = projected - current;
  // Volatility hurdle: change must exceed half a stdev to count as a real move.
  const hurdle = Math.max(0.25, 0.5 * stdev30);
  // If the trend is too noisy (low R² + high relative stdev), call it volatile.
  const relStdev = current > 0 ? stdev30 / current : stdev30;
  if (rSquared < 0.15 && relStdev > 0.35) return "volatile";
  if (Math.abs(diff) < hurdle) return "stable";
  return diff > 0 ? "rising" : "falling";
}

function classifyConfidence(
  sampleDays: number,
  rSquared: number,
  stdev30: number,
  current: number,
): ForecastConfidence {
  if (sampleDays < 14) return "low";
  const relStdev = current > 0 ? stdev30 / current : 1;
  if (sampleDays >= 60 && rSquared >= 0.4 && relStdev < 0.25) return "high";
  if (sampleDays >= 30 && relStdev < 0.5) return "medium";
  return "low";
}

export async function forecastPoolApy(poolId: string): Promise<ApyForecast | null> {
  const cached = cache.get(poolId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let raw: ChartPoint[];
  try {
    raw = (await fetchPoolHistory(poolId)) as ChartPoint[];
  } catch {
    return null;
  }

  if (!Array.isArray(raw) || raw.length === 0) return null;

  // Filter null APY samples; sort ascending by timestamp; take recency from tail.
  const series = raw
    .filter((p) => typeof p.apy === "number" && Number.isFinite(p.apy))
    .map((p) => ({ ts: new Date(p.timestamp).getTime(), apy: p.apy as number }))
    .sort((a, b) => a.ts - b.ts);

  if (series.length === 0) return null;

  const recent = series.slice(-SHORT_WINDOW_DAYS).map((p) => p.apy);
  const long = series.slice(-LONG_WINDOW_DAYS).map((p) => p.apy);
  const currentApy = recent[recent.length - 1];

  const { slope, r2 } = linearRegression(recent);
  const stdev30d = stdev(recent);
  const median90d = median(long);

  // Trend extrapolation: project 30 days forward from end-of-series.
  const trendProjection = currentApy + slope * 30;
  // Reversion anchor: pull current toward 90d median, weighted by 1-R².
  // Blend: weight on trend grows with R² (how confidently the line explains recent moves).
  const trendWeight = clamp(r2, 0, 0.85);
  const reversionWeight = 1 - trendWeight;
  const blended = trendWeight * trendProjection + reversionWeight * median90d;

  // Floor at 0 — APY can't go negative; cap absurdly high projections at 4× current.
  const upperCap = Math.max(currentApy * 4, median90d * 2, 50);
  const projectedApy30d = clamp(blended, 0, upperCap);

  const sampleDays = recent.length;
  const direction = classifyDirection(currentApy, projectedApy30d, stdev30d, r2);
  const confidence = classifyConfidence(sampleDays, r2, stdev30d, currentApy);

  const forecast: ApyForecast = {
    poolId,
    currentApy,
    projectedApy30d,
    direction,
    confidence,
    sampleDays,
    details: {
      slopePerDay: slope,
      rSquared: r2,
      stdev30d,
      median90d,
      trendWeight,
    },
  };

  cache.set(poolId, { value: forecast, expiresAt: Date.now() + CACHE_TTL_MS });
  return forecast;
}
