import { fetchAllPools, fetchHacks } from "@/lib/defillama";
import { runMonitorScan } from "@/lib/monitor";
import type { PortfolioPosition, AlertConfig } from "@/types/portfolio";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { positions, config } = body as {
      positions: PortfolioPosition[];
      config: AlertConfig;
    };

    if (!positions || positions.length === 0) {
      return Response.json({ alerts: [], positions: [] });
    }

    const [allPools, hacks] = await Promise.all([
      fetchAllPools(),
      fetchHacks(),
    ]);

    const alerts = runMonitorScan(positions, allPools, hacks, config);

    // Enrich positions with current data
    const poolMap = new Map(allPools.map((p) => [p.pool, p]));
    const enriched = positions.map((pos) => {
      const current = poolMap.get(pos.poolId);
      return {
        ...pos,
        currentApy: current?.apy || null,
        currentTvl: current?.tvlUsd || null,
        apyChange: current?.apy != null && pos.entryApy > 0
          ? ((current.apy - pos.entryApy) / pos.entryApy * 100)
          : null,
        tvlChange: current?.tvlUsd != null && pos.entryTvl > 0
          ? ((current.tvlUsd - pos.entryTvl) / pos.entryTvl * 100)
          : null,
      };
    });

    return Response.json({ alerts, positions: enriched });
  } catch (error) {
    console.error("Monitor scan failed:", error);
    const message = error instanceof Error ? error.message : "Monitor scan failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
