import { monitorActiveStrategies } from "@/lib/strategy-monitor";
import { ensureSchedulerStarted } from "@/lib/monitor-scheduler";

export async function POST(request: Request) {
  try {
    ensureSchedulerStarted();

    const body = await request.json().catch(() => ({}));
    const { strategyId } = body as { strategyId?: string };

    const result = await monitorActiveStrategies(strategyId);
    return Response.json(result);
  } catch (error) {
    console.error("Strategy monitor scan failed:", error);
    const message = error instanceof Error ? error.message : "Monitor scan failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
