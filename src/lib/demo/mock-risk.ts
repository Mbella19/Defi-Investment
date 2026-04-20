import type { RiskAnalysisResult, PoolHistoryPoint } from "@/types/risk-models";

function generateHistory(days: number, baseApy: number, baseTvl: number): PoolHistoryPoint[] {
  const points: PoolHistoryPoint[] = [];
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const noise = (Math.sin(i * 0.7) + Math.cos(i * 0.3)) * 0.5;
    points.push({
      timestamp: new Date(now - i * 86_400_000).toISOString(),
      apy: Math.max(0.1, baseApy + noise * baseApy * 0.15),
      tvlUsd: Math.max(1_000_000, baseTvl + noise * baseTvl * 0.05),
    });
  }
  return points;
}

export const DEMO_RISK_RESULT: RiskAnalysisResult = {
  var: {
    value95: 1_240,
    value99: 2_180,
    portfolioValue: 10_000,
    timeHorizon: 30,
    method: "historical",
  },
  correlations: [
    { poolA: "pool-aave-eth-usdc", poolB: "pool-compound-arb-usdc", symbolA: "USDC (Aave)", symbolB: "USDC (Compound)", correlation: 0.92 },
    { poolA: "pool-aave-eth-usdc", poolB: "pool-lido-eth-steth", symbolA: "USDC (Aave)", symbolB: "stETH (Lido)", correlation: 0.15 },
    { poolA: "pool-lido-eth-steth", poolB: "pool-stargate-arb-eth", symbolA: "stETH (Lido)", symbolB: "ETH (Stargate)", correlation: 0.78 },
    { poolA: "pool-curve-3pool", poolB: "pool-aave-eth-usdc", symbolA: "3pool (Curve)", symbolB: "USDC (Aave)", correlation: 0.85 },
    { poolA: "pool-stargate-arb-eth", poolB: "pool-compound-arb-usdc", symbolA: "ETH (Stargate)", symbolB: "USDC (Compound)", correlation: 0.22 },
  ],
  stressTests: [
    {
      name: "2022 Terra/Luna Crash",
      description: "Stablecoin depeg cascade similar to UST collapse",
      marketDrop: 45,
      stablecoinDrop: 15,
      projectedLoss: 2_850,
      projectedLossPercent: 28.5,
      survivingValue: 7_150,
    },
    {
      name: "2023 Banking Crisis",
      description: "USDC depeg to $0.87 scenario with cascading DeFi liquidations",
      marketDrop: 25,
      stablecoinDrop: 13,
      projectedLoss: 1_920,
      projectedLossPercent: 19.2,
      survivingValue: 8_080,
    },
    {
      name: "Black Swan — 60% Crash",
      description: "Extreme market-wide selloff with liquidity crunch",
      marketDrop: 60,
      stablecoinDrop: 5,
      projectedLoss: 3_800,
      projectedLossPercent: 38.0,
      survivingValue: 6_200,
    },
    {
      name: "Mild Correction",
      description: "20% market dip with brief stablecoin volatility",
      marketDrop: 20,
      stablecoinDrop: 2,
      projectedLoss: 980,
      projectedLossPercent: 9.8,
      survivingValue: 9_020,
    },
  ],
  sharpe: {
    ratio: 1.42,
    meanReturn: 8.7,
    riskFreeRate: 4.5,
    volatility: 2.96,
    interpretation: "good",
  },
  drawdowns: [
    {
      poolId: "pool-aave-eth-usdc",
      symbol: "USDC (Aave)",
      drawdown: { maxDrawdown: 35.2, peakApy: 5.8, troughApy: 3.2, peakDate: "2025-11-15", troughDate: "2026-01-20" },
    },
    {
      poolId: "pool-stargate-arb-eth",
      symbol: "ETH (Stargate)",
      drawdown: { maxDrawdown: 58.1, peakApy: 12.4, troughApy: 5.2, peakDate: "2025-12-01", troughDate: "2026-02-15" },
    },
    {
      poolId: "pool-curve-3pool",
      symbol: "3pool (Curve)",
      drawdown: { maxDrawdown: 22.0, peakApy: 8.7, troughApy: 6.8, peakDate: "2025-10-10", troughDate: "2026-01-05" },
    },
  ],
  poolHistories: [
    { poolId: "pool-aave-eth-usdc", symbol: "USDC (Aave)", data: generateHistory(30, 4.2, 1_800_000_000) },
    { poolId: "pool-lido-eth-steth", symbol: "stETH (Lido)", data: generateHistory(30, 3.6, 14_200_000_000) },
    { poolId: "pool-curve-3pool", symbol: "3pool (Curve)", data: generateHistory(30, 6.8, 420_000_000) },
    { poolId: "pool-compound-arb-usdc", symbol: "USDC (Compound)", data: generateHistory(30, 5.1, 350_000_000) },
    { poolId: "pool-stargate-arb-eth", symbol: "ETH (Stargate)", data: generateHistory(30, 12.4, 180_000_000) },
  ],
};
