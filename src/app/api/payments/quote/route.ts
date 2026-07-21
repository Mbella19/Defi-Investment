import { requireWallet } from "@/lib/auth/guard";
import { getPlan, TIER_PRICE_USD } from "@/lib/plans/access";
import { findPair, PAYMENT_PAIRS } from "@/lib/payments/config";
import { createQuote, getQuoteForWallet, isWithinGrace } from "@/lib/payments/quote";
import { enforceRateLimit } from "@/lib/rate-limit";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  // With ?id= — wallet-scoped quote lookup for the checkout resume flow
  // (page reload mid-payment must not silently mint a new quote).
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
      return Response.json({ error: "Quote not found" }, { status: 404 });
    }
    const quote = getQuoteForWallet(id, auth.wallet);
    if (!quote) {
      return Response.json({ error: "Quote not found" }, { status: 404 });
    }
    return Response.json(
      { ...quote, resumable: quote.status === "pending" && isWithinGrace(quote) },
      { headers: PRIVATE_HEADERS },
    );
  }

  // Public: list of supported pairs so the checkout UI can render the picker
  // even before a wallet is connected. We do NOT return the recipient address —
  // that is delivered as part of the per-quote POST response and stays in
  // memory for the wagmi flow rather than being shown in the UI.
  return Response.json({
    pairs: PAYMENT_PAIRS.map((p) => ({
      chain: p.chain,
      token: p.token,
      label: p.label,
      chainLabel: p.chainLabel,
      decimals: p.decimals,
      chainId: p.chainId,
      isEvm: true,
      contract: p.contract,
      enabled: p.enabled && p.recipient() !== null,
    })),
    prices: TIER_PRICE_USD,
  });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "payments.quote", { max: 30, windowMs: 60 * 60 * 1000 });
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
  const body = parsed as { tier?: unknown; chain?: unknown; token?: unknown };
  const tier = body.tier === "pro" || body.tier === "ultra" ? body.tier : null;
  const chain = typeof body.chain === "string" ? body.chain : null;
  const token = typeof body.token === "string" ? body.token : null;
  if (!tier || !chain || !token) {
    return Response.json({ error: "tier, chain, and token are required" }, { status: 400 });
  }

  const currentPlan = getPlan(auth.wallet);
  if (currentPlan.tier === "ultra" && tier === "pro") {
    return Response.json(
      { error: "An active Ultra subscription cannot be downgraded mid-term" },
      { status: 409, headers: PRIVATE_HEADERS },
    );
  }

  const pair = findPair(chain, token);
  if (!pair || !pair.enabled || pair.recipient() === null) {
    return Response.json({ error: "Unsupported or unconfigured payment pair" }, { status: 400 });
  }

  try {
    const quote = await createQuote({
      wallet: auth.wallet,
      tier,
      chain,
      token,
      amountUsd: TIER_PRICE_USD[tier],
    });
    return Response.json(quote, { headers: PRIVATE_HEADERS });
  } catch {
    // Pricing/provider failures can contain upstream details. Keep those out
    // of the public response; callers only need to know the quote is retryable.
    return Response.json(
      { error: "Unable to create a live payment quote; try again shortly" },
      { status: 502, headers: PRIVATE_HEADERS },
    );
  }
}
