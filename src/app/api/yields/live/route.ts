import { fetchAllPools, fetchProtocols } from "@/lib/defillama";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

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
  pools: LivePool[];
}

const CACHE_TTL_MS = 60_000;

let payloadCache: { value: LiveYieldsPayload; expiresAt: number } | null = null;
let payloadInflight: Promise<LiveYieldsPayload> | null = null;

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

function categorize(
  protocolCategory: string | undefined,
  project: string,
  poolMeta: string | null,
): string {
  if (protocolCategory && TYPE_BY_CATEGORY[protocolCategory]) {
    return TYPE_BY_CATEGORY[protocolCategory];
  }
  const text = `${project} ${poolMeta || ""}`.toLowerCase();
  if (text.includes("lending") || text.includes("borrow")) return "Lending";
  if (text.includes("staking") || text.includes("restaking") || text.includes("lst")) return "LST";
  if (text.includes("lp") || text.includes("pool") || text.includes("amm")) return "LP";
  if (text.includes("synth")) return "Synth";
  return "Yield";
}

async function buildPayload(): Promise<LiveYieldsPayload> {
  const [allPools, protocols] = await Promise.all([
    fetchAllPools(),
    fetchProtocols().catch(() => []),
  ]);
  const categoryByProject = new Map(protocols.map((protocol) => [protocol.slug, protocol.category]));
  const valid = allPools.filter(
    (p) =>
      typeof p.apy === "number" &&
      Number.isFinite(p.apy) &&
      typeof p.tvlUsd === "number" &&
      p.tvlUsd > 100_000,
  );

  const sortedByTvl = [...valid].sort((a, b) => b.tvlUsd - a.tvlUsd);

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
    category: categorize(categoryByProject.get(p.project), p.project, p.poolMeta),
  }));

  return {
    generatedAt: new Date().toISOString(),
    poolCount: valid.length,
    pools,
  };
}

export async function GET() {
  if (payloadCache && payloadCache.expiresAt > Date.now()) {
    return Response.json(payloadCache.value);
  }
  try {
    payloadInflight ??= buildPayload().finally(() => {
      payloadInflight = null;
    });
    const payload = await payloadInflight;
    payloadCache = { value: payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return Response.json(payload);
  } catch (err) {
    log.warn("live-yields", "payload refresh failed", { error: err });
    const msg = "Live yield data is temporarily unavailable";
    if (payloadCache) {
      return Response.json({ ...payloadCache.value, stale: true, error: msg });
    }
    return Response.json({ error: msg }, { status: 502 });
  }
}
