import type { DefiLlamaPool } from "./pool";

export type RiskAppetite = "low" | "medium" | "high";
export type AssetType = "stablecoins" | "all";

export interface ScannerCriteria {
  budget: number;
  riskAppetite: RiskAppetite;
  assetType: AssetType;
  chain: string | null;
}

export interface ScanResult {
  pool: DefiLlamaPool;
  riskClassification: RiskAppetite;
  suggestedAllocation: number;
  matchScore: number;
}

export interface ScanResponse {
  criteria: ScannerCriteria;
  results: ScanResult[];
  totalMatchingPools: number;
  scannedAt: string;
}
