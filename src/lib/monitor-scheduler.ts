import { monitorActiveStrategies } from "@/lib/strategy-monitor";
import { reconcilePendingPayments } from "@/lib/payments/reconciler";
import { sendExpiryReminders } from "@/lib/plans/reminders";
import { log } from "@/lib/log";

const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;

let started = false;
let timer: NodeJS.Timeout | null = null;
// Tracking the in-flight scan as a Promise (rather than a boolean flag)
// guarantees concurrent callers coalesce onto the same run instead of racing
// the flag's set/clear edges.
let inflight: Promise<void> | null = null;
let lastRunAt: number | null = null;
let lastResult: { scanned: number; newAlerts: number; error?: string } | null = null;

function runScan(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const result = await monitorActiveStrategies();
      lastResult = { scanned: result.scanned, newAlerts: result.newAlerts.length };
      lastRunAt = Date.now();
      if (result.newAlerts.length > 0) {
        console.log(
          `[monitor-scheduler] scanned ${result.scanned} strategies, ${result.newAlerts.length} new alerts`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "scan failed";
      lastResult = { scanned: 0, newAlerts: 0, error: message };
      lastRunAt = Date.now();
      console.error("[monitor-scheduler] scan failed:", message);
    } finally {
      inflight = null;
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
  })();
  return inflight;
}

export function ensureSchedulerStarted(): void {
  if (started) return;
  started = true;

  setTimeout(() => {
    void runScan();
    timer = setInterval(() => {
      void runScan();
    }, SCAN_INTERVAL_MS);
    if (typeof timer.unref === "function") timer.unref();
  }, INITIAL_DELAY_MS);
}

export function getSchedulerStatus(): {
  started: boolean;
  inflight: boolean;
  lastRunAt: number | null;
  lastResult: typeof lastResult;
  intervalMs: number;
} {
  return {
    started,
    inflight: inflight !== null,
    lastRunAt,
    lastResult,
    intervalMs: SCAN_INTERVAL_MS,
  };
}
