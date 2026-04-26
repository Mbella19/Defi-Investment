import { fetchPoolHistory } from "@/lib/defillama";

export interface PoolHistoryPoint {
  /** ISO date `YYYY-MM-DD` (one entry per day, deduped). */
  date: string;
  /** Unix ms at midnight UTC of that day. */
  ts: number;
  /** APY in percent (0–N). Already filtered for finite numbers. */
  apy: number;
  /** TVL in USD at that snapshot. */
  tvlUsd: number;
}

export interface PoolSeries {
  poolId: string;
  points: PoolHistoryPoint[];
}

interface RawChartPoint {
  timestamp: string;
  apy: number | null;
  tvlUsd: number | null;
}

const seriesCache = new Map<string, { series: PoolSeries; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Fetch a pool's daily history and normalise into a clean per-day series.
 * DeFiLlama occasionally returns multiple snapshots on a single calendar day
 * (it samples roughly daily but timestamps drift); we keep the last sample
 * per UTC day so series across pools align cleanly later.
 */
export async function fetchPoolSeries(poolId: string): Promise<PoolSeries | null> {
  const cached = seriesCache.get(poolId);
  if (cached && cached.expiresAt > Date.now()) return cached.series;

  let raw: RawChartPoint[];
  try {
    raw = (await fetchPoolHistory(poolId)) as RawChartPoint[];
  } catch {
    return null;
  }

  if (!Array.isArray(raw) || raw.length === 0) return null;

  const byDay = new Map<string, PoolHistoryPoint>();
  for (const p of raw) {
    if (typeof p.apy !== "number" || !Number.isFinite(p.apy)) continue;
    const dt = new Date(p.timestamp);
    if (Number.isNaN(dt.getTime())) continue;
    const date = dt.toISOString().slice(0, 10);
    const ts = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    byDay.set(date, {
      date,
      ts,
      apy: p.apy,
      tvlUsd: typeof p.tvlUsd === "number" && Number.isFinite(p.tvlUsd) ? p.tvlUsd : 0,
    });
  }

  const points = [...byDay.values()].sort((a, b) => a.ts - b.ts);
  if (points.length === 0) return null;

  const series: PoolSeries = { poolId, points };
  seriesCache.set(poolId, { series, expiresAt: Date.now() + CACHE_TTL_MS });
  return series;
}

/**
 * Fetch many pools in parallel (allSettled — one failure doesn't kill the rest).
 * Returns only the pools that resolved with usable history.
 */
export async function fetchPoolSeriesMany(poolIds: string[]): Promise<PoolSeries[]> {
  const results = await Promise.allSettled(poolIds.map((id) => fetchPoolSeries(id)));
  const out: PoolSeries[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  return out;
}

/**
 * Align multiple pool series to a common set of dates — only days where every
 * pool has a sample are kept. Optionally truncate to the trailing N days of
 * that intersection. Returns rows of `[date, apy_per_pool[]]` in input order.
 */
export function alignSeries(
  series: PoolSeries[],
  trailingDays?: number,
): { dates: string[]; matrix: number[][] } {
  if (series.length === 0) return { dates: [], matrix: [] };

  const dateSets = series.map((s) => new Set(s.points.map((p) => p.date)));
  const intersection = [...dateSets[0]].filter((d) => dateSets.every((set) => set.has(d))).sort();

  const trimmed =
    trailingDays && trailingDays > 0 && intersection.length > trailingDays
      ? intersection.slice(-trailingDays)
      : intersection;

  const lookups = series.map((s) => {
    const m = new Map<string, number>();
    for (const p of s.points) m.set(p.date, p.apy);
    return m;
  });

  const matrix: number[][] = [];
  for (const d of trimmed) {
    matrix.push(lookups.map((m) => m.get(d)!));
  }

  return { dates: trimmed, matrix };
}
