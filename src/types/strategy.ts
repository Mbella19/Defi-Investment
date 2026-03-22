export interface StrategyCriteria {
  budget: number;
  riskAppetite: "low" | "medium" | "high";
  targetApyMin: number;
  targetApyMax: number;
}

export interface StrategyAllocation {
  protocol: string;
  chain: string;
  symbol: string;
  poolId: string;
  apy: number;
  tvl: number;
  stablecoin: boolean;
  allocationAmount: number;
  allocationPercent: number;
  reasoning: string;
  legitimacyScore: number;
  verdict: "high_confidence" | "moderate_confidence" | "low_confidence" | "caution";
  redFlags: string[];
}

export interface InvestmentStrategy {
  summary: string;
  projectedApy: number;
  projectedYearlyReturn: number;
  riskAssessment: string;
  allocations: StrategyAllocation[];
  diversificationNotes: string;
  warnings: string[];
  steps: string[];
  generatedAt: string;
}
