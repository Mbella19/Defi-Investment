import type {
  VaRResult, CorrelationEntry, StressTestScenario,
  SharpeRatioResult, MaxDrawdownResult, PoolHistoryPoint, RiskAnalysisResult,
} from "@/types/risk-models";

/**
 * Calculate daily return series from APY history.
 */
function dailyReturns(history: PoolHistoryPoint[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].apy;
    const curr = history[i].apy;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Historical Value at Risk.
 * Uses APY volatility as a proxy for portfolio return volatility.
 */
export function calculateVaR(
  allocations: { poolId: string; allocationAmount: number; allocationPercent: number }[],
  poolHistories: Map<string, PoolHistoryPoint[]>,
  portfolioValue: number,
  timeHorizon: number = 30
): VaRResult {
  // Build weighted portfolio daily returns
  const maxLen = Math.max(...Array.from(poolHistories.values()).map((h) => h.length));
  const portfolioReturns: number[] = [];

  for (let day = 1; day < maxLen; day++) {
    let weightedReturn = 0;
    let totalWeight = 0;

    for (const alloc of allocations) {
      const history = poolHistories.get(alloc.poolId);
      if (!history || day >= history.length) continue;

      const prev = history[day - 1].apy;
      const curr = history[day].apy;
      if (prev > 0) {
        const dailyReturn = (curr - prev) / prev;
        weightedReturn += dailyReturn * (alloc.allocationPercent / 100);
        totalWeight += alloc.allocationPercent / 100;
      }
    }

    if (totalWeight > 0) {
      portfolioReturns.push(weightedReturn / totalWeight * totalWeight);
    }
  }

  const sigma = stdDev(portfolioReturns);
  const z95 = 1.645;
  const z99 = 2.326;
  const sqrtT = Math.sqrt(timeHorizon);

  return {
    value95: Math.round(portfolioValue * z95 * sigma * sqrtT * 100) / 100,
    value99: Math.round(portfolioValue * z99 * sigma * sqrtT * 100) / 100,
    portfolioValue,
    timeHorizon,
    method: "historical",
  };
}

/**
 * Pearson correlation between two APY time series.
 */
function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;

  const sliceA = a.slice(0, n);
  const sliceB = b.slice(0, n);
  const meanA = mean(sliceA);
  const meanB = mean(sliceB);

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = sliceA[i] - meanA;
    const db = sliceB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : Math.round(num / den * 1000) / 1000;
}

/**
 * Build correlation matrix from pool APY histories.
 */
export function calculateCorrelationMatrix(
  pools: { poolId: string; symbol: string }[],
  poolHistories: Map<string, PoolHistoryPoint[]>
): CorrelationEntry[] {
  const entries: CorrelationEntry[] = [];

  for (let i = 0; i < pools.length; i++) {
    for (let j = i + 1; j < pools.length; j++) {
      const histA = poolHistories.get(pools[i].poolId);
      const histB = poolHistories.get(pools[j].poolId);
      if (!histA || !histB) continue;

      const returnsA = dailyReturns(histA);
      const returnsB = dailyReturns(histB);
      const corr = pearsonCorrelation(returnsA, returnsB);

      entries.push({
        poolA: pools[i].poolId,
        poolB: pools[j].poolId,
        symbolA: pools[i].symbol,
        symbolB: pools[j].symbol,
        correlation: corr,
      });
    }
  }

  return entries;
}

/**
 * Run predefined stress test scenarios.
 */
export function runStressTests(
  allocations: { protocol: string; allocationAmount: number; stablecoin: boolean; chain: string }[],
  portfolioValue: number
): StressTestScenario[] {
  const scenarios: { name: string; description: string; marketDrop: number; stablecoinDrop: number }[] = [
    {
      name: "2022 Terra Crash",
      description: "Algorithmic stablecoin collapse, -60% TVL across DeFi",
      marketDrop: 60,
      stablecoinDrop: 15,
    },
    {
      name: "2023 SVB Banking Crisis",
      description: "Traditional finance contagion, -30% DeFi TVL",
      marketDrop: 30,
      stablecoinDrop: 5,
    },
    {
      name: "Flash Crash (-40%)",
      description: "Sudden market-wide crash, non-stablecoins hit hardest",
      marketDrop: 40,
      stablecoinDrop: 3,
    },
    {
      name: "Smart Contract Exploit",
      description: "Major protocol hack, -20% sector-wide confidence drop",
      marketDrop: 20,
      stablecoinDrop: 2,
    },
    {
      name: "Regulatory Crackdown",
      description: "Government bans DeFi access, -50% TVL exodus",
      marketDrop: 50,
      stablecoinDrop: 10,
    },
  ];

  return scenarios.map((scenario) => {
    let projectedLoss = 0;

    for (const alloc of allocations) {
      const drop = alloc.stablecoin ? scenario.stablecoinDrop : scenario.marketDrop;
      projectedLoss += alloc.allocationAmount * (drop / 100);
    }

    return {
      ...scenario,
      projectedLoss: Math.round(projectedLoss * 100) / 100,
      projectedLossPercent: Math.round((projectedLoss / portfolioValue) * 10000) / 100,
      survivingValue: Math.round((portfolioValue - projectedLoss) * 100) / 100,
    };
  });
}

