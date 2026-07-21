import "server-only";
import type { PairConfig } from "./config";
import { verifyEvmTransaction } from "./verify-evm";

export type VerifyResult =
  | { ok: true; observed: { from: string; to: string; amount: string; settledAt: string } }
  | { ok: false; reason: string; retryable: boolean };

export async function verifyTransaction(params: {
  pair: PairConfig;
  txHash: string;
  expectedRecipient: string;
  expectedAmount: string;
  expectedSender: string;
  notBefore: string;
  notAfter: string;
}): Promise<VerifyResult> {
  const { pair } = params;
  switch (pair.chain) {
    case "ethereum":
    case "bsc":
      return verifyEvmTransaction({
        chain: pair.chain,
        txHash: params.txHash,
        pair,
        expectedRecipient: params.expectedRecipient,
        expectedAmount: params.expectedAmount,
        expectedSender: params.expectedSender,
        notBefore: params.notBefore,
        notAfter: params.notAfter,
      });
    default:
      return { ok: false, reason: `Unsupported chain: ${pair.chain}`, retryable: false };
  }
}
