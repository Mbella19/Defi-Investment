import { generateStrategy } from "@/lib/strategist";
import { DEMO_MODE } from "@/lib/demo";
import { DEMO_STRATEGY } from "@/lib/demo/mock-strategy";
import type { StrategyCriteria } from "@/types/strategy";

export async function POST(request: Request) {
  try {
    const criteria: StrategyCriteria = await request.json();

    if (!criteria.budget || criteria.budget <= 0) {
      return Response.json({ error: "Invalid budget" }, { status: 400 });
    }
    if (!criteria.targetApyMin || !criteria.targetApyMax || criteria.targetApyMin >= criteria.targetApyMax) {
      return Response.json({ error: "Invalid APY range" }, { status: 400 });
    }

    if (DEMO_MODE) {
      const scaled = { ...DEMO_STRATEGY, projectedYearlyReturn: criteria.budget * (DEMO_STRATEGY.projectedApy / 100), generatedAt: new Date().toISOString(), allocations: DEMO_STRATEGY.allocations.map((a) => ({ ...a, allocationAmount: criteria.budget * (a.allocationPercent / 100) })) };
      return Response.json({ strategy: scaled, poolsScanned: 847, protocolsAnalyzed: 42, protocolsDeepAnalyzed: 5 });
    }

    const result = await generateStrategy(criteria);
    return Response.json(result);
  } catch (error) {
    console.error("Strategy generation failed:", error);
    const message = error instanceof Error ? error.message : "Failed to generate strategy";
    return Response.json({ error: message }, { status: 500 });
  }
}
