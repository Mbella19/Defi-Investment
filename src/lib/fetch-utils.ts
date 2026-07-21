import { log } from "./log";

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
  maxResponseBytes = 64 * 1024 * 1024,
): Promise<Response> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(new Error("Request timed out")), timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutController.signal])
    : timeoutController.signal;
  let response: Response;
  try {
    response = await fetch(input, { ...init, signal });
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }

  if (!response.body) {
    clearTimeout(timer);
    return response;
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    clearTimeout(timer);
    timeoutController.abort(new Error("Response exceeded size limit"));
    throw new Error(`Upstream response exceeded ${maxResponseBytes} bytes`);
  }

  const reader = response.body.getReader();
  let received = 0;
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) {
          cleanup();
          controller.close();
          return;
        }
        received += next.value.byteLength;
        if (received > maxResponseBytes) {
          cleanup();
          timeoutController.abort(new Error("Response exceeded size limit"));
          await reader.cancel().catch(() => undefined);
          controller.error(new Error(`Upstream response exceeded ${maxResponseBytes} bytes`));
          return;
        }
        controller.enqueue(next.value);
      } catch (error) {
        cleanup();
        controller.error(error);
      }
    },
    async cancel(reason) {
      cleanup();
      await reader.cancel(reason).catch(() => undefined);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Log an upstream failure to the operator console without breaking graceful
 * degradation. Use inside `catch` blocks of upstream-data fetches so an
 * outage shows up in logs instead of silently zeroing every priceUsd.
 */
export function warnUpstream(source: string, err: unknown): void {
  log.warn("upstream", "request failed", { source, error: err });
}
