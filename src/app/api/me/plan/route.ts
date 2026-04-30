import { requireWallet } from "@/lib/auth/guard";
import { getPlan, TIER_PRICE_USD } from "@/lib/plans/access";
import { strategyGenerationsThisMonth } from "@/lib/plans/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireWallet(request);
  if ("response" in auth) {
    // Unauthed callers get the free baseline so the client can render gates
    // without forcing a sign-in just to know what's locked.
    if (auth.response.status === 401) {
      return Response.json({
        tier: "free",
        capabilities: getPlan(null).capabilities,
        isOwner: false,
        wallet: null,
        expiresAt: null,
        prices: TIER_PRICE_USD,
        usage: { strategiesThisMonth: 0 },
      });
    }
    return auth.response;
  }
  const plan = getPlan(auth.wallet);
  const used = strategyGenerationsThisMonth(auth.wallet);
  return Response.json({
    tier: plan.tier,
    capabilities: plan.capabilities,
    isOwner: plan.isOwner,
    wallet: auth.wallet,
    expiresAt: plan.expiresAt,
    prices: TIER_PRICE_USD,
    usage: { strategiesThisMonth: used },
  });
}
