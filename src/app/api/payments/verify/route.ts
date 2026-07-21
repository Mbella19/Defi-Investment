import { requireWallet } from "@/lib/auth/guard";
import { findPair } from "@/lib/payments/config";
import {
  confirmQuoteAndActivate,
  canonicalizeEvmTxHash,
  getQuoteForWallet,
  isExpired,
  isWithinGrace,
  markQuoteStatus,
  txAlreadyClaimed,
  TxAlreadyClaimedError,
} from "@/lib/payments/quote";
import { verifyTransaction } from "@/lib/payments/verify";
import { enforceRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import { getPlan } from "@/lib/plans/access";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  // Checkout polls while confirmations accrue. Keep this consistent with the
  // 30-second client cadence while still bounding RPC work per wallet.
  const limited = enforceRateLimit(request, "payments.verify", { max: 150, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;

  let parsed: unknown;
  try {
    parsed = await readJsonBody(request);
  } catch (error) {
    return jsonBodyErrorResponse(error);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const body = parsed as { id?: unknown; txHash?: unknown };
  const id = typeof body.id === "string" ? body.id : null;
  const txHash = typeof body.txHash === "string"
    ? canonicalizeEvmTxHash(body.txHash)
    : null;
  if (!id || !/^[A-Za-z0-9_-]{8,128}$/.test(id) || !txHash) {
    return Response.json({ error: "A quote id and valid EVM transaction hash are required" }, { status: 400 });
  }

  const quote = getQuoteForWallet(id, auth.wallet);
  if (!quote) {
    return Response.json({ error: "Quote not found or expired" }, { status: 404 });
  }
  if (quote.status === "confirmed") {
    return Response.json({
      ok: true,
      status: "already_confirmed",
      tier: getPlan(auth.wallet).tier,
      txHash: quote.txHash,
    });
  }
  // A payment mined before expiry can still be claimed during the bounded
  // verification grace period. The verifier independently rejects any
  // transaction mined outside the quote's original price-lock window.
  if (isExpired(quote) && !isWithinGrace(quote)) {
    markQuoteStatus(quote, "expired");
    return Response.json({ error: "Quote expired — request a new one" }, { status: 410 });
  }
  if (quote.status !== "pending") {
    return Response.json({ error: `Quote is ${quote.status}` }, { status: 409 });
  }
  if (quote.chainId === null) {
    return Response.json({ error: "Only EVM payment quotes are supported" }, { status: 410 });
  }
  if (txAlreadyClaimed(quote.chainId, txHash)) {
    return Response.json({ error: "This transaction has already been claimed" }, { status: 409 });
  }

  const pair = findPair(quote.chain, quote.token);
  if (!pair) {
    return Response.json({ error: "Unsupported chain/token in quote" }, { status: 500 });
  }
  const expectedContract = pair.contract?.toLowerCase() ?? null;
  if (
    pair.chainId !== quote.chainId ||
    expectedContract !== (quote.tokenContract?.toLowerCase() ?? null)
  ) {
    return Response.json(
      { error: "Payment configuration changed after this quote was created; request a new quote" },
      { status: 410 },
    );
  }

  const result = await verifyTransaction({
    pair,
    txHash,
    expectedRecipient: quote.recipientAddress,
    expectedAmount: quote.amountToken,
    expectedSender: quote.wallet,
    notBefore: quote.createdAt,
    notAfter: quote.expiresAt,
  });

  if (!result.ok) {
    // Remember retryable hashes so the reconciler can finish server-side if
    // the browser closes while confirmations are still accumulating.
    if (result.retryable) {
      try {
        markQuoteStatus(quote, "pending", txHash);
      } catch (err) {
        log.warn("payments", "could not persist pending tx hash", {
          quoteId: quote.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return Response.json(
        { ok: false, status: "pending", reason: result.reason, txHash },
        { status: 202, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return Response.json(
      { error: result.reason, code: "PAYMENT_REJECTED" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (quote.tier !== "pro" && quote.tier !== "ultra") {
    return Response.json({ error: "Quote tier invalid" }, { status: 500 });
  }

  try {
    const sub = confirmQuoteAndActivate(quote, txHash, result.observed);
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
      tier: sub.tier,
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
