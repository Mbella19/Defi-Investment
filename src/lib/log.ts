/**
 * Minimal leveled logger. JSON lines in production (grep/ship-friendly on a
 * single-server deploy), human-readable in dev. No external dependency —
 * swap the emit target for a real collector later without touching call sites.
 */

type Level = "debug" | "info" | "warn" | "error";

const IS_PROD = process.env.NODE_ENV === "production";
const REDACTED = "[redacted]";
const SENSITIVE_FIELD = /^(?:authorization|cookie|set-cookie|password|passphrase|secret|session(?:_?id)?|nonce|signature|private_?key|api_?key|verification_?code|endpoint(?:_(?:ciphertext|iv|tag))?|email|chat_?id|wallet(?:_?address)?|payer_?address|recipient_?address)$/i;
const SENSITIVE_ENV = /(?:^RPC_URL_|(?:^|_)(?:API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|WEBHOOK_URL|ENCRYPTION_KEY|BASE_URL|OWNER_WALLETS|DATABASE_PATH)$)/i;

function redactString(input: string): string {
  let value = input
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${REDACTED}`)
    .replace(/(https:\/\/(?:hooks\.slack\.com\/services|discord(?:app)?\.com\/api\/webhooks)\/)[^\s"']+/gi, `$1${REDACTED}`)
    .replace(/([?&](?:api_?key|key|token|secret|signature)=)[^&#\s]+/gi, `$1${REDACTED}`);

  // Provider errors sometimes echo credentials embedded in a URL. Replace
  // configured secret values before they reach either development or JSON
  // production logs. Ignore short values to avoid redacting normal words.
  for (const [key, secret] of Object.entries(process.env)) {
    if (!SENSITIVE_ENV.test(key) || !secret || secret.length < 8) continue;
    value = value.split(secret).join(REDACTED);
  }
  return value;
}

function sanitize(
  value: unknown,
  key = "",
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (SENSITIVE_FIELD.test(key)) return REDACTED;
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return redactString(value);
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (typeof value !== "object") return String(value);
  if (depth >= 6) return "[truncated]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) => sanitize(entry, "", depth + 1, seen));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([childKey, child]) => [childKey, sanitize(child, childKey, depth + 1, seen)]),
  );
}

function emit(level: Level, scope: string, message: string, extra?: Record<string, unknown>): void {
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  const safeScope = redactString(scope);
  const safeMessage = redactString(message);
  const details = extra ? sanitize(extra) : undefined;
  if (IS_PROD) {
    sink(
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        scope: safeScope,
        message: safeMessage,
        ...(details && typeof details === "object" ? { details } : {}),
      }),
    );
    return;
  }
  const suffix = details && typeof details === "object" && Object.keys(details).length > 0
    ? ` ${JSON.stringify(details)}`
    : "";
  sink(`[${safeScope}] ${safeMessage}${suffix}`);
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
