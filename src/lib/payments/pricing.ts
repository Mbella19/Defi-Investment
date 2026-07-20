import "server-only";
import { fetchTokenPrices } from "@/lib/coingecko";
import type { PairConfig } from "./config";

/**
 * Convert a USD amount to the raw integer amount in the token's smallest
 * unit (e.g. wei, lamports, satoshis). Stablecoins (geckoId === null) are
 * pinned to $1; native tokens query CoinGecko for live USD price.
 */
export async function quoteAmount(pair: PairConfig, usd: number): Promise<{
  amountToken: string;
  amountTokenDisplay: string;
  unitPriceUsd: number;
}> {
  let unitPriceUsd = 1;
  if (pair.geckoId) {
    const prices = await fetchTokenPrices([pair.geckoId]);
    const entry = prices.get(pair.geckoId);
    if (!entry || !entry.usd || entry.usd <= 0) {
      throw new Error(`Could not fetch live USD price for ${pair.label}`);
    }
    unitPriceUsd = entry.usd;
  }
  const tokenAmount = usd / unitPriceUsd;
  const amountTokenDisplay = formatTokenAmount(tokenAmount, pair.decimals);
  const amountToken = toRawUnits(tokenAmount, pair.decimals);
  return { amountToken, amountTokenDisplay, unitPriceUsd };
}

function formatTokenAmount(amount: number, decimals: number): string {
  // Round to a sensible display precision: 6 sig figs for natives, 2 for stables.
  const precision = decimals > 6 ? 6 : 2;
  const fixed = amount.toFixed(precision);
  return fixed.replace(/\.?0+$/, "");
}

export function toRawUnits(amount: number, decimals: number): string {
  // String-based decimal shift instead of `amount * 10**decimals`: float
  // multiplication loses integer precision above 2^53 (any 18-decimal token)
  // and Number.toString switches to exponential notation at 1e21, which
  // BigInt() rejects. Precision capped at 12 fractional digits — far below
  // anything the ±0.5% comparison tolerance could notice.
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Cannot convert non-finite amount to raw units: ${amount}`);
  }
  const precision = Math.min(decimals, 12);
  const fixed = amount.toFixed(precision);
  const [whole, frac = ""] = fixed.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  const raw = BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || "0");
  return raw.toString();
}

export function compareAmount(observedRaw: string, expectedRaw: string): boolean {
  // Allow ±0.5% tolerance to absorb rounding + price drift between
  // quote-time and actual on-chain settlement.
  try {
    const observed = BigInt(observedRaw);
    const expected = BigInt(expectedRaw);
    if (observed === expected) return true;
    const diff = observed > expected ? observed - expected : expected - observed;
    const tolerance = expected / BigInt(200); // 0.5%
    return diff <= tolerance;
  } catch {
    return false;
  }
}
