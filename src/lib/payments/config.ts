/**
 * Payment configuration — supported chain/token pairs, deposit addresses,
 * decimals, and metadata for the checkout flow.
 *
 * Deposit addresses are baked in here as defaults but can be overridden
 * per-deployment via PAYMENT_ADDRESS_{EVM,BTC,SOL,TRON} env vars.
 */

export type PaymentChain = "ethereum" | "bsc" | "tron" | "solana" | "bitcoin";
export type PaymentToken = "ETH" | "BTC" | "SOL" | "USDC" | "USDT";

export interface PairConfig {
  chain: PaymentChain;
  token: PaymentToken;
  /** Display label, e.g. "USDC on Ethereum". */
  label: string;
  /** Display label for just the network, e.g. "Ethereum" or "BNB Chain". */
  chainLabel: string;
  /** Decimals used for amount formatting. */
  decimals: number;
  /** EVM chainId for wagmi flows; null for non-EVM chains. */
  chainId: number | null;
  /** ERC20/TRC20 contract address; null for native currencies. */
  contract: string | null;
  /** Gecko ID for live USD pricing; null for stablecoins (treated 1:1). */
  geckoId: string | null;
  /** Optional override env var for the deposit address. */
  recipient: () => string | null;
  /** Whether this pair is currently enabled. */
  enabled: boolean;
}

const DEFAULTS = {
  // EVM addresses passed to viem must be either all-lowercase OR carry a
  // valid EIP-55 checksum — mixed case that doesn't match the checksum
  // throws InvalidAddressError. We store lowercase to dodge the issue.
  evm: "0x35de0b4157ecb2037ab1041d2333981e81baef24",
  btc: "bc1qjuekjcmlxs90cepkp8qtvanj20hamu74f6t8a3",
  sol: "72FEbjJmA4Ac37gSpceF9KLmamvCY3tBgYRCoarDDFfM",
} as const;

export function evmRecipient(): string {
  return process.env.PAYMENT_ADDRESS_EVM || DEFAULTS.evm;
}
export function btcRecipient(): string {
  return process.env.PAYMENT_ADDRESS_BTC || DEFAULTS.btc;
}
export function solRecipient(): string {
  return process.env.PAYMENT_ADDRESS_SOL || DEFAULTS.sol;
}
export function tronRecipient(): string | null {
  return process.env.PAYMENT_ADDRESS_TRON || null;
}

export const PAYMENT_PAIRS: PairConfig[] = [
  {
    chain: "ethereum",
    token: "ETH",
    label: "ETH on Ethereum",
    chainLabel: "Ethereum",
    decimals: 18,
    chainId: 1,
    contract: null,
    geckoId: "ethereum",
    recipient: evmRecipient,
    enabled: true,
  },
  {
    chain: "ethereum",
    token: "USDC",
    label: "USDC on Ethereum",
    chainLabel: "Ethereum",
    decimals: 6,
    chainId: 1,
    contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    geckoId: null,
    recipient: evmRecipient,
    enabled: true,
  },
  {
    chain: "ethereum",
    token: "USDT",
    label: "USDT on Ethereum",
    chainLabel: "Ethereum",
    decimals: 6,
    chainId: 1,
    contract: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    geckoId: null,
    recipient: evmRecipient,
    enabled: true,
  },
  {
    chain: "bsc",
    token: "USDC",
    label: "USDC on BNB Chain",
    chainLabel: "BNB Chain",
    decimals: 18,
    chainId: 56,
    contract: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    geckoId: null,
    recipient: evmRecipient,
    enabled: true,
  },
  {
    chain: "bsc",
    token: "USDT",
    label: "USDT on BNB Chain",
    chainLabel: "BNB Chain",
    decimals: 18,
    chainId: 56,
    contract: "0x55d398326f99059ff775485246999027b3197955",
    geckoId: null,
    recipient: evmRecipient,
    enabled: true,
  },
  {
    chain: "tron",
    token: "USDC",
    label: "USDC on Tron",
    chainLabel: "Tron",
    decimals: 6,
    chainId: null,
    contract: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8",
    geckoId: null,
    recipient: tronRecipient,
    enabled: true,
  },
  {
    chain: "tron",
    token: "USDT",
    label: "USDT on Tron",
    chainLabel: "Tron",
    decimals: 6,
    chainId: null,
    contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    geckoId: null,
    recipient: tronRecipient,
    enabled: true,
  },
  {
    chain: "solana",
    token: "SOL",
    label: "SOL on Solana",
    chainLabel: "Solana",
    decimals: 9,
    chainId: null,
    contract: null,
    geckoId: "solana",
    recipient: solRecipient,
    enabled: true,
  },
  {
    chain: "bitcoin",
    token: "BTC",
    label: "BTC on Bitcoin",
    chainLabel: "Bitcoin",
    decimals: 8,
    chainId: null,
    contract: null,
    geckoId: "bitcoin",
    recipient: btcRecipient,
    enabled: true,
  },
];

export function findPair(chain: string, token: string): PairConfig | null {
  return (
    PAYMENT_PAIRS.find(
      (p) => p.chain === chain && p.token === token,
    ) ?? null
  );
}
