import { monitorActiveStrategies } from "@/lib/strategy-monitor";
import { ensureSchedulerStarted, getSchedulerStatus } from "@/lib/monitor-scheduler";
import { requireWallet } from "@/lib/auth/guard";
import { requireCapability } from "@/lib/plans/access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";

/**
 * Manual scan trigger from the UI ("Run scan now" button). Authenticated by
 * SIWE session — Vercel Cron uses /api/cron/monitor instead, so this route
 * no longer needs CRON_SECRET handling. We scope the scan to active
 * strategies owned by the calling wallet so a user can never run a scan
 * across someone else's portfolio.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(request: Request) {
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const cap = requireCapability(auth.wallet, "realtimeAlerts");
  if (!cap.ok) return cap.response;
  const limited = enforceRateLimit(request, "monitor.manual", { max: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  try {
    // Local-dev courtesy: kick the in-process scheduler so dev boxes still
    // get periodic scans without an external cron. No-op on serverless.
    ensureSchedulerStarted();

    const body = await request.json().catch(() => ({}));
    const { strategyId } = body as { strategyId?: string };

    // If a strategyId is given, verify it belongs to this wallet first.
    if (strategyId) {
      const db = getDb();
      const owner = db
        .prepare("SELECT wallet_address FROM active_strategies WHERE id = ?")
        .get(strategyId) as { wallet_address: string | null } | undefined;
      if (!owner || owner.wallet_address?.toLowerCase() !== auth.wallet) {
        return Response.json({ error: "Strategy not found" }, { status: 404 });
      }
    }

    const result = await monitorActiveStrategies(strategyId, auth.wallet);
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
