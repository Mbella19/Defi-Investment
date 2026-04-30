import "server-only";
import type { PairConfig } from "./config";
import { verifyEvmTransaction } from "./verify-evm";
import { verifyTronTransaction } from "./verify-tron";
import { verifySolanaTransaction } from "./verify-solana";
import { verifyBitcoinTransaction } from "./verify-btc";

export type VerifyResult =
  | { ok: true; observed: { from: string; to: string; amount: string } }
  | { ok: false; reason: string };

export async function verifyTransaction(params: {
  pair: PairConfig;
  txHash: string;
  expectedRecipient: string;
  expectedAmount: string;
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
      });
    case "tron":
      return verifyTronTransaction({
        txHash: params.txHash,
        pair,
        expectedRecipient: params.expectedRecipient,
        expectedAmount: params.expectedAmount,
      });
    case "solana":
      return verifySolanaTransaction({
        txHash: params.txHash,
        expectedRecipient: params.expectedRecipient,
        expectedAmount: params.expectedAmount,
      });
    case "bitcoin":
      return verifyBitcoinTransaction({
        txHash: params.txHash,
        expectedRecipient: params.expectedRecipient,
        expectedAmount: params.expectedAmount,
      });
    default:
      return { ok: false, reason: `Unsupported chain: ${pair.chain}` };
  }
}
