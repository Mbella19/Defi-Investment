import "server-only";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { activateSubscription, type Tier } from "@/lib/plans/access";
import { log } from "@/lib/log";
import { findPair } from "./config";
import { compareAmount, quoteAmount } from "./pricing";

// Per-chain quote lifetime. The old flat 30 min regularly expired quotes for
// users who had ALREADY PAID: a Bitcoin confirmation averages ~10 min but can
// take an hour, and Tron users paste hashes from external wallets.
const QUOTE_TTL_BY_CHAIN: Record<string, number> = {
  bitcoin: 4 * 60 * 60 * 1000,
  tron: 60 * 60 * 1000,
};
const DEFAULT_QUOTE_TTL_MS = 30 * 60 * 1000;

/**
 * Verification grace after expiry. Expiry gates *creating* a payment; a user
 * who paid the quoted amount before expiry must still be able to verify —
 * the price was locked when they paid, so honoring it within a bounded
 * window is correct.
 */
export const PAYMENT_GRACE_MS = 24 * 60 * 60 * 1000;

function quoteTtlMs(chain: string): number {
  return QUOTE_TTL_BY_CHAIN[chain] ?? DEFAULT_QUOTE_TTL_MS;
}

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
  const expiresAt = new Date(Date.now() + quoteTtlMs(pair.chain)).toISOString();
  const db = getDb();
  pruneStaleQuotes(db);
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

/**
 * Pending quotes that carry a tx hash — the user submitted a payment that
 * wasn't final yet. These are the reconciler's work queue.
 */
export function listReconcilableQuotes(maxAgeHours = 48): PaymentQuote[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM pending_payments
       WHERE status = 'pending' AND tx_hash IS NOT NULL
         AND created_at >= datetime('now', ?)
       ORDER BY created_at ASC
       LIMIT 50`,
    )
    .all(`-${maxAgeHours} hours`) as QuoteRow[];
  return rows.map(rowToQuote);
}

/** Wallet-scoped quote lookup for the checkout resume flow. */
export function getQuoteForWallet(id: string, wallet: string): PaymentQuote | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM pending_payments WHERE id = ? AND wallet_address = ?")
    .get(id, wallet.toLowerCase()) as QuoteRow | undefined;
  if (!row) return null;
  return rowToQuote(row);
}

/**
 * GC abandoned quotes: pending/expired rows with no tx hash older than 7
 * days are noise (the user never paid). Rows carrying a tx hash are kept —
 * they're either confirmed (audit trail) or awaiting the reconciler.
 */
function pruneStaleQuotes(db: ReturnType<typeof getDb>): void {
  try {
    db.prepare(
      `DELETE FROM pending_payments
       WHERE status IN ('pending', 'expired', 'failed')
         AND tx_hash IS NULL
         AND created_at < datetime('now', '-7 days')`,
    ).run();
  } catch (err) {
    log.warn("payments", "stale-quote prune failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
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

/** Expired, but still inside the verification grace window (user may have paid). */
export function isWithinGrace(quote: PaymentQuote): boolean {
  return new Date(quote.expiresAt).getTime() + PAYMENT_GRACE_MS >= Date.now();
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

export class TxAlreadyClaimedError extends Error {
  constructor() {
    super("Transaction already claimed by a confirmed payment");
    this.name = "TxAlreadyClaimedError";
  }
}

/**
 * Atomically claim a verified tx hash for a quote and activate the
 * subscription. Runs as ONE SQLite transaction so a concurrent verify of the
 * same hash can't double-activate, and a crash between "mark confirmed" and
 * "activate" can't strand a paid-but-inactive user.
 *
 * Any *other* non-confirmed row squatting on this hash (a stale pending
 * attempt, or someone pre-storing a hash they didn't pay) is cleared first —
 * the on-chain verification the caller just performed is the authority.
 */
export function confirmQuoteAndActivate(
  quote: PaymentQuote,
  txHash: string,
): { expiresAt: string } {
  if (quote.tier !== "pro" && quote.tier !== "ultra") {
    throw new Error(`Cannot activate subscription for tier: ${quote.tier}`);
  }
  const tier = quote.tier;
  const db = getDb();
  const run = db.transaction((): { expiresAt: string } => {
    const claimed = db
      .prepare(
        "SELECT 1 FROM pending_payments WHERE tx_hash = ? AND status = 'confirmed' AND id != ? LIMIT 1",
      )
      .get(txHash, quote.id);
    if (claimed) throw new TxAlreadyClaimedError();
    db.prepare(
      "UPDATE pending_payments SET tx_hash = NULL WHERE tx_hash = ? AND id != ? AND status != 'confirmed'",
    ).run(txHash, quote.id);
    db.prepare(
      "UPDATE pending_payments SET status = 'confirmed', tx_hash = ?, verified_at = datetime('now') WHERE id = ?",
    ).run(txHash, quote.id);
    return activateSubscription({
      wallet: quote.wallet,
      tier,
      chain: quote.chain,
      token: quote.token,
      amount: quote.amountToken,
      txHash,
    });
  });
  return run();
}

export { compareAmount };
