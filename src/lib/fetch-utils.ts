/**
 * fetch wrapped with an AbortController-based timeout. Default 10s, which is
 * the right magnitude for free-tier upstreams (DeFiLlama, CoinGecko, GoPlus,
 * Beefy) — they reliably respond in under 2-3s when healthy and a 10s ceiling
 * keeps a stuck upstream from blocking the route until Next's maxDuration.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Log an upstream failure to the operator console without breaking graceful
 * degradation. Use inside `catch` blocks of upstream-data fetches so an
 * outage shows up in logs instead of silently zeroing every priceUsd.
 */
export function warnUpstream(source: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[upstream:${source}] ${message}`);
}
