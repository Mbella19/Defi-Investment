import "server-only";
import { getDb } from "@/lib/db";
import { log } from "@/lib/log";
import { sendPlainMessageToUser } from "@/lib/notifications/dispatcher";

const REMIND_WINDOW_DAYS = 3;

interface ExpiringRow {
  wallet_address: string;
  tier: string;
  expires_at: string;
}

/**
 * Notify wallets whose paid plan expires within the next 3 days, once per
 * billing period. Runs from the scheduler sweep / cron route. The 7-day
 * re-send suppression means a renewal (+30d) naturally re-arms the reminder
 * for the next period, while one period never gets two.
 *
 * Wallets with zero configured channels are NOT stamped — if they connect a
 * channel while still inside the window, the next sweep delivers.
 */
export async function sendExpiryReminders(): Promise<{ candidates: number; reminded: number }> {
  let rows: ExpiringRow[];
  try {
    rows = getDb()
      .prepare(
        `SELECT wallet_address, tier, expires_at FROM subscriptions
         WHERE tier IN ('pro', 'ultra')
           AND datetime(expires_at) > datetime('now')
           AND datetime(expires_at) <= datetime('now', '+${REMIND_WINDOW_DAYS} days')
           AND (reminder_sent_at IS NULL OR datetime(reminder_sent_at) < datetime('now', '-7 days'))`,
      )
      .all() as ExpiringRow[];
  } catch (err) {
    log.warn("reminders", "expiring-subscription query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { candidates: 0, reminded: 0 };
  }

  let reminded = 0;
  for (const row of rows) {
    const expiryMs = new Date(row.expires_at).getTime();
    if (!Number.isFinite(expiryMs)) continue;
    const daysLeft = Math.max(1, Math.ceil((expiryMs - Date.now()) / 86_400_000));
    const tierLabel = row.tier === "ultra" ? "Ultra" : "Pro";
    const title = `Your Sovereign ${tierLabel} plan expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    const body =
      `Monitoring, alerts, and ${tierLabel}-tier features stop when the plan lapses on ` +
      `${new Date(expiryMs).toUTCString().slice(0, 16)}. Renew from the Plans page to keep ` +
      `coverage uninterrupted — renewals extend your current expiry, so renewing early never costs days.`;

    try {
      const delivered = await sendPlainMessageToUser(row.wallet_address, { title, body });
      if (delivered > 0) {
        getDb()
          .prepare(
            "UPDATE subscriptions SET reminder_sent_at = datetime('now') WHERE wallet_address = ?",
          )
          .run(row.wallet_address);
        reminded += 1;
      }
    } catch (err) {
      log.warn("reminders", "reminder dispatch failed", {
        wallet: row.wallet_address,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (reminded > 0) {
    log.info("reminders", "expiry reminders sent", { candidates: rows.length, reminded });
  }
  return { candidates: rows.length, reminded };
}
