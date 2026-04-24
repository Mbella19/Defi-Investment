import { monitorExploits, type MonitoredStrategy } from "@/lib/security/exploit-monitor";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawStrategies = Array.isArray(body?.strategies) ? body.strategies : [];

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
