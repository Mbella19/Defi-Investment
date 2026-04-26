import { fetchAllPools, fetchPoolHistory } from "@/lib/defillama";
import type { DefiLlamaPool } from "@/types/pool";

export const dynamic = "force-dynamic";

interface ChartPoint {
  timestamp: string;
  apy: number | null;
  tvlUsd?: number | null;
}

export interface LivePool {
  poolId: string;
  symbol: string;
  protocol: string;
  chain: string;
  tvlUsd: number;
  apy: number;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  category: string;
}

export interface LiveYieldsPayload {
  generatedAt: string;
  poolCount: number;
  chainCount: number;
  totalTvl: number;
  top50Avg30dApy: number;
  delta24h: number;
  series: { timestamp: number; apy: number }[];
  pools: LivePool[];
}

const CACHE_TTL_MS = 60_000;
const HISTORY_TTL_MS = 30 * 60_000;
const HISTORY_TOP_N = 5;

let payloadCache: { value: LiveYieldsPayload; expiresAt: number } | null = null;
let historyCache: { value: { timestamp: number; apy: number }[]; expiresAt: number } | null = null;

const TYPE_BY_CATEGORY: Record<string, string> = {
  "Lending": "Lending",
  "CDP": "Lending",
  "Liquid Staking": "LST",
  "Liquid Restaking": "LST",
  "Dexes": "LP",
  "Yield Aggregator": "Yield",
  "Yield": "Yield",
  "Synthetics": "Synth",
  "Algo-Stables": "Synth",
};

function categorize(project: string, poolMeta: string | null): string {
  const meta = (poolMeta || "").toLowerCase();
  if (meta.includes("lending") || meta.includes("borrow")) return "Lending";
  if (meta.includes("staking") || meta.includes("lst")) return "LST";
  if (meta.includes("lp") || meta.includes("pool") || meta.includes("amm")) return "LP";
  if (meta.includes("synth")) return "Synth";
  return TYPE_BY_CATEGORY[project] ?? "Yield";
}

async function buildSeries(topPools: DefiLlamaPool[]): Promise<{ timestamp: number; apy: number }[]> {
  if (historyCache && historyCache.expiresAt > Date.now()) return historyCache.value;

  const ids = topPools
    .filter((p) => typeof p.pool === "string" && p.pool.length > 0)
    .slice(0, HISTORY_TOP_N)
    .map((p) => p.pool);

  const histories = await Promise.allSettled(ids.map((id) => fetchPoolHistory(id)));

  const buckets = new Map<number, { sum: number; count: number }>();
  for (const r of histories) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    for (const point of r.value as ChartPoint[]) {
      const apy = point.apy;
      if (typeof apy !== "number" || !Number.isFinite(apy)) continue;
      const ts = new Date(point.timestamp).getTime();
      if (!Number.isFinite(ts)) continue;
      const dayBucket = Math.floor(ts / 86_400_000) * 86_400_000;
      const cur = buckets.get(dayBucket) ?? { sum: 0, count: 0 };
      cur.sum += apy;
      cur.count += 1;
      buckets.set(dayBucket, cur);
    }
  }

  const series = Array.from(buckets.entries())
    .map(([ts, v]) => ({ timestamp: ts, apy: v.sum / v.count }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-365);

  historyCache = { value: series, expiresAt: Date.now() + HISTORY_TTL_MS };
  return series;
}

async function buildPayload(): Promise<LiveYieldsPayload> {
  const allPools = await fetchAllPools();
  const valid = allPools.filter(
    (p) =>
      typeof p.apy === "number" &&
      Number.isFinite(p.apy) &&
      typeof p.tvlUsd === "number" &&
      p.tvlUsd > 100_000,
  );

  const totalTvl = valid.reduce((s, p) => s + (p.tvlUsd || 0), 0);
  const chainSet = new Set<string>();
  for (const p of valid) if (p.chain) chainSet.add(p.chain);

  const sortedByTvl = [...valid].sort((a, b) => b.tvlUsd - a.tvlUsd);
  const top50 = sortedByTvl.slice(0, 50);
  const apySum = top50.reduce((s, p) => s + (p.apy || 0), 0);
  const top50Avg30dApy = top50.length > 0 ? apySum / top50.length : 0;

  const series = await buildSeries(sortedByTvl).catch(() => []);

  let delta24h = 0;
  if (series.length >= 2) {
    const last = series[series.length - 1].apy;
    const dayAgo = series[series.length - 2].apy;
    delta24h = last - dayAgo;
  }

  const pools: LivePool[] = sortedByTvl.slice(0, 200).map((p) => ({
    poolId: p.pool,
    symbol: p.symbol,
    protocol: p.project,
    chain: p.chain,
    tvlUsd: p.tvlUsd,
    apy: p.apy ?? 0,
    apyPct1D: p.apyPct1D,
    apyPct7D: p.apyPct7D,
    apyPct30D: p.apyPct30D,
    stablecoin: !!p.stablecoin,
    category: categorize(p.project, p.poolMeta),
  }));

  return {
    generatedAt: new Date().toISOString(),
    poolCount: valid.length,
    chainCount: chainSet.size,
    totalTvl,
    top50Avg30dApy,
    delta24h,
    series,
    pools,
  };
}

export async function GET() {
  if (payloadCache && payloadCache.expiresAt > Date.now()) {
    return Response.json(payloadCache.value);
  }
  try {
    const payload = await buildPayload();
    payloadCache = { value: payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return Response.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "live yields fetch failed";
    if (payloadCache) {
      return Response.json({ ...payloadCache.value, stale: true, error: msg });
    }
    return Response.json({ error: msg }, { status: 502 });
  }
}
