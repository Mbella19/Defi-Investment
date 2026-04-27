/**
 * Bound an in-memory TTL cache. Call before insert: drop entries past
 * their TTL, then if the cache is still over `maxSize`, drop oldest
 * entries (FIFO via Map's insertion-order iteration).
 *
 * Cheap; safe to call on every set.
 */
export function boundCache<V extends { expiresAt: number }>(
  cache: Map<string, V>,
  maxSize: number,
): void {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
  if (cache.size <= maxSize) return;
  const overflow = cache.size - maxSize;
  let removed = 0;
  for (const k of cache.keys()) {
    if (removed >= overflow) break;
    cache.delete(k);
    removed++;
  }
}
