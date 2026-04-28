/**
 * Centralized RPC URL resolution. Order of precedence per chain:
 *   1. Explicit per-chain env (RPC_URL_ETHEREUM / RPC_URL_ARBITRUM / …)
 *   2. ALCHEMY_API_KEY → constructed Alchemy URL for the chain
 *   3. INFURA_API_KEY → constructed Infura URL for the chain
 *   4. Curated public RPC (LlamaRPC) — better free-tier limits than viem's
 *      built-in default (which routes to eth.merkle.io and gets Cloudflare-
 *      rate-limited at single-digit requests/min for the mainnet path).
 *      Fine for local dev; set ALCHEMY/INFURA for production traffic.
 *
 * Server-only — viem's `http()` accepts undefined and falls back transparently.
 */

const PER_CHAIN_ENV: Record<number, string> = {
  1: "RPC_URL_ETHEREUM",
  10: "RPC_URL_OPTIMISM",
  56: "RPC_URL_BSC",
  137: "RPC_URL_POLYGON",
  250: "RPC_URL_FANTOM",
  8453: "RPC_URL_BASE",
  42161: "RPC_URL_ARBITRUM",
  43114: "RPC_URL_AVALANCHE",
};

const ALCHEMY_SUBDOMAIN: Record<number, string> = {
  1: "eth-mainnet",
  10: "opt-mainnet",
  137: "polygon-mainnet",
  8453: "base-mainnet",
  42161: "arb-mainnet",
};

const INFURA_SUBDOMAIN: Record<number, string> = {
  1: "mainnet",
  10: "optimism-mainnet",
  137: "polygon-mainnet",
  42161: "arbitrum-mainnet",
};

// Curated free public RPCs. Mostly project-run endpoints (mainnet.optimism.io,
// arb1.arbitrum.io, api.avax.network) which have better rate limits than the
// merkle/cloudflare defaults viem ships with. These are public endpoints, not
// secrets — verified live with eth_blockNumber 2026-04-27.
const PUBLIC_RPC_FALLBACK: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  10: "https://mainnet.optimism.io",
  56: "https://bsc-dataseed1.binance.org",
  137: "https://polygon.publicnode.com",
  250: "https://rpc.ftm.tools",
  8453: "https://base.llamarpc.com",
  42161: "https://arb1.arbitrum.io/rpc",
  43114: "https://api.avax.network/ext/bc/C/rpc",
};

export function getRpcUrl(chainId: number): string | undefined {
  const explicit = process.env[PER_CHAIN_ENV[chainId] ?? ""];
  if (explicit && explicit.trim()) return explicit.trim();

  const alch = process.env.ALCHEMY_API_KEY;
  const alchSub = ALCHEMY_SUBDOMAIN[chainId];
  if (alch && alchSub) return `https://${alchSub}.g.alchemy.com/v2/${alch}`;

  const inf = process.env.INFURA_API_KEY;
  const infSub = INFURA_SUBDOMAIN[chainId];
  if (inf && infSub) return `https://${infSub}.infura.io/v3/${inf}`;

  return PUBLIC_RPC_FALLBACK[chainId];
}
