/**
 * Map with a concurrency ceiling — preserves input order in the results.
 *
 * NOTE: a rejected `fn` rejects the whole call (like Promise.all). Every
 * current call site wraps its own errors (analyzeProtocol batches catch
 * internally; getPoolStability resolves null on failure) — keep it that way
 * or wrap `fn` in try/catch at the call site.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
