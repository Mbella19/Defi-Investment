import { fetchAllBalances } from "@/lib/wallet/balance-fetcher";
import { fetchTokenPrices } from "@/lib/coingecko";
import { calculatePortfolio } from "@/lib/wallet/portfolio-calculator";
import { requireWallet } from "@/lib/auth/guard";
import { requireCapability } from "@/lib/plans/access";
import { log } from "@/lib/log";

export async function POST(request: Request) {
  try {
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    const cap = requireCapability(auth.wallet, "toolPortfolioLens");
    if (!cap.ok) return cap.response;
    // Wallet-scoped data is always derived from the verified SIWE session.
    // A caller-supplied address would let an authenticated user query and
    // associate arbitrary wallets with their account activity.
    const normalizedAddress = auth.wallet as `0x${string}`;

    // Fetch balances first, then look up prices for ONLY the tokens this
    // wallet actually holds. Previously we paid for every supported token's
    // price upfront via getAllGeckoIds(), which burned CoinGecko quota and
    // padded latency for every wallet — usually <10 tokens deep.
    const { balances, errors } = await fetchAllBalances(normalizedAddress);
    const neededIds = Array.from(
      new Set(
        balances
          .map((b) => b.geckoId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );
    const prices = neededIds.length > 0 ? await fetchTokenPrices(neededIds) : new Map();

    const portfolio = calculatePortfolio(normalizedAddress, balances, prices, errors);

    return Response.json(portfolio);
  } catch (error) {
    log.error("portfolio", "balance fetch failed", { error });
    return Response.json({ error: "Failed to fetch portfolio" }, { status: 502 });
  }
}
