import { fetchPoolHistory } from "@/lib/defillama";
import { runFullRiskAnalysis } from "@/lib/risk-models";
import type { PoolHistoryPoint } from "@/types/risk-models";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { allocations, portfolioValue } = body;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return Response.json({ error: "No allocations provided" }, { status: 400 });
    }

    // Fetch pool histories in parallel
    const historyEntries = await Promise.allSettled(
      allocations.map(async (alloc: { poolId: string }) => {
        const history = await fetchPoolHistory(alloc.poolId);
        const points: PoolHistoryPoint[] = (history || []).map((h: { timestamp: string; apy: number; tvlUsd: number }) => ({
          timestamp: h.timestamp,
          apy: h.apy || 0,
          tvlUsd: h.tvlUsd || 0,
        }));
        return { poolId: alloc.poolId, points };
      })
    );

    const poolHistories = new Map<string, PoolHistoryPoint[]>();
    for (const entry of historyEntries) {
      if (entry.status === "fulfilled") {
        poolHistories.set(entry.value.poolId, entry.value.points);
      }
    }

    const result = runFullRiskAnalysis(allocations, poolHistories, portfolioValue);
    return Response.json(result);
  } catch (error) {
    console.error("Risk analysis failed:", error);
    const message = error instanceof Error ? error.message : "Risk analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
