/**
 * Minimal leveled logger. JSON lines in production (grep/ship-friendly on a
 * single-server deploy), human-readable in dev. No external dependency —
 * swap the emit target for a real collector later without touching call sites.
 */

type Level = "debug" | "info" | "warn" | "error";

const IS_PROD = process.env.NODE_ENV === "production";

function emit(level: Level, scope: string, message: string, extra?: Record<string, unknown>): void {
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (IS_PROD) {
    sink(
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        scope,
        message,
        ...extra,
      }),
    );
    return;
  }
  const suffix = extra && Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
  sink(`[${scope}] ${message}${suffix}`);
}

export const log = {
  debug: (scope: string, message: string, extra?: Record<string, unknown>) =>
    emit("debug", scope, message, extra),
  info: (scope: string, message: string, extra?: Record<string, unknown>) =>
    emit("info", scope, message, extra),
  warn: (scope: string, message: string, extra?: Record<string, unknown>) =>
    emit("warn", scope, message, extra),
  error: (scope: string, message: string, extra?: Record<string, unknown>) =>
    emit("error", scope, message, extra),
};
