import { fetchAllPools } from "@/lib/defillama";
import { generateRebalanceSuggestions } from "@/lib/rebalancer";
import type { PortfolioPosition } from "@/types/portfolio";

export async function POST(request: Request) {
  try {
    const { positions } = (await request.json()) as { positions: PortfolioPosition[] };

    if (!positions || positions.length === 0) {
      return Response.json({ suggestions: [] });
    }

    const allPools = await fetchAllPools();
    const poolMap = new Map(allPools.map((p) => [p.pool, p]));

    const suggestions = generateRebalanceSuggestions(positions, allPools, poolMap);
    return Response.json({ suggestions });
  } catch (error) {
    console.error("Rebalance failed:", error);
    const message = error instanceof Error ? error.message : "Rebalance analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
