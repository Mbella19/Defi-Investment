import { getSessionWallet } from "./auth/session";

/**
 * In-memory fixed-window rate limiter. Keys are arbitrary strings
 * (`endpoint:ip:1.2.3.4` or `endpoint:wallet:0x…`). Single-instance only —
 * for multi-instance deployments, swap the Map for Redis with the same
 * `{count, windowStart}` shape.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

function pruneStale() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    // Drop any window started more than 1 hour ago.
    if (now - bucket.windowStart > 60 * 60 * 1000) buckets.delete(key);
  }
}
const _pruneTimer = setInterval(pruneStale, PRUNE_INTERVAL_MS);
if (typeof _pruneTimer.unref === "function") _pruneTimer.unref();

export interface RateLimitOptions {
  /** Maximum allowed hits in the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function takeToken(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= opts.windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }
  if (bucket.count >= opts.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.windowStart + opts.windowMs,
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: opts.max - bucket.count,
    resetAt: bucket.windowStart + opts.windowMs,
  };
}

/** Best-effort extract the caller's IP from common proxy headers. */
function getIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

/**
 * Apply a per-endpoint rate limit. Keys by authenticated wallet when
 * available, otherwise by IP. Returns null if allowed, or a 429 Response
 * the caller should return immediately.
 */
export function enforceRateLimit(
  request: Request,
  endpoint: string,
  opts: RateLimitOptions,
): Response | null {
  const wallet = getSessionWallet(request);
  const key = wallet
    ? `${endpoint}:wallet:${wallet}`
    : `${endpoint}:ip:${getIp(request)}`;
  const result = takeToken(key, opts);
  if (result.allowed) return null;
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      retryAfterSeconds: retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(opts.max),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
      },
    },
  );
}
