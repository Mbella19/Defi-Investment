import { analyzeProtocol } from "@/lib/anthropic";
import { fetchProtocol, fetchAllPools } from "@/lib/defillama";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireWallet } from "@/lib/auth/guard";

export async function POST(request: Request) {
  // Each uncached call fans out to three max-effort reasoning models plus a
  // synthesis pass — never expose that anonymously (IP rate limits alone are
  // spoofable via forwarded headers).
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const limited = enforceRateLimit(request, "analyze", { max: 20, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  try {
    const { protocolSlug } = await request.json();

    if (!protocolSlug || typeof protocolSlug !== "string") {
      return Response.json({ error: "protocolSlug is required" }, { status: 400 });
    }

    const protocol = await fetchProtocol(protocolSlug);
    if (!protocol) {
      return Response.json({ error: "Protocol not found" }, { status: 404 });
    }

    const allPools = await fetchAllPools();
    const protocolPools = allPools.filter((p) => p.project === protocolSlug);

    const analysis = await analyzeProtocol(protocol, protocolPools);
    return Response.json(analysis);
  } catch (error) {
    console.error("Analysis failed:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze protocol";
    return Response.json({ error: message }, { status: 500 });
  }
}
