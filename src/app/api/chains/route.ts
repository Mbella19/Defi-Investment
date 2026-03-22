import { fetchChainOptions } from "@/lib/defillama";

export async function GET() {
  try {
    const chains = await fetchChainOptions();
    return Response.json(chains);
  } catch (error) {
    console.error("Failed to fetch chains:", error);
    return Response.json({ error: "Failed to fetch chains" }, { status: 500 });
  }
}
