import { requireWallet } from "@/lib/auth/guard";
import { findPair } from "@/lib/payments/config";
import {
  confirmQuoteAndActivate,
  getQuote,
  isExpired,
  isWithinGrace,
  markQuoteStatus,
  txAlreadyClaimed,
  TxAlreadyClaimedError,
} from "@/lib/payments/quote";
import { verifyTransaction } from "@/lib/payments/verify";
import { enforceRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Failure reasons that can resolve on their own as the chain advances
 * (unmined, under-confirmed, transient upstream error). For these we persist
 * the tx hash on the quote so the background reconciler can finish the
 * verification server-side even if the user closes the tab. Deterministic
 * failures (wrong recipient, wrong amount, reverted) are never persisted.
 */
function isRetryableReason(reason: string): boolean {
  return /not yet (mined|confirmed|finalized)|need .*confirmation|lookup failed|rpc failed|transaction not found/i.test(
    reason,
  );
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "payments.verify", { max: 30, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;

  let body: { id?: unknown; txHash?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : null;
  const txHash =
    typeof body.txHash === "string" ? body.txHash.trim() : null;
  if (!id || !txHash) {
    return Response.json({ error: "id and txHash are required" }, { status: 400 });
  }

  const quote = getQuote(id);
  if (!quote) {
    return Response.json({ error: "Quote not found or expired" }, { status: 404 });
  }
  if (quote.wallet !== auth.wallet.toLowerCase()) {
    return Response.json({ error: "Quote belongs to a different wallet" }, { status: 403 });
  }
  if (quote.status === "confirmed") {
    return Response.json({
      ok: true,
      status: "already_confirmed",
      tier: quote.tier,
      txHash: quote.txHash,
    });
  }
  // Expiry gates creating a payment, not verifying one. A user who paid the
  // quoted amount before expiry must still be able to claim it — slow BTC
  // confirmations regularly outlive the quote window. Only reject beyond the
  // grace period.
  if (isExpired(quote) && !isWithinGrace(quote)) {
    markQuoteStatus(quote.id, "expired");
    return Response.json({ error: "Quote expired — request a new one" }, { status: 410 });
  }
  if (txAlreadyClaimed(txHash)) {
    return Response.json({ error: "This transaction has already been claimed" }, { status: 409 });
  }

  const pair = findPair(quote.chain, quote.token);
  if (!pair) {
    return Response.json({ error: "Unsupported chain/token in quote" }, { status: 500 });
  }

  const result = await verifyTransaction({
    pair,
    txHash,
    expectedRecipient: quote.recipientAddress,
    expectedAmount: quote.amountToken,
  });

  if (!result.ok) {
    // Remember the hash for retryable failures so the reconciler can finish
    // the job server-side. Best-effort: a unique-index conflict here means
    // another quote already carries this hash — skip silently, the eventual
    // confirm path clears squatters.
    if (isRetryableReason(result.reason)) {
      try {
        markQuoteStatus(quote.id, "pending", txHash);
      } catch (err) {
        log.warn("payments", "could not persist pending tx hash", {
          quoteId: quote.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return Response.json(
      { ok: false, status: "pending", reason: result.reason, txHash },
      { status: 200 },
    );
  }

  // Anti front-running: the in-site EVM flow always pays from the signed-in
  // wallet, so a sender mismatch means someone is claiming a transaction
  // they didn't send. Non-EVM flows pay from external wallets and stay
  // unbound by design.
  if (pair.chainId !== null && result.observed.from !== quote.wallet) {
    return Response.json(
      {
        error:
          "This payment was sent from a different wallet than the one you signed in with. Sign in with the paying wallet and try again.",
      },
      { status: 400 },
    );
  }

  if (quote.tier !== "pro" && quote.tier !== "ultra") {
    return Response.json({ error: "Quote tier invalid" }, { status: 500 });
  }

  try {
    const sub = confirmQuoteAndActivate(quote, txHash);
    log.info("payments", "payment confirmed", {
      quoteId: quote.id,
      wallet: quote.wallet,
      tier: quote.tier,
      chain: quote.chain,
      token: quote.token,
    });
    return Response.json({
      ok: true,
      status: "confirmed",
      tier: quote.tier,
      expiresAt: sub.expiresAt,
      observed: result.observed,
    });
  } catch (err) {
    if (err instanceof TxAlreadyClaimedError) {
      return Response.json(
        { error: "This transaction has already been claimed" },
        { status: 409 },
      );
    }
    log.error("payments", "confirm/activate failed after successful verification", {
      quoteId: quote.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      { error: "Payment verified but activation failed — retry in a moment; your payment is safe." },
      { status: 500 },
    );
  }
}
