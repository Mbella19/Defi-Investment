import { monitorActiveStrategies } from "@/lib/strategy-monitor";
import { ensureSchedulerStarted } from "@/lib/monitor-scheduler";
import { requireWallet } from "@/lib/auth/guard";
import { requireCapability } from "@/lib/plans/access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";
import { log } from "@/lib/log";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

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

    let parsed: unknown;
    try {
      parsed = await readJsonBody(request);
    } catch (error) {
      return jsonBodyErrorResponse(error);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "JSON body must be an object" }, { status: 400 });
    }
    const body = parsed as { strategyId?: unknown };
    const strategyId = body.strategyId;
    if (
      strategyId !== undefined &&
      (typeof strategyId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(strategyId))
    ) {
      return Response.json({ error: "Invalid strategyId" }, { status: 400 });
    }

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
    log.error("strategy-monitor", "manual scan failed", { error });
    return Response.json({ error: "Monitor scan failed" }, { status: 502 });
  }
}
