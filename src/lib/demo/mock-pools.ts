import type { ScanResponse } from "@/types/scanner";
import type { DefiLlamaPool } from "@/types/pool";

function pool(overrides: Partial<DefiLlamaPool> & { pool: string; chain: string; project: string; symbol: string; tvlUsd: number; apy: number; stablecoin: boolean }): DefiLlamaPool {
  return {
    apyBase: null,
    apyReward: null,
    rewardTokens: null,
    underlyingTokens: null,
    poolMeta: null,
    url: "",
    exposure: null,
    ilRisk: null,
    apyPct1D: null,
    apyPct7D: null,
    apyPct30D: null,
    volumeUsd1d: null,
    volumeUsd7d: null,
    ...overrides,
  };
}

const demoPools: DefiLlamaPool[] = [
  pool({ pool: "pool-aave-eth-usdc", chain: "Ethereum", project: "aave-v3", symbol: "USDC", tvlUsd: 1_800_000_000, apy: 4.2, stablecoin: true, apyBase: 3.1, apyReward: 1.1 }),
  pool({ pool: "pool-aave-eth-dai", chain: "Ethereum", project: "aave-v3", symbol: "DAI", tvlUsd: 620_000_000, apy: 3.8, stablecoin: true, apyBase: 2.9, apyReward: 0.9 }),
  pool({ pool: "pool-compound-arb-usdc", chain: "Arbitrum", project: "compound-v3", symbol: "USDC", tvlUsd: 350_000_000, apy: 5.1, stablecoin: true, apyBase: 3.4, apyReward: 1.7 }),
  pool({ pool: "pool-lido-eth-steth", chain: "Ethereum", project: "lido", symbol: "stETH", tvlUsd: 14_200_000_000, apy: 3.6, stablecoin: false, apyBase: 3.6, apyReward: 0 }),
  pool({ pool: "pool-curve-3pool", chain: "Ethereum", project: "curve-dex", symbol: "3pool (DAI/USDC/USDT)", tvlUsd: 420_000_000, apy: 6.8, stablecoin: true, apyBase: 1.2, apyReward: 5.6 }),
  pool({ pool: "pool-stargate-arb-eth", chain: "Arbitrum", project: "stargate", symbol: "ETH", tvlUsd: 180_000_000, apy: 12.4, stablecoin: false, apyBase: 4.1, apyReward: 8.3 }),
  pool({ pool: "pool-gmx-arb-glp", chain: "Arbitrum", project: "gmx-v2", symbol: "GLP", tvlUsd: 520_000_000, apy: 18.2, stablecoin: false, apyBase: 10.5, apyReward: 7.7, ilRisk: "yes" }),
  pool({ pool: "pool-pendle-eth-ezeth", chain: "Ethereum", project: "pendle", symbol: "ezETH-PT", tvlUsd: 290_000_000, apy: 9.5, stablecoin: false, apyBase: 9.5, apyReward: 0 }),
  pool({ pool: "pool-convex-eth-frxeth", chain: "Ethereum", project: "convex-finance", symbol: "frxETH/ETH", tvlUsd: 160_000_000, apy: 7.3, stablecoin: false, apyBase: 2.8, apyReward: 4.5 }),
  pool({ pool: "pool-yearn-eth-usdc", chain: "Ethereum", project: "yearn-finance", symbol: "yvUSDC", tvlUsd: 110_000_000, apy: 5.5, stablecoin: true, apyBase: 5.5, apyReward: 0 }),
  pool({ pool: "pool-radiant-arb-usdt", chain: "Arbitrum", project: "radiant-v2", symbol: "USDT", tvlUsd: 85_000_000, apy: 8.9, stablecoin: true, apyBase: 3.2, apyReward: 5.7 }),
  pool({ pool: "pool-velodrome-op-ethusdc", chain: "Optimism", project: "velodrome-v2", symbol: "ETH/USDC", tvlUsd: 45_000_000, apy: 22.1, stablecoin: false, apyBase: 6.3, apyReward: 15.8, ilRisk: "yes" }),
  pool({ pool: "pool-balancer-arb-wsteth", chain: "Arbitrum", project: "balancer-v2", symbol: "wstETH/ETH", tvlUsd: 75_000_000, apy: 4.9, stablecoin: false, apyBase: 3.7, apyReward: 1.2 }),
  pool({ pool: "pool-morpho-eth-weth", chain: "Ethereum", project: "morpho-blue", symbol: "WETH", tvlUsd: 320_000_000, apy: 3.2, stablecoin: false, apyBase: 3.2, apyReward: 0 }),
  pool({ pool: "pool-spark-eth-dai", chain: "Ethereum", project: "spark", symbol: "sDAI", tvlUsd: 1_100_000_000, apy: 5.0, stablecoin: true, apyBase: 5.0, apyReward: 0 }),
];

function classify(apy: number, tvl: number, stablecoin: boolean): "low" | "medium" | "high" {
  if (stablecoin && tvl > 200_000_000 && apy < 8) return "low";
  if (apy > 15 || tvl < 50_000_000) return "high";
  return "medium";
}

export const DEMO_SCAN_RESPONSE: ScanResponse = {
  criteria: { budget: 10_000, riskAppetite: "medium", assetType: "all", chain: null },
  results: demoPools.map((p) => ({
    pool: p,
    riskClassification: classify(p.apy ?? 0, p.tvlUsd, p.stablecoin),
    suggestedAllocation: Math.round((10_000 / demoPools.length) * 100) / 100,
    matchScore: Math.round(70 + Math.random() * 25),
  })),
  totalMatchingPools: demoPools.length,
  scannedAt: new Date().toISOString(),
};
