import { requireWallet } from "@/lib/auth/guard";
import { activateSubscription } from "@/lib/plans/access";
import { findPair } from "@/lib/payments/config";
import { getQuote, isExpired, markQuoteStatus, txAlreadyClaimed } from "@/lib/payments/quote";
import { verifyTransaction } from "@/lib/payments/verify";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  if (isExpired(quote)) {
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
    return Response.json(
      { ok: false, status: "pending", reason: result.reason, txHash },
      { status: 200 },
    );
  }

  if (quote.tier !== "pro" && quote.tier !== "ultra") {
    return Response.json({ error: "Quote tier invalid" }, { status: 500 });
  }

  markQuoteStatus(quote.id, "confirmed", txHash);
  const sub = activateSubscription({
    wallet: auth.wallet,
    tier: quote.tier,
    chain: quote.chain,
    token: quote.token,
    amount: quote.amountToken,
    txHash,
  });

  return Response.json({
    ok: true,
    status: "confirmed",
    tier: quote.tier,
    expiresAt: sub.expiresAt,
    observed: result.observed,
  });
}
