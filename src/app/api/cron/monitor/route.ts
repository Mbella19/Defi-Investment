import { timingSafeEqual } from "crypto";
import { monitorActiveStrategies } from "@/lib/strategy-monitor";
import { reconcilePendingPayments } from "@/lib/payments/reconciler";
import { sendExpiryReminders } from "@/lib/plans/reminders";
import { drainAlertOutbox } from "@/lib/notifications/dispatcher";
import { log } from "@/lib/log";

/**
 * Vercel Cron entry point. Vercel Cron sends `GET` requests with an
 * `Authorization: Bearer <CRON_SECRET>` header; this route runs one full
 * monitor sweep across every active strategy in the database.
 *
 * This lives separately from the authenticated manual scan endpoint because
 * Vercel Cron invokes GET while user-triggered monitoring uses POST.
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
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await monitorActiveStrategies();
    const payments = await reconcilePendingPayments().catch((err) => {
      log.error("cron-monitor", "payment reconcile failed", { error: err });
      return { checked: 0, confirmed: 0 };
    });
    const reminders = await sendExpiryReminders().catch((err) => {
      log.error("cron-monitor", "expiry reminders failed", { error: err });
      return { candidates: 0, reminded: 0 };
    });
    const deliveries = await drainAlertOutbox().catch((err) => {
      log.error("cron-monitor", "notification delivery failed", { error: err });
      return { email: 0, telegram: 0, slack: 0, discord: 0 };
    });
    return Response.json({
      ok: true,
      scanned: result.scanned,
      newAlerts: result.newAlerts.length,
      paymentsChecked: payments.checked,
      paymentsConfirmed: payments.confirmed,
      remindersSent: reminders.reminded,
      notificationsDelivered: Object.values(deliveries).reduce((sum, count) => sum + count, 0),
    });
  } catch (error) {
    log.error("cron-monitor", "scan failed", { error });
    return Response.json({ ok: false, error: "Monitor scan failed" }, { status: 500 });
  }
}
