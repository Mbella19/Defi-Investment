import { fetchProtocolDetail, fetchAllPools, fetchPoolHistory, fetchHacks } from "@/lib/defillama";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return Response.json({ error: "Missing slug parameter" }, { status: 400 });
  }

  try {
    const [detail, allPools, hacks] = await Promise.all([
      fetchProtocolDetail(slug),
      fetchAllPools(),
      fetchHacks(),
    ]);

    // Get pools for this protocol
    const protocolPools = allPools
      .filter((p) => p.project === slug)
      .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0));

    // Get history for top 3 pools
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

    // TVL history from protocol detail
    const tvlHistory = (detail.tvl || []).map((t: { date: number; totalLiquidityUSD: number }) => ({
      date: new Date(t.date * 1000).toISOString().split("T")[0],
      tvl: t.totalLiquidityUSD,
    }));

    // Filter hacks for this protocol
    const protocolHacks = hacks.filter((h) => {
      const target = (h.target || h.name || "").toLowerCase();
      return target.includes(slug.toLowerCase()) || target.includes(detail.name.toLowerCase());
    }).map((h) => ({
      date: new Date(h.date * 1000).toISOString(),
      amount: h.amount,
      technique: h.technique || "Unknown",
      name: h.name,
    }));

    // Health metrics
    const currentTvl = protocolPools.reduce((s, p) => s + (p.tvlUsd || 0), 0);
    const avgApy = protocolPools.length > 0
      ? protocolPools.reduce((s, p) => s + (p.apy || 0), 0) / protocolPools.length
      : 0;

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
      tvlHistory: tvlHistory.slice(-180), // Last 180 days
      poolHistories: resolvedHistories,
      hacks: protocolHacks,
      metrics: {
        currentTvl,
        poolCount: protocolPools.length,
        avgApy: Math.round(avgApy * 100) / 100,
        stablecoinPools: protocolPools.filter((p) => p.stablecoin).length,
        hackCount: protocolHacks.length,
        totalHackLoss: protocolHacks.reduce((s, h) => s + h.amount, 0),
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch health data";
    return Response.json({ error: message }, { status: 500 });
  }
}
