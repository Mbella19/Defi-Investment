export interface VaRResult {
  value95: number;
  value99: number;
  portfolioValue: number;
  timeHorizon: number;
  method: "historical";
}

export interface CorrelationEntry {
  poolA: string;
  poolB: string;
  symbolA: string;
  symbolB: string;
  correlation: number;
}

export interface StressTestScenario {
  name: string;
  description: string;
  marketDrop: number;
  stablecoinDrop: number;
  projectedLoss: number;
  projectedLossPercent: number;
  survivingValue: number;
}

export interface SharpeRatioResult {
  ratio: number;
  meanReturn: number;
  riskFreeRate: number;
  volatility: number;
  interpretation: "excellent" | "good" | "adequate" | "poor";
}

export interface MaxDrawdownResult {
  maxDrawdown: number;
  peakApy: number;
  troughApy: number;
  peakDate: string;
  troughDate: string;
}

export interface PoolHistoryPoint {
  timestamp: string;
  apy: number;
  tvlUsd: number;
}

export interface RiskAnalysisResult {
  var: VaRResult;
  correlations: CorrelationEntry[];
  stressTests: StressTestScenario[];
  sharpe: SharpeRatioResult;
  drawdowns: { poolId: string; symbol: string; drawdown: MaxDrawdownResult }[];
  poolHistories: { poolId: string; symbol: string; data: PoolHistoryPoint[] }[];
}

export interface ILCalculation {
  priceChangePercent: number;
  impermanentLossPercent: number;
  dollarLoss: number;
  holdValue: number;
  lpValue: number;
}
