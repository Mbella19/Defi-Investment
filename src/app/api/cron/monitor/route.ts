import { monitorActiveStrategies } from "@/lib/strategy-monitor";
import { reconcilePendingPayments } from "@/lib/payments/reconciler";
import { sendExpiryReminders } from "@/lib/plans/reminders";

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
    const payments = await reconcilePendingPayments().catch((err) => {
      console.error("[cron/monitor] payment reconcile failed:", err);
      return { checked: 0, confirmed: 0 };
    });
    const reminders = await sendExpiryReminders().catch((err) => {
      console.error("[cron/monitor] expiry reminders failed:", err);
      return { candidates: 0, reminded: 0 };
    });
    return Response.json({
      ok: true,
      scanned: result.scanned,
      newAlerts: result.newAlerts.length,
      paymentsChecked: payments.checked,
      paymentsConfirmed: payments.confirmed,
      remindersSent: reminders.reminded,
    });
  } catch (error) {
    console.error("[cron/monitor] scan failed:", error);
    const message = error instanceof Error ? error.message : "Monitor scan failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
