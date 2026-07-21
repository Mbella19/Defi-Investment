/**
 * Start the single-process durable runtime as soon as the Node server boots.
 * Route-level kick calls remain as a fallback, but jobs and monitoring must
 * not depend on a user opening a page after every process restart.
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  const [{ ensureSchedulerStarted }, { kickStrategyWorker }, { kickAuditWorker }] =
    await Promise.all([
      import("@/lib/monitor-scheduler"),
      import("@/lib/strategy-worker"),
      import("@/lib/security/audit/worker"),
    ]);
  ensureSchedulerStarted();
  kickStrategyWorker();
  kickAuditWorker();
}
