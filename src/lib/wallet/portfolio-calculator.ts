import { formatUnits } from "viem";
import type { CoinGeckoPrice } from "@/types/coingecko";
import type { WalletTokenBalance, PortfolioSummary, PortfolioToken, ChainAllocation } from "@/types/wallet";

export function calculatePortfolio(
  address: string,
  balances: WalletTokenBalance[],
  prices: Map<string, CoinGeckoPrice>,
  errors: string[] = []
): PortfolioSummary {
  const tokens: PortfolioToken[] = [];

  for (const bal of balances) {
    const humanBalance = parseFloat(formatUnits(BigInt(bal.balance), bal.decimals));
    if (humanBalance === 0) continue;

    const price = prices.get(bal.geckoId);
    const priceUsd = price?.usd ?? 0;
    const balanceUsd = humanBalance * priceUsd;

    tokens.push({
      chainId: bal.chainId,
      chainName: bal.chainName,
      symbol: bal.symbol,
      name: bal.name,
      balance: humanBalance,
      balanceUsd,
      priceUsd,
      priceChange24h: price?.usd_24h_change ?? null,
      allocation: 0, // calculated below
      isNative: bal.isNative,
    });
  }

  // Sort by USD value descending
  tokens.sort((a, b) => b.balanceUsd - a.balanceUsd);

  const totalValueUsd = tokens.reduce((sum, t) => sum + t.balanceUsd, 0);

  // Calculate allocation percentages
  for (const token of tokens) {
    token.allocation = totalValueUsd > 0 ? (token.balanceUsd / totalValueUsd) * 100 : 0;
  }

  // Chain breakdown
  const chainMap = new Map<number, { chainName: string; valueUsd: number }>();
  for (const token of tokens) {
    const existing = chainMap.get(token.chainId);
    if (existing) {
      existing.valueUsd += token.balanceUsd;
    } else {
      chainMap.set(token.chainId, { chainName: token.chainName, valueUsd: token.balanceUsd });
    }
  }

  const chainBreakdown: ChainAllocation[] = Array.from(chainMap.entries())
    .map(([chainId, { chainName, valueUsd }]) => ({
      chainId,
      chainName,
      valueUsd,
      percentage: totalValueUsd > 0 ? (valueUsd / totalValueUsd) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const chainCount = chainBreakdown.filter((c) => c.valueUsd > 0).length;

  return {
    address,
    totalValueUsd,
    tokenCount: tokens.length,
    chainCount,
    tokens,
    chainBreakdown,
    fetchedAt: new Date().toISOString(),
    errors,
  };
}
