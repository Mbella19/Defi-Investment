import { monitorActiveStrategies } from "@/lib/strategy-monitor";
import { ensureSchedulerStarted, getSchedulerStatus } from "@/lib/monitor-scheduler";

/**
 * Authorize cron-driven calls. CRON_SECRET should be set in production and
 * passed as `Authorization: Bearer <secret>` by Vercel Cron / external cron.
 * If unset (local dev), all callers are allowed — that's the same posture
 * the in-process scheduler had before externalization.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Local-dev fallback: keep the in-process scheduler running so dev
    // boxes still get periodic scans without an external cron. In a
    // serverless deploy this is a no-op (the timer never fires across
    // request boundaries) and Vercel Cron / external cron drives the work.
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

/**
 * Health check. Returns when the last successful scan ran so an external
 * watchdog can alert if the scheduler stops firing (serverless instance
 * recycle, cron misconfiguration, etc.).
 */
export async function GET() {
  const status = getSchedulerStatus();
  const stale =
    status.lastRunAt === null ||
    Date.now() - status.lastRunAt > 30 * 60 * 1000; // alert if no scan in 30min
  return Response.json({ ...status, stale });
}
