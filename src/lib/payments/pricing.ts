import "server-only";
import { fetchTokenPrices } from "@/lib/coingecko";
import type { PairConfig } from "./config";

/**
 * Convert a USD amount to the raw integer amount in the token's smallest
 * unit (e.g. wei). Every asset, including stablecoins, uses a live USD price
 * so a depeg cannot silently undercharge the checkout.
 */
export async function quoteAmount(pair: PairConfig, usd: number): Promise<{
  amountToken: string;
  amountTokenDisplay: string;
  unitPriceUsd: number;
}> {
  // Settlement terms must come from a request-time price. Portfolio displays
  // may use the shared 2-minute cache; a 30-minute immutable payment quote may not.
  const prices = await fetchTokenPrices([pair.geckoId], { fresh: true });
  const entry = prices.get(pair.geckoId);
  if (!entry || !Number.isFinite(entry.usd) || entry.usd <= 0) {
    throw new Error(`Could not fetch live USD price for ${pair.label}`);
  }
  const unitPriceUsd = entry.usd;
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
  // Shift the Number's canonical decimal representation with strings instead
  // of multiplying by 10**decimals (which loses integer precision above 2^53).
  // Any discarded fractional raw unit rounds UP: checkout may overcharge by at
  // most one smallest unit, but can never activate from a rounded-down quote.
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Cannot convert non-finite amount to raw units: ${amount}`);
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`Cannot convert amount with invalid decimals: ${decimals}`);
  }
  if (amount === 0) return "0";

  const canonical = amount.toString().toLowerCase();
  const match = canonical.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/);
  if (!match) throw new Error("Could not convert token amount to decimal units");
  const whole = match[1];
  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? "0");
  if (!Number.isSafeInteger(exponent)) {
    throw new Error("Token amount exponent is outside the supported range");
  }

  const digits = `${whole}${fraction}`;
  const decimalIndex = whole.length + exponent;
  const rawIndex = decimalIndex + decimals;
  let raw: bigint;
  let discarded = "";
  if (rawIndex <= 0) {
    raw = BigInt(0);
    discarded = digits;
  } else if (rawIndex >= digits.length) {
    raw = BigInt(digits.padEnd(rawIndex, "0"));
  } else {
    raw = BigInt(digits.slice(0, rawIndex) || "0");
    discarded = digits.slice(rawIndex);
  }
  if (/[1-9]/.test(discarded)) raw += BigInt(1);
  return raw.toString();
}

export function compareAmount(observedRaw: string, expectedRaw: string): boolean {
  // The quote is locked before the wallet call is constructed, so there is
  // no legitimate settlement drift. Overpayment is accepted (and surfaced
  // by the wallet); underpayment never activates a subscription.
  try {
    const observed = BigInt(observedRaw);
    const expected = BigInt(expectedRaw);
    return expected > BigInt(0) && observed >= expected;
  } catch {
    return false;
  }
}
