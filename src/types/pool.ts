export interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  rewardTokens: string[] | null;
  underlyingTokens: string[] | null;
  poolMeta: string | null;
  url: string;
  exposure: string | null;
  stablecoin: boolean;
  ilRisk: string | null;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
}

export interface DefiLlamaChain {
  gecko_id: string | null;
  tvl: number;
  tokenSymbol: string | null;
  cmcId: string | null;
  name: string;
  chainId: number | null;
}

export interface DefiLlamaProtocol {
  id: string;
  name: string;
  address: string | null;
  symbol: string;
  url: string;
  description: string;
  chain: string;
  logo: string;
  audits: string;
  audit_links?: string[];
  category: string;
  chains: string[];
  twitter: string;
  tvl: number;
  change_1h: number | null;
  change_1d: number | null;
  change_7d: number | null;
  listedAt: number;
  slug: string;
  mcap: number | null;
}

export interface ChainOption {
  name: string;
  tvl: number;
  tokenSymbol: string | null;
}
