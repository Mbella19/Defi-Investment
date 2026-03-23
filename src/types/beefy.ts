export interface BeefyVault {
  id: string;
  name: string;
  token: string;
  tokenAddress: string | null;
  tokenDecimals: number;
  earnedToken: string;
  earnContractAddress: string;
  chain: string;
  platformId: string;
  status: "active" | "eol" | "paused";
  assets: string[];
  risks: string[];
  strategyTypeId: string;
  buyTokenUrl: string | null;
  addLiquidityUrl: string | null;
  createdAt: number;
}

export interface BeefyVaultWithYield extends BeefyVault {
  apy: number | null;
  tvlUsd: number | null;
}
