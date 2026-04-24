import { fetchProtocolDetail, fetchAllPools, fetchPoolHistory } from "@/lib/defillama";
import { fetchTokenDetail, toTokenMarketData, fetchPriceHistory } from "@/lib/coingecko";
import { fetchTokenSecurity, resolveChainId } from "@/lib/goplus";
import { fetchBeefyVaultsEnriched } from "@/lib/beefy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return Response.json({ error: "Missing slug parameter" }, { status: 400 });
  }

  try {
    const [detail, allPools] = await Promise.all([
      fetchProtocolDetail(slug),
      fetchAllPools(),
    ]);

    const protocolPools = allPools
      .filter((p) => p.project === slug)
      .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0));

    const topPools = protocolPools.slice(0, 3);
    const poolHistories = await Promise.allSettled(
      topPools.map(async (p) => {
        const history = await fetchPoolHistory(p.pool);
        return {
          poolId: p.pool,
          symbol: p.symbol,
          chain: p.chain,
          data: (history || []).map((h: { timestamp: string; apy: number; tvlUsd: number }) => ({
            timestamp: h.timestamp,
            apy: h.apy || 0,
            tvlUsd: h.tvlUsd || 0,
          })),
        };
      })
    );

    const resolvedHistories = poolHistories
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<{ poolId: string; symbol: string; chain: string; data: { timestamp: string; apy: number; tvlUsd: number }[] }>).value);

    const tvlHistory = (detail.tvl || []).map((t: { date: number; totalLiquidityUSD: number }) => ({
      date: new Date(t.date * 1000).toISOString().split("T")[0],
      tvl: t.totalLiquidityUSD,
    }));

    const currentTvl = protocolPools.reduce((s, p) => s + (p.tvlUsd || 0), 0);
    const avgApy = protocolPools.length > 0
      ? protocolPools.reduce((s, p) => s + (p.apy || 0), 0) / protocolPools.length
      : 0;

    let tokenMarketData = null;
    let priceHistory: { timestamp: number; price: number }[] = [];
    let securityData = null;
    let beefyVaults: { id: string; apy: number | null; tvlUsd: number | null }[] = [];

    try {
      const [geckoDetail, geckoPriceHistory, goplusSec, allBeefyVaults] = await Promise.all([
        detail.gecko_id ? fetchTokenDetail(detail.gecko_id) : Promise.resolve(null),
        detail.gecko_id ? fetchPriceHistory(detail.gecko_id, 30) : Promise.resolve([]),
        detail.address
          ? (async () => {
              const primaryChain = detail.chain || detail.chains?.[0] || "Ethereum";
              const chainId = resolveChainId(primaryChain);
              if (chainId) {
                const result = await fetchTokenSecurity(chainId, detail.address!);
                if (result) return result;
              }
              if (primaryChain !== "Ethereum") {
                return fetchTokenSecurity(1, detail.address!);
              }
              return null;
            })()
          : Promise.resolve(null),
        fetchBeefyVaultsEnriched(),
      ]);

      if (geckoDetail) tokenMarketData = toTokenMarketData(geckoDetail);
      priceHistory = geckoPriceHistory;
      securityData = goplusSec;

      const slugLower = slug.toLowerCase();
      const nameLower = detail.name.toLowerCase();
      beefyVaults = allBeefyVaults
        .filter((v) => {
          const pid = v.platformId.toLowerCase();
          return pid === slugLower || slugLower.startsWith(pid) || pid.startsWith(slugLower.replace(/-v\d+$/, "")) || nameLower.startsWith(pid);
        })
        .filter((v) => v.apy !== null && v.tvlUsd !== null && v.tvlUsd > 0)
        .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
        .slice(0, 10)
        .map((v) => ({ id: v.id, apy: v.apy, tvlUsd: v.tvlUsd }));
    } catch {
      // Enrichment is optional
    }

    return Response.json({
      protocol: {
        name: detail.name,
        slug: detail.slug,
        category: detail.category,
        chains: detail.chains,
        audits: detail.audits,
        description: detail.description,
        url: detail.url,
        twitter: detail.twitter,
      },
      tvlHistory: tvlHistory.slice(-180),
      poolHistories: resolvedHistories,
      metrics: {
        currentTvl,
        poolCount: protocolPools.length,
        avgApy: Math.round(avgApy * 100) / 100,
        stablecoinPools: protocolPools.filter((p) => p.stablecoin).length,
      },
      tokenMarketData,
      priceHistory,
      securityData,
      beefyVaults,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch health data";
    return Response.json({ error: message }, { status: 500 });
  }
}
