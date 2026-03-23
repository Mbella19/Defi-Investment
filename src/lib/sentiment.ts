import type { DefiLlamaPool } from "@/types/pool";
import type { HackEntry, RaiseEntry } from "@/lib/defillama";
import type { SentimentProfile, HackEvent, FundingRound, ApyTrend } from "@/types/sentiment";
import type { TokenMarketData } from "@/types/coingecko";

export function getProtocolSentiment(
  protocolName: string,
  protocolSlug: string,
  hacks: HackEntry[],
  raises: RaiseEntry[],
  pools: DefiLlamaPool[],
  marketData?: TokenMarketData | null,
): SentimentProfile {
  const nameLower = protocolName.toLowerCase();
  const slugLower = protocolSlug.toLowerCase();

  // Find hacks matching this protocol
  const hackHistory: HackEvent[] = hacks
    .filter((h) => {
      const target = (h.target || h.name || "").toLowerCase();
      return target.includes(nameLower) || target.includes(slugLower);
    })
    .map((h) => ({
      id: h.id || String(h.date),
      name: h.name,
      date: new Date(h.date * 1000).toISOString(),
      target: h.target,
      classification: h.classification || "Unknown",
      technique: h.technique || "Unknown",
      amount: h.amount || 0,
      chain: h.chain || [],
      bridgeHack: h.bridgeHack || false,
      returnedFunds: h.returnedFunds,
    }));

  const totalHackLoss = hackHistory.reduce((sum, h) => sum + h.amount, 0);

  // Find funding rounds
  const fundingRounds: FundingRound[] = raises
    .filter((r) => {
      const name = (r.name || "").toLowerCase();
      return name.includes(nameLower) || name.includes(slugLower);
    })
    .map((r) => ({
      name: r.name,
      date: new Date(r.date * 1000).toISOString(),
      amount: r.amount,
      round: r.round,
      category: r.category || "",
      leadInvestors: r.leadInvestors || [],
      otherInvestors: r.otherInvestors || [],
      chains: r.chains || [],
    }));

  const totalFundingRaised = fundingRounds.reduce((sum, r) => sum + (r.amount || 0), 0);

  // APY trend from pools
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

  // Risk signals
  const riskSignals: string[] = [];
  const positiveSignals: string[] = [];

  if (hackHistory.length > 0) {
    riskSignals.push(`Exploited ${hackHistory.length} time(s), total loss: $${(totalHackLoss / 1e6).toFixed(1)}M`);
  }
  if (apyTrend === "declining") {
    riskSignals.push("APY trending downward over past 7 days");
  }
  if (fundingRounds.length === 0) {
    riskSignals.push("No known funding rounds on record");
  }

  if (hackHistory.length === 0) {
    positiveSignals.push("No recorded security exploits");
  }
  if (totalFundingRaised > 10_000_000) {
    positiveSignals.push(`Well-funded: $${(totalFundingRaised / 1e6).toFixed(1)}M raised`);
  }
  if (fundingRounds.some((r) => r.leadInvestors.length > 0)) {
    const topInvestors = fundingRounds.flatMap((r) => r.leadInvestors).slice(0, 3);
    positiveSignals.push(`Backed by: ${topInvestors.join(", ")}`);
  }
  if (apyTrend === "rising") {
    positiveSignals.push("APY trending upward over past 7 days");
  }

  // CoinGecko market data signals
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
    hackHistory,
    totalHackLoss,
    fundingRounds,
    totalFundingRaised,
    apyTrend,
    apyPct1D: avgApyPct1D,
    apyPct7D: avgApyPct7D,
    apyPct30D: avgApyPct30D,
    riskSignals,
    positiveSignals,
  };
}

/**
 * Format sentiment data as text for AI prompts.
 */
export function formatSentimentForPrompt(sentiment: SentimentProfile): string {
  const lines: string[] = [];

  if (sentiment.hackHistory.length > 0) {
    lines.push(`EXPLOIT HISTORY (${sentiment.hackHistory.length} incidents, $${(sentiment.totalHackLoss / 1e6).toFixed(1)}M total):`);
    for (const h of sentiment.hackHistory.slice(0, 3)) {
      lines.push(`  - ${new Date(h.date).toLocaleDateString()}: $${(h.amount / 1e6).toFixed(1)}M lost via ${h.technique}`);
    }
  } else {
    lines.push("EXPLOIT HISTORY: No recorded security incidents");
  }

  if (sentiment.fundingRounds.length > 0) {
    lines.push(`FUNDING: $${(sentiment.totalFundingRaised / 1e6).toFixed(1)}M raised across ${sentiment.fundingRounds.length} round(s)`);
    for (const r of sentiment.fundingRounds.slice(0, 2)) {
      const investors = r.leadInvestors.slice(0, 3).join(", ") || "undisclosed";
      lines.push(`  - ${r.round || "Unknown round"}: $${((r.amount || 0) / 1e6).toFixed(1)}M from ${investors}`);
    }
  } else {
    lines.push("FUNDING: No known funding rounds");
  }

  lines.push(`APY TREND: ${sentiment.apyTrend} (1d: ${sentiment.apyPct1D?.toFixed(1)}%, 7d: ${sentiment.apyPct7D?.toFixed(1)}%, 30d: ${sentiment.apyPct30D?.toFixed(1)}%)`);

  return lines.join("\n");
}
