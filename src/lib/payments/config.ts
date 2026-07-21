/**
 * Payment configuration — supported chain/token pairs, deposit addresses,
 * decimals, and metadata for the checkout flow.
 *
 * Checkout intentionally supports EVM payments only. Every rail is bound to
 * the SIWE wallet that submits the transaction, which prevents a third party
 * from claiming somebody else's payment.
 */

import { isAddress } from "viem";

export type PaymentChain = "ethereum" | "bsc";
export type PaymentToken = "ETH" | "USDC" | "USDT";

export interface PairConfig {
  chain: PaymentChain;
  token: PaymentToken;
  /** Display label, e.g. "USDC on Ethereum". */
  label: string;
  /** Display label for just the network, e.g. "Ethereum" or "BNB Chain". */
  chainLabel: string;
  /** Decimals used for amount formatting. */
  decimals: number;
  /** EVM chainId for wagmi and server-side verification. */
  chainId: number;
  /** ERC-20 contract address; null for native currencies. */
  contract: string | null;
  /** CoinGecko ID used for live USD pricing, including stablecoins. */
  geckoId: string;
  /** Optional override env var for the deposit address. */
  recipient: () => string | null;
  /** Whether this pair is currently enabled. */
  enabled: boolean;
}

export function evmRecipient(): string | null {
  const configured = process.env.PAYMENT_ADDRESS_EVM?.trim();
  if (!configured || !isAddress(configured)) return null;
  return configured.toLowerCase();
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
    geckoId: "usd-coin",
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
    geckoId: "tether",
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
    geckoId: "usd-coin",
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
    geckoId: "tether",
    recipient: evmRecipient,
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
