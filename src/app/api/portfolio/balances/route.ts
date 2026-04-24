import { fetchAllBalances } from "@/lib/wallet/balance-fetcher";
import { fetchTokenPrices } from "@/lib/coingecko";
import { calculatePortfolio } from "@/lib/wallet/portfolio-calculator";
import { getAllGeckoIds } from "@/lib/wallet/token-lists";

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return Response.json({ error: "Invalid Ethereum address" }, { status: 400 });
    }

    const normalizedAddress = address as `0x${string}`;

    const [{ balances, errors }, prices] = await Promise.all([
      fetchAllBalances(normalizedAddress),
      fetchTokenPrices(getAllGeckoIds()),
    ]);

    const portfolio = calculatePortfolio(normalizedAddress, balances, prices, errors);

    return Response.json(portfolio);
  } catch (error) {
    console.error("Portfolio fetch failed:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch portfolio";
    return Response.json({ error: message }, { status: 500 });
  }
}
