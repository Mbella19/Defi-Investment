import type { AlertEvent, PortfolioPosition } from "@/types/portfolio";

// --- Monitor scan response ---
export function buildDemoMonitorResponse(positions: PortfolioPosition[]) {
  const alerts: AlertEvent[] = [
    {
      id: "demo-alert-1",
      type: "apy_drop",
      severity: "warning",
      positionId: positions[0]?.id || "demo-pos-0",
      protocol: positions[0]?.protocol || "Aave V3",
      symbol: positions[0]?.symbol || "USDC",
      chain: positions[0]?.chain || "Ethereum",
      message: "APY dropped 24% from entry",
      detail: "Current APY 3.2% vs entry 4.2%. Utilization rate declined as borrowing demand cooled.",
      timestamp: new Date().toISOString(),
      currentValue: 3.2,
      entryValue: 4.2,
      changePercent: -23.8,
    },
    {
      id: "demo-alert-2",
      type: "apy_drop",
      severity: "critical",
      positionId: positions[4]?.id || "demo-pos-4",
      protocol: positions[4]?.protocol || "Stargate Finance",
      symbol: positions[4]?.symbol || "ETH",
      chain: positions[4]?.chain || "Arbitrum",
      message: "APY dropped 58% from entry",
      detail: "Current APY 5.2% vs entry 12.4%. STG reward emissions cut after governance vote.",
      timestamp: new Date().toISOString(),
      currentValue: 5.2,
      entryValue: 12.4,
      changePercent: -58.1,
    },
    {
      id: "demo-alert-3",
      type: "tvl_drain",
      severity: "info",
      positionId: positions[2]?.id || "demo-pos-2",
      protocol: positions[2]?.protocol || "Curve Finance",
      symbol: positions[2]?.symbol || "3pool",
      chain: positions[2]?.chain || "Ethereum",
      message: "TVL decreased 15% in 7 days",
      detail: "Pool TVL dropped from $420M to $357M. Capital rotating to newer stablecoin pools.",
      timestamp: new Date().toISOString(),
      currentValue: 357_000_000,
      entryValue: 420_000_000,
      changePercent: -15.0,
    },
  ];

  const enriched = positions.map((pos, i) => {
    const apyDrift = [0.76, 0, -0.3, 0.9, -7.2][i % 5] ?? 0;
    const tvlDrift = [-2, 1, -15, 5, -8][i % 5] ?? 0;
    const currentApy = Math.max(0, pos.entryApy + apyDrift);
    const currentTvl = pos.entryTvl * (1 + tvlDrift / 100);
    return {
      ...pos,
      currentApy: Math.round(currentApy * 10) / 10,
      currentTvl: Math.round(currentTvl),
      apyChange: pos.entryApy > 0 ? Math.round((apyDrift / pos.entryApy) * 1000) / 10 : null,
      tvlChange: Math.round(tvlDrift * 10) / 10,
    };
  });

  return { alerts, positions: enriched };
}

// --- Rebalance suggestions ---
export interface RebalanceSuggestion {
  positionId: string;
  currentProtocol: string;
  currentSymbol: string;
  currentChain: string;
  currentApy: number;
  suggestedPoolId: string;
  suggestedProtocol: string;
  suggestedSymbol: string;
  suggestedChain: string;
  suggestedApy: number;
  suggestedTvl: number;
  suggestedStablecoin: boolean;
  apyImprovement: number;
  investedAmount: number;
  yearlyGain: number;
  reason: string;
}

export function buildDemoRebalanceSuggestions(positions: PortfolioPosition[]): RebalanceSuggestion[] {
  if (positions.length === 0) return [];
  const p = positions[0];
  return [
    {
      positionId: p?.id || "demo-pos-0",
      currentProtocol: p?.protocol || "Aave V3",
      currentSymbol: p?.symbol || "USDC",
      currentChain: p?.chain || "Ethereum",
      currentApy: 3.2,
      suggestedPoolId: "pool-spark-eth-dai",
      suggestedProtocol: "Spark",
      suggestedSymbol: "sDAI",
      suggestedChain: "Ethereum",
      suggestedApy: 5.0,
      suggestedTvl: 1_100_000_000,
      suggestedStablecoin: true,
      apyImprovement: 1.8,
      investedAmount: p?.investedAmount || 2500,
      yearlyGain: (p?.investedAmount || 2500) * 0.018,
      reason: "Spark sDAI offers 56% higher yield with comparable risk profile. $1.1B TVL and MakerDAO backing.",
    },
    {
      positionId: positions[4]?.id || "demo-pos-4",
      currentProtocol: positions[4]?.protocol || "Stargate Finance",
      currentSymbol: positions[4]?.symbol || "ETH",
      currentChain: positions[4]?.chain || "Arbitrum",
      currentApy: 5.2,
      suggestedPoolId: "pool-pendle-eth-ezeth",
      suggestedProtocol: "Pendle",
      suggestedSymbol: "ezETH-PT",
      suggestedChain: "Ethereum",
      suggestedApy: 9.5,
      suggestedTvl: 290_000_000,
      suggestedStablecoin: false,
      apyImprovement: 4.3,
      investedAmount: positions[4]?.investedAmount || 2000,
      yearlyGain: (positions[4]?.investedAmount || 2000) * 0.043,
      reason: "Stargate rewards collapsed. Pendle ezETH-PT locks in fixed 9.5% with no bridge risk.",
    },
  ];
}

// --- Strategy monitor scan (for /api/strategies/monitor) ---
export function buildDemoStrategyScanResponse(scanned: number) {
  return {
    scanned,
    newAlerts: [
      {
        id: "demo-strat-alert-1",
        strategyId: "demo",
        type: "apy_drop",
        severity: "warning",
        poolId: "pool-aave-eth-usdc",
        protocol: "Aave V3",
        symbol: "USDC",
        chain: "Ethereum",
        message: "APY dropped 24% from entry",
        detail: "Current 3.2% vs entry 4.2%",
        createdAt: new Date().toISOString(),
      },
      {
        id: "demo-strat-alert-2",
        strategyId: "demo",
        type: "apy_drop",
        severity: "critical",
        poolId: "pool-stargate-arb-eth",
        protocol: "Stargate Finance",
        symbol: "ETH",
        chain: "Arbitrum",
        message: "APY dropped 58% from entry",
        detail: "Current 5.2% vs entry 12.4% — STG rewards cut",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
