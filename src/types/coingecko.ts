export interface CoinGeckoPrice {
  id: string;
  usd: number;
  usd_market_cap: number;
  usd_24h_vol: number;
  usd_24h_change: number;
}

export interface CoinGeckoTokenDetail {
  id: string;
  symbol: string;
  name: string;
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    total_volume: { usd: number };
    price_change_percentage_24h: number | null;
    price_change_percentage_7d: number | null;
    price_change_percentage_30d: number | null;
    ath: { usd: number };
    ath_change_percentage: { usd: number };
  };
  categories: string[];
  developer_data: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    commit_count_4_weeks: number;
  } | null;
  community_data: {
    twitter_followers: number | null;
  } | null;
  links: {
    homepage: string[];
    repos_url: { github: string[] };
  };
}

export interface CoinGeckoPricePoint {
  timestamp: number;
  price: number;
}

export interface TokenMarketData {
  geckoId: string;
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number | null;
  priceChange7d: number | null;
  priceChange30d: number | null;
  developerActivity: number | null;
  fetchedAt: string;
}
