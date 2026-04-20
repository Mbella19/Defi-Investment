import { scanPools } from "@/lib/scanner";
import { DEMO_MODE } from "@/lib/demo";
import { DEMO_SCAN_RESPONSE } from "@/lib/demo/mock-pools";
import type { ScannerCriteria } from "@/types/scanner";

export async function POST(request: Request) {
  try {
    const criteria: ScannerCriteria = await request.json();

    if (!criteria.budget || criteria.budget <= 0 || criteria.budget > 100_000_000) {
      return Response.json({ error: "Budget must be between $1 and $100,000,000" }, { status: 400 });
    }

    if (!["low", "medium", "high"].includes(criteria.riskAppetite)) {
      return Response.json({ error: "Invalid risk appetite" }, { status: 400 });
    }

    if (!["stablecoins", "all"].includes(criteria.assetType)) {
      return Response.json({ error: "Invalid asset type" }, { status: 400 });
    }

    if (DEMO_MODE) {
      return Response.json({ ...DEMO_SCAN_RESPONSE, criteria, scannedAt: new Date().toISOString() });
    }

    const results = await scanPools(criteria);
    return Response.json(results);
  } catch (error) {
    console.error("Scan failed:", error);
    return Response.json({ error: "Failed to scan pools" }, { status: 500 });
  }
}
