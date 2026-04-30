import { requireWallet } from "@/lib/auth/guard";
import { TIER_PRICE_USD } from "@/lib/plans/access";
import { findPair, PAYMENT_PAIRS } from "@/lib/payments/config";
import { createQuote } from "@/lib/payments/quote";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
      isEvm: p.chainId !== null,
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

  let body: { tier?: unknown; chain?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const tier = body.tier === "pro" || body.tier === "ultra" ? body.tier : null;
  const chain = typeof body.chain === "string" ? body.chain : null;
  const token = typeof body.token === "string" ? body.token : null;
  if (!tier || !chain || !token) {
    return Response.json({ error: "tier, chain, and token are required" }, { status: 400 });
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
    return Response.json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create quote";
    return Response.json({ error: message }, { status: 502 });
  }
}
