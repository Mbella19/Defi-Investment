import type { ChainId } from "@/components/sovereign";

export type DemoPool = {
  pool: string;
  protocol: string;
  chain: ChainId;
  tvl: number; // $M
  apy: number;
  safe: number;
  risk: "Low" | "Med" | "High";
  type: "Lending" | "LST" | "LP" | "Yield" | "Synth";
};

export function walk(seed: number, n = 40, start = 50, vol = 4): number[] {
  let x = seed * 9301 + 49297;
  const out: number[] = [start];
  for (let i = 1; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280 - 0.5;
    out.push(Math.max(1, out[i - 1] + r * vol + (seed % 3 === 0 ? 0.08 : -0.03)));
  }
  return out;
}

export const POOLS: DemoPool[] = [
  { pool: "USDC",         protocol: "Aave v3",   chain: "eth",  tvl: 1420, apy: 5.14, safe: 94, risk: "Low",  type: "Lending" },
  { pool: "sDAI",         protocol: "Spark",     chain: "eth",  tvl:  812, apy: 8.75, safe: 90, risk: "Low",  type: "Lending" },
  { pool: "stETH",        protocol: "Lido",      chain: "eth",  tvl: 18400, apy: 3.22, safe: 96, risk: "Low",  type: "LST"     },
  { pool: "USDC",         protocol: "Morpho",    chain: "base", tvl:  340, apy: 6.41, safe: 88, risk: "Low",  type: "Lending" },
  { pool: "ETH PT-27MAR", protocol: "Pendle",    chain: "arb",  tvl:  180, apy: 12.04, safe: 82, risk: "Med",  type: "Yield"   },
  { pool: "GHO",          protocol: "Aave v3",   chain: "arb",  tvl:  120, apy: 7.20, safe: 86, risk: "Low",  type: "Lending" },
  { pool: "wstETH/WETH",  protocol: "Balancer",  chain: "op",   tvl:   94, apy: 4.90, safe: 84, risk: "Low",  type: "LP"      },
  { pool: "USDe",         protocol: "Ethena",    chain: "eth",  tvl: 3100, apy: 14.60, safe: 72, risk: "High", type: "Synth"   },
  { pool: "cbBTC",        protocol: "Aave v3",   chain: "base", tvl:  460, apy: 2.10, safe: 92, risk: "Low",  type: "Lending" },
  { pool: "rETH/WETH",    protocol: "Curve",     chain: "eth",  tvl:   72, apy: 3.80, safe: 89, risk: "Low",  type: "LP"      },
];

export function fmtTVL(m: number): string {
  return m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${m.toFixed(0)}M`;
}

export type DemoPosition = {
  p: string;
  pr: string;
  ch: ChainId;
  alloc: number;
  val: string;
  apy: number;
  pnl: string;
};

export const POSITIONS: DemoPosition[] = [
  { p: "sDAI",  pr: "Spark",   ch: "eth",  alloc: 38, val: "$48,820", apy: 8.75, pnl: "+$312" },
  { p: "stETH", pr: "Lido",    ch: "eth",  alloc: 28, val: "$35,954", apy: 3.22, pnl: "+$94"  },
  { p: "USDC",  pr: "Morpho",  ch: "base", alloc: 22, val: "$28,250", apy: 6.41, pnl: "+$151" },
  { p: "GHO",   pr: "Aave v3", ch: "arb",  alloc: 12, val: "$15,388", apy: 7.20, pnl: "+$89"  },
];
