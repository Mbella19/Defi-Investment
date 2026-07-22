import "server-only";
import { randomUUID } from "crypto";
import { generateStrategy } from "@/lib/strategist";
import {
  claimNextStrategyJob,
  completeJob,
  emitEvent,
  failJob,
  retryStrategyJob,
} from "@/lib/strategy-jobs";
import { log } from "@/lib/log";
import { withAiUsageContext } from "@/lib/ai-telemetry";
import { describeStrategyFailure } from "@/lib/strategy-errors";

const WORKER_ID = `strategy:${process.pid}:${randomUUID()}`;
let draining = false;

export function kickStrategyWorker(): void {
  if (draining) return;
  draining = true;
  void drain().finally(() => {
    draining = false;
  });
}

async function drain(): Promise<void> {
  for (;;) {
    const claimed = claimNextStrategyJob(WORKER_ID);
    if (!claimed) return;
    try {
      const result = await withAiUsageContext(
        {
          wallet: claimed.job.wallet,
          jobId: claimed.job.id,
          operation: "strategy.generate",
        },
        () => generateStrategy(claimed.payload.criteria, {
          mode: claimed.payload.mode,
          onProgress: (event) => emitEvent(claimed.job.id, event),
        }),
      );
      completeJob(claimed.job.id, result);
    } catch (error) {
      const failure = describeStrategyFailure(error);
      const failureOptions = {
        errorCode: failure.code,
        publicError: failure.publicMessage,
      };
      const retrying = failure.retryable
        ? retryStrategyJob(claimed.job.id, failure.internalMessage, 30_000, failureOptions)
        : false;
      if (!failure.retryable) {
        failJob(claimed.job.id, failure.internalMessage, failureOptions);
      }
      log.warn("strategy-worker", retrying ? "job scheduled for retry" : "job failed", {
        jobId: claimed.job.id,
        error: failure.internalMessage,
        errorCode: failure.code,
        retryable: failure.retryable,
      });
      if (retrying) {
        const retryTimer = setTimeout(kickStrategyWorker, 30_000);
        if (typeof retryTimer.unref === "function") retryTimer.unref();
      }
    }
  }
}

const recoveryTimer = setInterval(kickStrategyWorker, 30_000);
if (typeof recoveryTimer.unref === "function") recoveryTimer.unref();
