import { fetchTokenPrices } from "@/lib/coingecko";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// chainId → CoinGecko ID for the chain's native gas token.
const NATIVE_BY_CHAIN: Record<number, { geckoId: string; symbol: string }> = {
  1: { geckoId: "ethereum", symbol: "ETH" },
  56: { geckoId: "binancecoin", symbol: "BNB" },
};

let cache: { byChainId: Record<string, { usd: number; symbol: string }>; ts: number } | null = null;
const CACHE_MS = 60_000; // 1 min — fee display, not financial-grade

// Browser caching: 30s fresh, 60s stale-while-revalidate. The endpoint is
// strictly informational (gas display) and these prices move slowly enough
// that aggressive caching is fine.
const CACHE_HEADER = "public, max-age=30, s-maxage=30, stale-while-revalidate=60";

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_MS) {
    return Response.json(
      { byChainId: cache.byChainId, cached: true },
      { headers: { "Cache-Control": CACHE_HEADER } },
    );
  }
  const ids = Object.values(NATIVE_BY_CHAIN).map((n) => n.geckoId);
  try {
    const prices = await fetchTokenPrices(ids);
    const byChainId: Record<string, { usd: number; symbol: string }> = {};
    for (const [chainId, info] of Object.entries(NATIVE_BY_CHAIN)) {
      const entry = prices.get(info.geckoId);
      if (entry && entry.usd > 0) {
        byChainId[chainId] = { usd: entry.usd, symbol: info.symbol };
      }
    }
    cache = { byChainId, ts: Date.now() };
    return Response.json(
      { byChainId, cached: false },
      { headers: { "Cache-Control": CACHE_HEADER } },
    );
  } catch (err) {
    return Response.json(
      { byChainId: {}, error: err instanceof Error ? err.message : "price fetch failed" },
      { status: 502 },
    );
  }
}
