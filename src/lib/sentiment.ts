import type { DefiLlamaPool } from "@/types/pool";
import type { SentimentProfile, ApyTrend } from "@/types/sentiment";
import type { TokenMarketData } from "@/types/coingecko";

export function getProtocolSentiment(
  protocolName: string,
  pools: DefiLlamaPool[],
  marketData?: TokenMarketData | null,
): SentimentProfile {
  const avgApyPct7D = pools.length > 0
    ? pools.reduce((s, p) => s + (p.apyPct7D || 0), 0) / pools.length
    : 0;
  const avgApyPct1D = pools.length > 0
    ? pools.reduce((s, p) => s + (p.apyPct1D || 0), 0) / pools.length
    : 0;
  const avgApyPct30D = pools.length > 0
    ? pools.reduce((s, p) => s + (p.apyPct30D || 0), 0) / pools.length
    : 0;

  let apyTrend: ApyTrend = "stable";
  if (avgApyPct7D > 5) apyTrend = "rising";
  else if (avgApyPct7D < -5) apyTrend = "declining";

  const riskSignals: string[] = [];
  const positiveSignals: string[] = [];

  if (apyTrend === "declining") {
    riskSignals.push("APY trending downward over past 7 days");
  }
  if (apyTrend === "rising") {
    positiveSignals.push("APY trending upward over past 7 days");
  }

  if (marketData) {
    if (marketData.marketCap > 1_000_000_000) {
      positiveSignals.push(`Large market cap: $${(marketData.marketCap / 1e9).toFixed(1)}B`);
    } else if (marketData.marketCap > 100_000_000) {
      positiveSignals.push(`Mid-cap token: $${(marketData.marketCap / 1e6).toFixed(0)}M`);
    }
    if (marketData.priceChange30d !== null && marketData.priceChange30d < -30) {
      riskSignals.push(`Token price crashed ${marketData.priceChange30d.toFixed(1)}% in 30 days`);
    }
    if (marketData.developerActivity !== null && marketData.developerActivity > 50) {
      positiveSignals.push(`High developer activity: ${marketData.developerActivity} commits/4w`);
    } else if (marketData.developerActivity !== null && marketData.developerActivity < 5) {
      riskSignals.push(`Low developer activity: ${marketData.developerActivity} commits/4w`);
    }
  }

  return {
    protocol: protocolName,
    hackHistory: [],
    totalHackLoss: 0,
    fundingRounds: [],
    totalFundingRaised: 0,
    apyTrend,
    apyPct1D: avgApyPct1D,
    apyPct7D: avgApyPct7D,
    apyPct30D: avgApyPct30D,
    riskSignals,
    positiveSignals,
  };
}

export function formatSentimentForPrompt(sentiment: SentimentProfile): string {
  const lines: string[] = [];
  lines.push(`APY TREND: ${sentiment.apyTrend} (1d: ${sentiment.apyPct1D?.toFixed(1)}%, 7d: ${sentiment.apyPct7D?.toFixed(1)}%, 30d: ${sentiment.apyPct30D?.toFixed(1)}%)`);
  if (sentiment.riskSignals.length > 0) {
    lines.push(`RISK: ${sentiment.riskSignals.join("; ")}`);
  }
  if (sentiment.positiveSignals.length > 0) {
    lines.push(`POSITIVE: ${sentiment.positiveSignals.join("; ")}`);
  }
  return lines.join("\n");
}
