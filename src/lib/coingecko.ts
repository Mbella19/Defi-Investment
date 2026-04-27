import type { CoinGeckoPrice, CoinGeckoTokenDetail, CoinGeckoPricePoint, TokenMarketData } from "@/types/coingecko";
import { fetchWithTimeout, warnUpstream } from "./fetch-utils";

const BASE = "https://api.coingecko.com/api/v3";

/**
 * Batch-fetch prices for multiple tokens (up to 250 IDs per call).
 */
export async function fetchTokenPrices(geckoIds: string[]): Promise<Map<string, CoinGeckoPrice>> {
  const map = new Map<string, CoinGeckoPrice>();
  if (geckoIds.length === 0) return map;

  try {
    const ids = geckoIds.slice(0, 250).map(encodeURIComponent).join(",");
    const res = await fetchWithTimeout(
      `${BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return map;

    const data = await res.json();
    for (const [id, values] of Object.entries(data)) {
      const v = values as Record<string, number>;
      map.set(id, {
        id,
        usd: v.usd ?? 0,
        usd_market_cap: v.usd_market_cap ?? 0,
        usd_24h_vol: v.usd_24h_vol ?? 0,
        usd_24h_change: v.usd_24h_change ?? 0,
      });
    }
  } catch (err) {
    warnUpstream("coingecko/simple-price", err);
  }
  return map;
}

/**
 * Fetch detailed token info including developer activity.
 */
export async function fetchTokenDetail(geckoId: string): Promise<CoinGeckoTokenDetail | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE}/coins/${encodeURIComponent(geckoId)}?localization=false&tickers=false&community_data=true&developer_data=true&sparkline=false`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    warnUpstream("coingecko/coin-detail", err);
    return null;
  }
}

/**
 * Fetch price history for charting.
 */
export async function fetchPriceHistory(geckoId: string, days: number = 30): Promise<CoinGeckoPricePoint[]> {
  try {
    const res = await fetchWithTimeout(
      `${BASE}/coins/${encodeURIComponent(geckoId)}/market_chart?vs_currency=usd&days=${days}`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.prices || []).map(([timestamp, price]: [number, number]) => ({
      timestamp,
      price,
    }));
  } catch (err) {
    warnUpstream("coingecko/market-chart", err);
    return [];
  }
}

/**
 * Convert CoinGecko detail to our simplified TokenMarketData.
 */
export function toTokenMarketData(detail: CoinGeckoTokenDetail): TokenMarketData {
  return {
    geckoId: detail.id,
    priceUsd: detail.market_data.current_price.usd,
    marketCap: detail.market_data.market_cap.usd,
    volume24h: detail.market_data.total_volume.usd,
    priceChange24h: detail.market_data.price_change_percentage_24h,
    priceChange7d: detail.market_data.price_change_percentage_7d,
    priceChange30d: detail.market_data.price_change_percentage_30d,
    developerActivity: detail.developer_data?.commit_count_4_weeks ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Format market data for AI prompts.
 */
export function formatMarketDataForPrompt(data: TokenMarketData): string {
  const mcap = data.marketCap > 1e9
    ? `$${(data.marketCap / 1e9).toFixed(2)}B`
    : data.marketCap > 1e6
    ? `$${(data.marketCap / 1e6).toFixed(1)}M`
    : `$${data.marketCap.toLocaleString()}`;

  const vol = data.volume24h > 1e6
    ? `$${(data.volume24h / 1e6).toFixed(1)}M`
    : `$${data.volume24h.toLocaleString()}`;

  const parts = [
    `Price: $${data.priceUsd.toFixed(4)}`,
    `MCap: ${mcap}`,
    `24h Vol: ${vol}`,
  ];

  if (data.priceChange24h !== null) parts.push(`24h: ${data.priceChange24h > 0 ? "+" : ""}${data.priceChange24h.toFixed(2)}%`);
  if (data.priceChange7d !== null) parts.push(`7d: ${data.priceChange7d > 0 ? "+" : ""}${data.priceChange7d.toFixed(2)}%`);
  if (data.priceChange30d !== null) parts.push(`30d: ${data.priceChange30d > 0 ? "+" : ""}${data.priceChange30d.toFixed(2)}%`);
  if (data.developerActivity !== null) parts.push(`Dev Activity: ${data.developerActivity} commits/4w`);

  return parts.join(" | ");
}
