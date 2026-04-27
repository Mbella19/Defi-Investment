/**
 * Single-use nonces for SIWE sign-in. In-memory with TTL; survives across
 * requests inside one process. For multi-instance deployments swap this
 * with Redis or another shared store.
 */

const NONCE_TTL_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_ACTIVE_NONCES = 10_000;
const nonces = new Map<string, number>(); // nonce -> issuedAt epoch ms

export function rememberNonce(nonce: string): void {
  // Cap memory: drop oldest when over the cap.
  if (nonces.size >= MAX_ACTIVE_NONCES) {
    const first = nonces.keys().next().value;
    if (first) nonces.delete(first);
  }
  nonces.set(nonce, Date.now());
}

/** Returns true if the nonce was valid and unused; false otherwise. Always
 *  removes the nonce on first call so it cannot be replayed. */
export function consumeNonce(nonce: string): boolean {
  const issued = nonces.get(nonce);
  if (issued === undefined) return false;
  nonces.delete(nonce);
  return Date.now() - issued <= NONCE_TTL_MS;
}

function pruneExpired() {
  const cutoff = Date.now() - NONCE_TTL_MS;
  for (const [n, t] of nonces) {
    if (t < cutoff) nonces.delete(n);
  }
}

const _timer = setInterval(pruneExpired, PRUNE_INTERVAL_MS);
if (typeof _timer.unref === "function") _timer.unref();
