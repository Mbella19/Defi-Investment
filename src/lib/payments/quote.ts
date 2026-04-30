import "server-only";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import type { Tier } from "@/lib/plans/access";
import { findPair } from "./config";
import { compareAmount, quoteAmount } from "./pricing";

const QUOTE_TTL_MS = 30 * 60 * 1000; // 30 min — long enough for users to copy/paste tx

export interface PaymentQuote {
  id: string;
  wallet: string;
  tier: Tier;
  chain: string;
  token: string;
  recipientAddress: string;
  amountUsd: number;
  amountToken: string;
  amountTokenDisplay: string;
  decimals: number;
  unitPriceUsd: number;
  status: "pending" | "confirmed" | "failed" | "expired";
  txHash: string | null;
  expiresAt: string;
  createdAt: string;
}

export async function createQuote(params: {
  wallet: string;
  tier: "pro" | "ultra";
  chain: string;
  token: string;
  amountUsd: number;
}): Promise<PaymentQuote> {
  const pair = findPair(params.chain, params.token);
  if (!pair || !pair.enabled) {
    throw new Error(`Unsupported payment pair: ${params.token} on ${params.chain}`);
  }
  const recipient = pair.recipient();
  if (!recipient) {
    throw new Error(`Deposit address not configured for ${pair.label}`);
  }

  const { amountToken, amountTokenDisplay, unitPriceUsd } = await quoteAmount(pair, params.amountUsd);

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO pending_payments (
       id, wallet_address, tier, chain, token, recipient_address,
       amount_usd, amount_token, token_decimals, status, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    id,
    params.wallet.toLowerCase(),
    params.tier,
    params.chain,
    params.token,
    recipient,
    params.amountUsd,
    amountToken,
    pair.decimals,
    expiresAt,
  );

  return {
    id,
    wallet: params.wallet.toLowerCase(),
    tier: params.tier,
    chain: params.chain,
    token: params.token,
    recipientAddress: recipient,
    amountUsd: params.amountUsd,
    amountToken,
    amountTokenDisplay,
    decimals: pair.decimals,
    unitPriceUsd,
    status: "pending",
    txHash: null,
    expiresAt,
    createdAt: new Date().toISOString(),
  };
}

interface QuoteRow {
  id: string;
  wallet_address: string;
  tier: string;
  chain: string;
  token: string;
  recipient_address: string;
  amount_usd: number;
  amount_token: string;
  token_decimals: number;
  status: string;
  tx_hash: string | null;
  expires_at: string;
  created_at: string;
}

export function getQuote(id: string): PaymentQuote | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM pending_payments WHERE id = ?")
    .get(id) as QuoteRow | undefined;
  if (!row) return null;
  return rowToQuote(row);
}

function rowToQuote(row: QuoteRow): PaymentQuote {
  return {
    id: row.id,
    wallet: row.wallet_address,
    tier: row.tier as Tier,
    chain: row.chain,
    token: row.token,
    recipientAddress: row.recipient_address,
    amountUsd: row.amount_usd,
    amountToken: row.amount_token,
    amountTokenDisplay: formatDisplayAmount(row.amount_token, row.token_decimals),
    decimals: row.token_decimals,
    unitPriceUsd: row.amount_usd > 0 ? row.amount_usd / Number(row.amount_token) * Math.pow(10, row.token_decimals) : 0,
    status: row.status as PaymentQuote["status"],
    txHash: row.tx_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function formatDisplayAmount(raw: string, decimals: number): string {
  try {
    const big = BigInt(raw);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = big / divisor;
    const frac = big % divisor;
    if (frac === BigInt(0)) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  } catch {
    return raw;
  }
}

export function isExpired(quote: PaymentQuote): boolean {
  return new Date(quote.expiresAt).getTime() < Date.now();
}

export function markQuoteStatus(
  id: string,
  status: PaymentQuote["status"],
  txHash?: string | null,
): void {
  const db = getDb();
  if (status === "confirmed") {
    db.prepare(
      "UPDATE pending_payments SET status = ?, tx_hash = ?, verified_at = datetime('now') WHERE id = ?",
    ).run(status, txHash ?? null, id);
  } else {
    db.prepare(
      "UPDATE pending_payments SET status = ?, tx_hash = COALESCE(?, tx_hash) WHERE id = ?",
    ).run(status, txHash ?? null, id);
  }
}

export function txAlreadyClaimed(txHash: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT 1 FROM pending_payments WHERE tx_hash = ? AND status = 'confirmed' LIMIT 1",
    )
    .get(txHash) as { 1: number } | undefined;
  return row !== undefined;
}

export { compareAmount };
