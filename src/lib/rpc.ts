/**
 * Centralized RPC URL resolution. Order of precedence per chain:
 *   1. Explicit per-chain env (RPC_URL_ETHEREUM / RPC_URL_ARBITRUM / …)
 *   2. ALCHEMY_API_KEY → constructed Alchemy URL for the chain
 *   3. INFURA_API_KEY → constructed Infura URL for the chain
 *   4. undefined → callers fall back to viem's default public RPC (rate-
 *      limited, fine for development, NOT for production)
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

export function getRpcUrl(chainId: number): string | undefined {
  const explicit = process.env[PER_CHAIN_ENV[chainId] ?? ""];
  if (explicit && explicit.trim()) return explicit.trim();

  const alch = process.env.ALCHEMY_API_KEY;
  const alchSub = ALCHEMY_SUBDOMAIN[chainId];
  if (alch && alchSub) return `https://${alchSub}.g.alchemy.com/v2/${alch}`;

  const inf = process.env.INFURA_API_KEY;
  const infSub = INFURA_SUBDOMAIN[chainId];
  if (inf && infSub) return `https://${infSub}.infura.io/v3/${inf}`;

  return undefined;
}
