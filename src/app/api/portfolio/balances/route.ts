import { fetchAllBalances } from "@/lib/wallet/balance-fetcher";
import { fetchTokenPrices } from "@/lib/coingecko";
import { calculatePortfolio } from "@/lib/wallet/portfolio-calculator";

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return Response.json({ error: "Invalid Ethereum address" }, { status: 400 });
    }

    const normalizedAddress = address as `0x${string}`;

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
    console.error("Portfolio fetch failed:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch portfolio";
    return Response.json({ error: message }, { status: 500 });
  }
}
