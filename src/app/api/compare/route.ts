import { generateStrategy } from "@/lib/strategist";
import type { StrategyCriteria } from "@/types/strategy";

export async function POST(request: Request) {
  try {
    const { budget, targetApyMin, targetApyMax } = await request.json();

    if (!budget || budget <= 0) {
      return Response.json({ error: "Invalid budget" }, { status: 400 });
    }

    // Generate 3 strategies with different risk profiles
    const profiles: { risk: StrategyCriteria["riskAppetite"]; label: string }[] = [
      { risk: "low", label: "Conservative" },
      { risk: "medium", label: "Balanced" },
      { risk: "high", label: "Aggressive" },
    ];

    const results = [];

    for (const profile of profiles) {
      try {
        const result = await generateStrategy({
          budget,
          riskAppetite: profile.risk,
          targetApyMin: targetApyMin || 1,
          targetApyMax: targetApyMax || 500,
        });
        results.push({ label: profile.label, risk: profile.risk, ...result });
      } catch (err) {
        console.error(`Strategy generation failed for ${profile.label}:`, err);
        results.push({
          label: profile.label,
          risk: profile.risk,
          strategy: null,
          error: err instanceof Error ? err.message : "Failed",
          poolsScanned: 0,
          protocolsAnalyzed: 0,
          protocolsDeepAnalyzed: 0,
        });
      }
    }

    return Response.json({ strategies: results });
  } catch (error) {
    console.error("Comparison failed:", error);
    const message = error instanceof Error ? error.message : "Comparison failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
