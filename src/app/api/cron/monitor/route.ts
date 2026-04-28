import { monitorActiveStrategies } from "@/lib/strategy-monitor";

/**
 * Vercel Cron entry point. Vercel Cron sends `GET` requests with an
 * `Authorization: Bearer <CRON_SECRET>` header; this route runs one full
 * monitor sweep across every active strategy in the database.
 *
 * Why this lives at /api/cron/monitor instead of /api/strategies/monitor:
 * the older route's GET is a status check, and Vercel Cron only does GET, so
 * pointing the cron at it caused the cron to silently no-op for several
 * weeks. Splitting the cron onto its own path lets the strategies route
 * keep its (status-on-GET, manual-trigger-on-POST) ergonomics.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Production must set CRON_SECRET. Local dev may leave it unset — the
  // in-process scheduler is the dev fallback path (see monitor-scheduler.ts).
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await monitorActiveStrategies();
    return Response.json({
      ok: true,
      scanned: result.scanned,
      newAlerts: result.newAlerts.length,
    });
  } catch (error) {
    console.error("[cron/monitor] scan failed:", error);
    const message = error instanceof Error ? error.message : "Monitor scan failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
