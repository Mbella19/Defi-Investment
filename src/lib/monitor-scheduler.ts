import { monitorActiveStrategies } from "@/lib/strategy-monitor";
import { reconcilePendingPayments } from "@/lib/payments/reconciler";
import { sendExpiryReminders } from "@/lib/plans/reminders";
import { log } from "@/lib/log";
import { drainAlertOutbox } from "@/lib/notifications/dispatcher";

const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;

let started = false;
let timer: NodeJS.Timeout | null = null;
// Tracking the in-flight scan as a Promise (rather than a boolean flag)
// guarantees concurrent callers coalesce onto the same run instead of racing
// the flag's set/clear edges.
let inflight: Promise<void> | null = null;

function runScan(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      try {
        const result = await monitorActiveStrategies();
        if (result.newAlerts.length > 0) {
          log.info("monitor-scheduler", "strategy scan produced alerts", {
            scanned: result.scanned,
            newAlerts: result.newAlerts.length,
          });
        }
      } catch (error) {
        log.error("monitor-scheduler", "scan failed", { error });
      }

      // Payment reconciliation rides the same 15-min sweep. Isolated from the
      // monitor scan so a DeFiLlama outage can't stall payment activation.
      try {
        const rec = await reconcilePendingPayments();
        if (rec.confirmed > 0) {
          log.info("monitor-scheduler", "reconciler confirmed payments", rec);
        }
      } catch (error) {
        log.warn("monitor-scheduler", "payment reconcile failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Subscription expiry reminders — also isolated.
      try {
        await sendExpiryReminders();
      } catch (error) {
        log.warn("monitor-scheduler", "expiry reminders failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Retry pending alert deliveries even on scans that produced no new
      // incidents or when a previous process died after claiming a row.
      try {
        await drainAlertOutbox();
      } catch (error) {
        log.warn("monitor-scheduler", "notification outbox drain failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function ensureSchedulerStarted(): void {
  if (started) return;
  started = true;

  const initialTimer = setTimeout(() => {
    void runScan();
    timer = setInterval(() => {
      void runScan();
    }, SCAN_INTERVAL_MS);
    if (typeof timer.unref === "function") timer.unref();
  }, INITIAL_DELAY_MS);
  if (typeof initialTimer.unref === "function") initialTimer.unref();
}
