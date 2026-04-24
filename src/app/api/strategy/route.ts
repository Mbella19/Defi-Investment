import { generateStrategy } from "@/lib/strategist";
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

    const result = await generateStrategy(criteria);
    return Response.json(result);
  } catch (error) {
    console.error("Strategy generation failed:", error);
    const message = error instanceof Error ? error.message : "Failed to generate strategy";
    return Response.json({ error: message }, { status: 500 });
  }
}
