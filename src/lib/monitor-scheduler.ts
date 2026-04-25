import { monitorActiveStrategies } from "@/lib/strategy-monitor";

const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;

let started = false;
let timer: NodeJS.Timeout | null = null;
let inflight = false;
let lastRunAt: number | null = null;
let lastResult: { scanned: number; newAlerts: number; error?: string } | null = null;

async function runScan(): Promise<void> {
  if (inflight) return;
  inflight = true;
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
    inflight = false;
  }
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
    inflight,
    lastRunAt,
    lastResult,
    intervalMs: SCAN_INTERVAL_MS,
  };
}
