import { monitorExploits, type MonitoredStrategy } from "@/lib/security/exploit-monitor";
import { requireWallet } from "@/lib/auth/guard";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  // Auth + rate-limit. Each call fans out to multiple Etherscan token-tx
  // queries plus triple-AI interpretation, so unmetered access was a real
  // quota burn vector. 20/h matches /api/analyze and /api/security/forensics.
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const limited = enforceRateLimit(request, "security.alerts", { max: 20, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const rawStrategies = Array.isArray(body?.strategies) ? body.strategies : [];

    if (rawStrategies.length > 50) {
      return Response.json(
        { error: `Too many strategies (${rawStrategies.length}); max 50 per request` },
        { status: 400 },
      );
    }

    const strategies: MonitoredStrategy[] = rawStrategies
      .map((s: unknown) => {
        const x = s as Partial<MonitoredStrategy>;
        if (!x || typeof x !== "object") return null;
        if (!x.id || !x.protocol || !x.chain) return null;
        return {
          id: String(x.id),
          protocol: String(x.protocol),
          symbol: String(x.symbol || ""),
          chain: String(x.chain),
          poolId: x.poolId ? String(x.poolId) : undefined,
          addresses: Array.isArray(x.addresses)
            ? x.addresses.map(String).filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a))
            : undefined,
          investedAmount:
            typeof x.investedAmount === "number" ? x.investedAmount : undefined,
          riskAppetite: x.riskAppetite,
        } as MonitoredStrategy;
      })
      .filter((s: MonitoredStrategy | null): s is MonitoredStrategy => s !== null);

    const report = await monitorExploits(strategies);
    return Response.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Alerts fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
