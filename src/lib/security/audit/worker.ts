import "server-only";
import { randomUUID } from "crypto";
import { runMultiEngineAudit } from "@/lib/security/audit/orchestrator";
import {
  claimNextAuditJob,
  completeAuditJob,
  emitAuditEvent,
  retryAuditJob,
} from "@/lib/security/audit/jobs";
import { log } from "@/lib/log";
import { withAiUsageContext } from "@/lib/ai-telemetry";

const WORKER_ID = `audit:${process.pid}:${randomUUID()}`;
let draining = false;

export function kickAuditWorker(): void {
  if (draining) return;
  draining = true;
  void drain().finally(() => {
    draining = false;
  });
}

async function drain(): Promise<void> {
  for (;;) {
    const claimed = claimNextAuditJob(WORKER_ID);
    if (!claimed) return;
    try {
      const report = await withAiUsageContext(
        {
          wallet: claimed.job.wallet,
          jobId: claimed.job.id,
          operation: "audit.explain",
        },
        () => runMultiEngineAudit(
          claimed.payload.contractAddress,
          claimed.payload.chainId,
          { onProgress: (event) => emitAuditEvent(claimed.job.id, event) },
        ),
      );
      completeAuditJob(claimed.job.id, report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retrying = retryAuditJob(claimed.job.id, message);
      log.warn("audit-worker", retrying ? "job scheduled for retry" : "job failed", {
        jobId: claimed.job.id,
        error: message,
      });
      if (retrying) {
        const retryTimer = setTimeout(kickAuditWorker, 30_000);
        if (typeof retryTimer.unref === "function") retryTimer.unref();
      }
    }
  }
}

const recoveryTimer = setInterval(kickAuditWorker, 30_000);
if (typeof recoveryTimer.unref === "function") recoveryTimer.unref();
