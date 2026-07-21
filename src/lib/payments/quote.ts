import "server-only";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { activateSubscription, type Tier } from "@/lib/plans/access";
import { log } from "@/lib/log";
import { findPair } from "./config";
import { compareAmount, quoteAmount } from "./pricing";

const QUOTE_TTL_MS = 30 * 60 * 1000;

/**
 * Verification grace after expiry. Expiry gates *creating* a payment; a user
 * who paid the quoted amount before expiry must still be able to verify —
 * the price was locked when they paid, so honoring it within a bounded
 * window is correct.
 */
export const PAYMENT_GRACE_MS = 24 * 60 * 60 * 1000;

export interface PaymentQuote {
  id: string;
  wallet: string;
  tier: Tier;
  chain: string;
  chainId: number | null;
  token: string;
  tokenContract: string | null;
  recipientAddress: string;
  amountUsd: number;
  amountToken: string;
  amountTokenDisplay: string;
  decimals: number;
  unitPriceUsd: number;
  status: "pending" | "confirmed" | "failed" | "expired";
  txHash: string | null;
  expiresAt: string;
  claimDeadlineAt: string;
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
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + QUOTE_TTL_MS).toISOString();
  const claimDeadlineAt = new Date(now + QUOTE_TTL_MS + PAYMENT_GRACE_MS).toISOString();
  const db = getDb();
  pruneStaleQuotes(db);
  db.prepare(
    `INSERT INTO pending_payments (
       id, wallet_address, tier, chain, chain_id, token, token_contract,
       recipient_address, amount_usd, amount_token, token_decimals,
       unit_price_usd, status, created_at, expires_at, claim_deadline_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).run(
    id,
    params.wallet.toLowerCase(),
    params.tier,
    params.chain,
    pair.chainId,
    params.token,
    pair.contract?.toLowerCase() ?? null,
    recipient,
    params.amountUsd,
    amountToken,
    pair.decimals,
    unitPriceUsd,
    createdAt,
    expiresAt,
    claimDeadlineAt,
  );

  return {
    id,
    wallet: params.wallet.toLowerCase(),
    tier: params.tier,
    chain: params.chain,
    chainId: pair.chainId,
    token: params.token,
    tokenContract: pair.contract,
    recipientAddress: recipient,
    amountUsd: params.amountUsd,
    amountToken,
    amountTokenDisplay,
    decimals: pair.decimals,
    unitPriceUsd,
    status: "pending",
    txHash: null,
    expiresAt,
    claimDeadlineAt,
    createdAt,
  };
}

interface QuoteRow {
  id: string;
  wallet_address: string;
  tier: string;
  chain: string;
  chain_id: number | null;
  token: string;
  token_contract: string | null;
  recipient_address: string;
  amount_usd: number;
  amount_token: string;
  token_decimals: number;
  unit_price_usd: number | null;
  status: string;
  tx_hash: string | null;
  canonical_tx_hash: string | null;
  payer_address: string | null;
  settled_at: string | null;
  expires_at: string;
  claim_deadline_at: string | null;
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
  pruneStaleQuotes(db);
  const rows = db
    .prepare(
      `SELECT * FROM pending_payments
       WHERE status = 'pending' AND tx_hash IS NOT NULL
         AND chain_id IS NOT NULL
         AND datetime(COALESCE(claim_deadline_at, datetime(expires_at, '+24 hours'))) >= datetime('now')
         AND datetime(created_at) >= datetime('now', ?)
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
 * GC abandoned quotes: terminal rows with no hash are short-lived noise;
 * failed/expired attempts with a hash are retained for 90 days for support and
 * fraud review. Confirmed payments are the durable financial audit trail and
 * are never removed here.
 */
function pruneStaleQuotes(db: ReturnType<typeof getDb>): void {
  try {
    db.prepare(
      `UPDATE pending_payments
       SET status = 'expired'
       WHERE status = 'pending'
         AND datetime(COALESCE(claim_deadline_at, datetime(expires_at, '+24 hours'))) < datetime('now')`,
    ).run();
    db.prepare(
      `DELETE FROM pending_payments
       WHERE status IN ('pending', 'expired', 'failed')
         AND tx_hash IS NULL
         AND datetime(created_at) < datetime('now', '-7 days')`,
    ).run();
    db.prepare(
      `DELETE FROM pending_payments
       WHERE status IN ('expired', 'failed')
         AND datetime(created_at) < datetime('now', '-90 days')`,
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
    chainId: row.chain_id,
    token: row.token,
    tokenContract: row.token_contract,
    recipientAddress: row.recipient_address,
    amountUsd: row.amount_usd,
    amountToken: row.amount_token,
    amountTokenDisplay: formatDisplayAmount(row.amount_token, row.token_decimals),
    decimals: row.token_decimals,
    unitPriceUsd:
      row.unit_price_usd ??
      (row.amount_usd > 0
        ? row.amount_usd / Number(row.amount_token) * Math.pow(10, row.token_decimals)
        : 0),
    status: row.status as PaymentQuote["status"],
    txHash: row.tx_hash,
    expiresAt: normalizeStoredDate(row.expires_at),
    claimDeadlineAt: row.claim_deadline_at
      ? normalizeStoredDate(row.claim_deadline_at)
      : new Date(Date.parse(normalizeStoredDate(row.expires_at)) + PAYMENT_GRACE_MS).toISOString(),
    createdAt: normalizeStoredDate(row.created_at),
  };
}

function normalizeStoredDate(value: string): string {
  const candidate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
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
  return new Date(quote.claimDeadlineAt).getTime() >= Date.now();
}

export function markQuoteStatus(
  quote: PaymentQuote,
  status: PaymentQuote["status"],
  txHash?: string | null,
): void {
  const db = getDb();
  const canonical = txHash ? canonicalizeEvmTxHash(txHash) : null;
  if (txHash && !canonical) throw new Error("Invalid EVM transaction hash");
  if (status === "confirmed") {
    db.prepare(
      `UPDATE pending_payments
       SET status = ?, tx_hash = ?, canonical_tx_hash = ?, verified_at = datetime('now')
       WHERE id = ?`,
    ).run(status, canonical, canonical, quote.id);
  } else {
    db.prepare(
      `UPDATE pending_payments
       SET status = ?,
           tx_hash = COALESCE(?, tx_hash),
           canonical_tx_hash = COALESCE(?, canonical_tx_hash)
       WHERE id = ?`,
    ).run(status, canonical, canonical, quote.id);
  }
}

/**
 * Forget a submitted hash that reached a terminal rejection while leaving
 * the immutable quote available for another pre-expiry transaction hash.
 * This prevents a reverted or mistaken first broadcast from poisoning a paid
 * quote for the rest of its claim-grace window.
 */
export function clearPendingQuoteTx(quote: PaymentQuote): void {
  getDb()
    .prepare(
      `UPDATE pending_payments
       SET tx_hash = NULL, canonical_tx_hash = NULL
       WHERE id = ? AND status = 'pending'`,
    )
    .run(quote.id);
}

export function canonicalizeEvmTxHash(txHash: string): string | null {
  const trimmed = txHash.trim();
  return /^0x[0-9a-fA-F]{64}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function txAlreadyClaimed(chainId: number, txHash: string): boolean {
  const canonical = canonicalizeEvmTxHash(txHash);
  if (!canonical) return false;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM pending_payments
       WHERE chain_id = ? AND canonical_tx_hash = ? AND status = 'confirmed'
       LIMIT 1`,
    )
    .get(chainId, canonical) as { 1: number } | undefined;
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
 * Pending rows do not reserve a transaction hash. Only a successfully
 * verified, confirmed claim is unique per chain, so an attacker cannot block
 * the rightful sender by pre-submitting a publicly visible hash.
 */
export function confirmQuoteAndActivate(
  quote: PaymentQuote,
  txHash: string,
  observed: { from: string; settledAt: string },
): { expiresAt: string; tier: "pro" | "ultra" } {
  const canonical = canonicalizeEvmTxHash(txHash);
  if (!canonical) throw new Error("Invalid EVM transaction hash");
  const db = getDb();
  const run = db.transaction((): { expiresAt: string; tier: "pro" | "ultra" } => {
    // Reload every security-relevant value from SQLite. The caller's quote
    // may be stale, and only persisted immutable quote data is authoritative
    // when money is converted into subscription access.
    const current = db
      .prepare("SELECT * FROM pending_payments WHERE id = ?")
      .get(quote.id) as QuoteRow | undefined;
    if (!current) throw new Error("Payment quote no longer exists");
    const stored = rowToQuote(current);
    if (stored.tier !== "pro" && stored.tier !== "ultra") {
      throw new Error(`Cannot activate subscription for tier: ${stored.tier}`);
    }
    if (stored.chainId === null) throw new Error("Cannot activate a non-EVM payment quote");
    if (Date.parse(stored.claimDeadlineAt) < Date.now()) {
      throw new Error("Payment claim deadline has passed");
    }

    const payer = observed.from.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(payer) || payer !== stored.wallet.toLowerCase()) {
      throw new Error("Verified payment sender does not match the quote wallet");
    }
    const settledAtMs = Date.parse(observed.settledAt);
    if (
      !Number.isFinite(settledAtMs) ||
      settledAtMs < Date.parse(stored.createdAt) ||
      settledAtMs > Date.parse(stored.expiresAt)
    ) {
      throw new Error("Verified payment time is outside the quote window");
    }

    const claimed = db
      .prepare(
        `SELECT 1 FROM pending_payments
         WHERE chain_id = ? AND canonical_tx_hash = ? AND status = 'confirmed' AND id != ?
         LIMIT 1`,
      )
      .get(stored.chainId, canonical, stored.id);
    if (claimed) throw new TxAlreadyClaimedError();
    if (current.status === "confirmed") {
      if (current.canonical_tx_hash !== canonical) {
        throw new Error("Payment quote was confirmed with a different transaction");
      }
      const subscription = db
        .prepare("SELECT tier, expires_at FROM subscriptions WHERE wallet_address = ?")
        .get(stored.wallet) as { tier: "pro" | "ultra"; expires_at: string } | undefined;
      if (!subscription) throw new Error("Confirmed payment is missing its subscription");
      return { expiresAt: normalizeStoredDate(subscription.expires_at), tier: subscription.tier };
    }
    if (current.status !== "pending") throw new Error(`Payment quote is ${current.status}`);
    db.prepare(
      `UPDATE pending_payments
       SET status = 'confirmed', tx_hash = ?, canonical_tx_hash = ?,
           payer_address = ?, settled_at = ?, verified_at = datetime('now')
       WHERE id = ? AND status = 'pending'`,
    ).run(canonical, canonical, payer, new Date(settledAtMs).toISOString(), stored.id);
    return activateSubscription({
      wallet: stored.wallet,
      tier: stored.tier,
      chain: stored.chain,
      token: stored.token,
      amount: stored.amountToken,
      txHash: canonical,
    });
  });
  return run();
}

export { compareAmount };