/**
 * Calculate Sharpe Ratio for a pool.
 */
export function calculateSharpeRatio(
  history: PoolHistoryPoint[],
  riskFreeRate: number = 5
): SharpeRatioResult {
  const apys = history.map((h) => h.apy);
  const meanApy = mean(apys);
  const vol = stdDev(apys);

  const ratio = vol === 0 ? 0 : (meanApy - riskFreeRate) / vol;
  const roundedRatio = Math.round(ratio * 100) / 100;

  let interpretation: SharpeRatioResult["interpretation"];
  if (roundedRatio >= 2) interpretation = "excellent";
  else if (roundedRatio >= 1) interpretation = "good";
  else if (roundedRatio >= 0.5) interpretation = "adequate";
  else interpretation = "poor";

  return {
    ratio: roundedRatio,
    meanReturn: Math.round(meanApy * 100) / 100,
    riskFreeRate,
    volatility: Math.round(vol * 100) / 100,
    interpretation,
  };
}

/**
 * Calculate maximum drawdown from APY history.
 */
export function calculateMaxDrawdown(history: PoolHistoryPoint[]): MaxDrawdownResult {
  if (history.length < 2) {
    return { maxDrawdown: 0, peakApy: 0, troughApy: 0, peakDate: "", troughDate: "" };
  }

  let maxDD = 0;
  let peak = history[0].apy;
  let peakDate = history[0].timestamp;
  let resultPeakDate = peakDate;
  let resultTroughDate = history[0].timestamp;
  let resultPeakApy = peak;
  let resultTroughApy = peak;

  for (const point of history) {
    if (point.apy > peak) {
      peak = point.apy;
      peakDate = point.timestamp;
    }
    const dd = peak > 0 ? (peak - point.apy) / peak : 0;
    if (dd > maxDD) {
      maxDD = dd;
      resultPeakDate = peakDate;
      resultTroughDate = point.timestamp;
      resultPeakApy = peak;
      resultTroughApy = point.apy;
    }
  }

  return {
    maxDrawdown: Math.round(maxDD * 10000) / 100,
    peakApy: Math.round(resultPeakApy * 100) / 100,
    troughApy: Math.round(resultTroughApy * 100) / 100,
    peakDate: resultPeakDate,
    troughDate: resultTroughDate,
  };
}

/**
 * Run complete risk analysis on a portfolio.
 */
export function runFullRiskAnalysis(
  allocations: {
    poolId: string; symbol: string; protocol: string;
    allocationAmount: number; allocationPercent: number;
    stablecoin: boolean; chain: string;
  }[],
  poolHistories: Map<string, PoolHistoryPoint[]>,
  portfolioValue: number
): RiskAnalysisResult {
  const pools = allocations.map((a) => ({ poolId: a.poolId, symbol: a.symbol }));

  // Weighted portfolio history for Sharpe
  const allHistories = Array.from(poolHistories.entries());
  const longestHistory = allHistories.reduce((best, [, h]) => h.length > best.length ? h : best, [] as PoolHistoryPoint[]);

  return {
    var: calculateVaR(allocations, poolHistories, portfolioValue),
    correlations: calculateCorrelationMatrix(pools, poolHistories),
    stressTests: runStressTests(allocations, portfolioValue),
    sharpe: calculateSharpeRatio(longestHistory),
    drawdowns: allocations.map((a) => {
      const history = poolHistories.get(a.poolId) || [];
      return { poolId: a.poolId, symbol: a.symbol, drawdown: calculateMaxDrawdown(history) };
    }),
    poolHistories: allocations.map((a) => ({
      poolId: a.poolId,
      symbol: a.symbol,
      data: poolHistories.get(a.poolId) || [],
    })),
  };
}
