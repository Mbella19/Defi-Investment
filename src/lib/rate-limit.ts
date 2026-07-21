import { isIP } from "net";
import { getSessionWallet } from "./auth/session";
import { getDb } from "./db";

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function takeToken(key: string, opts: RateLimitOptions): RateLimitResult {
  if (!Number.isSafeInteger(opts.max) || opts.max <= 0) throw new Error("rate-limit max must be positive");
  if (!Number.isSafeInteger(opts.windowMs) || opts.windowMs <= 0) {
    throw new Error("rate-limit windowMs must be positive");
  }
  const now = Date.now();
  const db = getDb();
  return db.transaction(() => {
    // Opportunistic bounded cleanup avoids a process timer and works after restarts.
    db.prepare("DELETE FROM rate_limit_buckets WHERE expires_at <= ?").run(now);
    const row = db
      .prepare("SELECT count, window_start FROM rate_limit_buckets WHERE bucket_key = ?")
      .get(key) as { count: number; window_start: number } | undefined;
    const expired = !row || now - row.window_start >= opts.windowMs;
    const windowStart = expired ? now : row.window_start;
    const current = expired ? 0 : row.count;
    const resetAt = windowStart + opts.windowMs;
    if (current >= opts.max) return { allowed: false, remaining: 0, resetAt };
    const next = current + 1;
    db.prepare(
      `INSERT INTO rate_limit_buckets (bucket_key, count, window_start, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET
         count = excluded.count,
         window_start = excluded.window_start,
         expires_at = excluded.expires_at`,
    ).run(key, next, windowStart, resetAt);
    return { allowed: true, remaining: opts.max - next, resetAt };
  })();
}

function normalizeIp(candidate: string | null): string | null {
  if (!candidate) return null;
  const value = candidate.trim().replace(/^\[|\]$/g, "");
  return isIP(value) ? value : null;
}

function getIp(request: Request): string {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "direct";
  const cf = normalizeIp(request.headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const real = normalizeIp(request.headers.get("x-real-ip"));
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  return normalizeIp(forwarded) ?? "unknown";
}

export function enforceRateLimit(
  request: Request,
  endpoint: string,
  opts: RateLimitOptions,
): Response | null {
  try {
    const wallet = getSessionWallet(request);
    const identity = wallet ? `wallet:${wallet}` : `ip:${getIp(request)}`;
    const result = takeToken(`${endpoint}:${identity}`, opts);
    if (result.allowed) return null;
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return Response.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED", retryAfterSeconds: retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(opts.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Rate limiting is temporarily unavailable", code: "RATE_LIMIT_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
