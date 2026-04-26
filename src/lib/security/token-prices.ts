/**
 * Token price lookup for drain-detection. Uses DeFiLlama's free
 * `coins.llama.fi/prices/current` endpoint which accepts arbitrary
 * `chain:address` keys — no API key, no per-token onboarding, supports
 * every chain DeFiLlama tracks.
 *
 * Returns USD-per-unit price (already decimal-normalized — caller multiplies
 * by token amount in human units, NOT by raw on-chain value).
 */

const PRICE_BASE = "https://coins.llama.fi/prices/current";
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { price: number; expiresAt: number }>();

const ETHERSCAN_CHAIN_TO_LLAMA: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  56: "bsc",
  137: "polygon",
  250: "fantom",
  8453: "base",
  42161: "arbitrum",
  43114: "avax",
};

function llamaKey(chainId: number, address: string): string | null {
  const chain = ETHERSCAN_CHAIN_TO_LLAMA[chainId];
  if (!chain) return null;
  return `${chain}:${address.toLowerCase()}`;
}

/**
 * Batch-fetch USD prices for token contracts. Missing entries simply absent
 * from the returned map — caller must handle by skipping those tokens.
 */
export async function fetchTokenUsdPrices(
  tokens: Array<{ chainId: number; address: string }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (tokens.length === 0) return out;

  const now = Date.now();
  const toFetch: string[] = [];
  const keyToOriginal = new Map<string, string>();

  for (const t of tokens) {
    const key = llamaKey(t.chainId, t.address);
    if (!key) continue;
    const original = `${t.chainId}:${t.address.toLowerCase()}`;
    keyToOriginal.set(key, original);

    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      out.set(original, cached.price);
      continue;
    }
    toFetch.push(key);
  }

  if (toFetch.length === 0) return out;

  // DeFiLlama accepts comma-joined keys, returns { coins: { "chain:addr": { price, ... } } }
  for (let i = 0; i < toFetch.length; i += 100) {
    const batch = toFetch.slice(i, i + 100);
    try {
      const url = `${PRICE_BASE}/${batch.join(",")}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) continue;
      const json = (await res.json()) as { coins?: Record<string, { price?: number }> };
      const coins = json.coins ?? {};
      for (const [k, v] of Object.entries(coins)) {
        const price = typeof v.price === "number" ? v.price : 0;
        if (price <= 0) continue;
        cache.set(k, { price, expiresAt: now + CACHE_TTL_MS });
        const original = keyToOriginal.get(k);
        if (original) out.set(original, price);
      }
    } catch {
      // Best-effort. Tokens without prices are skipped by the caller.
    }
  }

  return out;
}
