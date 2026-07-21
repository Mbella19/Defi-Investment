import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { resolveTier } from "@/lib/plans/access";
import {
  confirmQuoteAndActivate,
  listReconcilableQuotes,
  type PaymentQuote,
} from "@/lib/payments/quote";

let txSequence = 1;

function makePendingQuote(wallet: string): PaymentQuote {
  const now = Date.now();
  const quote: PaymentQuote = {
    id: randomUUID(),
    wallet: wallet.toLowerCase(),
    tier: "pro",
    chain: "ethereum",
    chainId: 1,
    token: "USDC",
    tokenContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    recipientAddress: "0x9999999999999999999999999999999999999999",
    amountUsd: 49,
    amountToken: "49000000",
    amountTokenDisplay: "49",
    decimals: 6,
    unitPriceUsd: 1,
    status: "pending",
    txHash: null,
    createdAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 29 * 60_000).toISOString(),
    claimDeadlineAt: new Date(now + 24 * 60 * 60_000).toISOString(),
  };
  getDb().prepare(
    `INSERT INTO pending_payments (
       id, wallet_address, tier, chain, chain_id, token, token_contract,
       recipient_address, amount_usd, amount_token, token_decimals,
       unit_price_usd, status, created_at, expires_at, claim_deadline_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).run(
    quote.id,
    quote.wallet,
    quote.tier,
    quote.chain,
    quote.chainId,
    quote.token,
    quote.tokenContract,
    quote.recipientAddress,
    quote.amountUsd,
    quote.amountToken,
    quote.decimals,
    quote.unitPriceUsd,
    quote.createdAt,
    quote.expiresAt,
    quote.claimDeadlineAt,
  );
  return quote;
}

function nextTxHash(): string {
  return `0x${(txSequence++).toString(16).padStart(64, "0")}`;
}

describe("payment confirmation invariants", () => {
  it("atomically confirms a valid payment for the persisted wallet", () => {
    const wallet = "0x4000000000000000000000000000000000000001";
    const quote = makePendingQuote(wallet);
    const settledAt = new Date().toISOString();

    const result = confirmQuoteAndActivate(quote, nextTxHash(), { from: wallet, settledAt });

    expect(result.tier).toBe("pro");
    expect(resolveTier(wallet)).toBe("pro");
    const row = getDb()
      .prepare("SELECT status, payer_address, settled_at FROM pending_payments WHERE id = ?")
      .get(quote.id) as { status: string; payer_address: string; settled_at: string };
    expect(row.status).toBe("confirmed");
    expect(row.payer_address).toBe(wallet);
    expect(row.settled_at).toBe(settledAt);
  });

  it("rejects a verified sender that differs from the signed-in quote wallet", () => {
    const wallet = "0x4000000000000000000000000000000000000002";
    const quote = makePendingQuote(wallet);

    expect(() => confirmQuoteAndActivate(quote, nextTxHash(), {
      from: "0x5000000000000000000000000000000000000002",
      settledAt: new Date().toISOString(),
    })).toThrow("sender does not match");
    expect(resolveTier(wallet)).toBe("free");
  });

  it("rejects settlement outside the immutable quote window", () => {
    const wallet = "0x4000000000000000000000000000000000000003";
    const quote = makePendingQuote(wallet);

    expect(() => confirmQuoteAndActivate(quote, nextTxHash(), {
      from: wallet,
      settledAt: new Date(Date.parse(quote.expiresAt) + 1).toISOString(),
    })).toThrow("outside the quote window");
    expect(resolveTier(wallet)).toBe("free");
  });

  it("uses persisted quote terms instead of caller-mutated values", () => {
    const wallet = "0x4000000000000000000000000000000000000004";
    const attacker = "0x5000000000000000000000000000000000000004";
    const quote = makePendingQuote(wallet);
    const mutated: PaymentQuote = {
      ...quote,
      wallet: attacker,
      tier: "ultra",
      amountToken: "1",
    };

    const result = confirmQuoteAndActivate(mutated, nextTxHash(), {
      from: wallet,
      settledAt: new Date().toISOString(),
    });

    expect(result.tier).toBe("pro");
    expect(resolveTier(wallet)).toBe("pro");
    expect(resolveTier(attacker)).toBe("free");
  });

  it("expires unclaimable rows and applies terminal-payment retention", () => {
    const db = getDb();
    const pending = makePendingQuote("0x4000000000000000000000000000000000000005");
    const pendingHash = nextTxHash();
    db.prepare(
      `UPDATE pending_payments
       SET tx_hash = ?, canonical_tx_hash = ?, claim_deadline_at = ?
       WHERE id = ?`,
    ).run(pendingHash, pendingHash, new Date(Date.now() - 60_000).toISOString(), pending.id);

    expect(listReconcilableQuotes().some((quote) => quote.id === pending.id)).toBe(false);
    expect(
      (db.prepare("SELECT status FROM pending_payments WHERE id = ?").get(pending.id) as {
        status: string;
      }).status,
    ).toBe("expired");

    const failed = makePendingQuote("0x4000000000000000000000000000000000000006");
    const failedHash = nextTxHash();
    db.prepare(
      `UPDATE pending_payments
       SET status = 'failed', tx_hash = ?, canonical_tx_hash = ?, created_at = ?
       WHERE id = ?`,
    ).run(failedHash, failedHash, new Date(Date.now() - 91 * 86_400_000).toISOString(), failed.id);

    const confirmed = makePendingQuote("0x4000000000000000000000000000000000000007");
    const confirmedHash = nextTxHash();
    db.prepare(
      `UPDATE pending_payments
       SET status = 'confirmed', tx_hash = ?, canonical_tx_hash = ?, created_at = ?
       WHERE id = ?`,
    ).run(
      confirmedHash,
      confirmedHash,
      new Date(Date.now() - 120 * 86_400_000).toISOString(),
      confirmed.id,
    );

    listReconcilableQuotes();
    expect(db.prepare("SELECT 1 FROM pending_payments WHERE id = ?").get(failed.id)).toBeUndefined();
    expect(db.prepare("SELECT 1 FROM pending_payments WHERE id = ?").get(confirmed.id)).toBeTruthy();
  });
});
