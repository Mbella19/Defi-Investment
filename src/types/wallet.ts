export type WalletSource = "connected" | "pasted";

export interface WalletTokenBalance {
  chainId: number;
  chainName: string;
  symbol: string;
  name: string;
  balance: string; // stringified bigint
  decimals: number;
  geckoId: string;
  isNative: boolean;
}

export interface PortfolioToken {
  chainId: number;
  chainName: string;
  symbol: string;
  name: string;
  balance: number;
  balanceUsd: number;
  priceUsd: number;
  priceChange24h: number | null;
  allocation: number;
  isNative: boolean;
}

export interface ChainAllocation {
  chainId: number;
  chainName: string;
  valueUsd: number;
  percentage: number;
}

export interface PortfolioSummary {
  address: string;
  totalValueUsd: number;
  tokenCount: number;
  chainCount: number;
  tokens: PortfolioToken[];
  chainBreakdown: ChainAllocation[];
  fetchedAt: string;
  errors: string[];
}
