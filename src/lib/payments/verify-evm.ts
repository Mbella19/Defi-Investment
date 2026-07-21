import "server-only";
import { createPublicClient, http, type Hex } from "viem";
import { mainnet, bsc } from "viem/chains";
import { getRpcUrl } from "@/lib/rpc";
import { compareAmount } from "./pricing";
import type { PairConfig } from "./config";

const REQUIRED_CONFIRMATIONS_BY_CHAIN: Record<string, number> = {
  ethereum: 6,
  bsc: 12,
};

function clientForChain(chain: "ethereum" | "bsc") {
  if (chain === "ethereum") {
    return createPublicClient({ chain: mainnet, transport: http(getRpcUrl(1)) });
  }
  return createPublicClient({ chain: bsc, transport: http(getRpcUrl(56)) });
}

export async function verifyEvmTransaction(params: {
  chain: "ethereum" | "bsc";
  txHash: string;
  pair: PairConfig;
  expectedRecipient: string;
  expectedAmount: string;
  expectedSender: string;
  notBefore: string;
  notAfter: string;
}): Promise<
  | { ok: true; observed: { from: string; to: string; amount: string; settledAt: string } }
  | { ok: false; reason: string; retryable: boolean }
> {
  const {
    chain,
    txHash,
    pair,
    expectedRecipient,
    expectedAmount,
    expectedSender,
    notBefore,
    notAfter,
  } = params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Invalid transaction hash", retryable: false };
  }
  const client = clientForChain(chain);

  let tx: Awaited<ReturnType<typeof client.getTransaction>>;
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  let latest: bigint;
  try {
    [tx, receipt, latest] = await Promise.all([
      client.getTransaction({ hash: txHash as Hex }),
      client.getTransactionReceipt({ hash: txHash as Hex }),
      client.getBlockNumber(),
    ]);
  } catch {
    return {
      ok: false,
      reason: "Transaction is unavailable or the chain RPC could not verify it yet",
      retryable: true,
    };
  }

  if (receipt.status !== "success") {
    return { ok: false, reason: "Transaction reverted", retryable: false };
  }
  if (receipt.blockNumber > latest) {
    return { ok: false, reason: "Chain head is behind the payment receipt", retryable: true };
  }

  const required = REQUIRED_CONFIRMATIONS_BY_CHAIN[chain] ?? 6;
  const confirmations = latest - receipt.blockNumber + BigInt(1);
  if (confirmations < BigInt(required)) {
    return {
      ok: false,
      reason: `Need ${required} confirmations — got ${confirmations}`,
      retryable: true,
    };
  }

  let block: Awaited<ReturnType<typeof client.getBlock>>;
  try {
    block = await client.getBlock({ blockNumber: receipt.blockNumber });
  } catch {
    return { ok: false, reason: "Could not verify payment block time", retryable: true };
  }
  const settledAtMs = Number(block.timestamp) * 1000;
  const notBeforeMs = Date.parse(notBefore);
  const notAfterMs = Date.parse(notAfter);
  if (!Number.isFinite(settledAtMs) || !Number.isFinite(notBeforeMs) || !Number.isFinite(notAfterMs)) {
    return { ok: false, reason: "Payment time bounds are invalid", retryable: false };
  }
  if (settledAtMs < notBeforeMs) {
    return { ok: false, reason: "Transaction predates this payment quote", retryable: false };
  }
  if (settledAtMs > notAfterMs) {
    return { ok: false, reason: "Transaction was mined after the quote expired", retryable: false };
  }
  const settledAt = new Date(settledAtMs).toISOString();
  const observedSender = tx.from.toLowerCase();
  if (observedSender !== expectedSender.toLowerCase()) {
    return {
      ok: false,
      reason: "Payment sender does not match the signed-in wallet",
      retryable: false,
    };
  }

  if (pair.contract === null) {
    // Native ETH or BNB transfer — recipient + value live on the tx itself.
    const observedTo = (tx.to ?? "").toLowerCase();
    if (observedTo !== expectedRecipient.toLowerCase()) {
      return { ok: false, reason: `Recipient mismatch (got ${observedTo})`, retryable: false };
    }
    if (!compareAmount(tx.value.toString(), expectedAmount)) {
      return { ok: false, reason: "Amount is below the quoted amount", retryable: false };
    }
    return {
      ok: true,
      observed: {
        from: observedSender,
        to: observedTo,
        amount: tx.value.toString(),
        settledAt,
      },
    };
  }

  // ERC20 transfer — scan ALL Transfer events on the expected token contract
  // and pick the one that pays the deposit address. A tx routed through a
  // router/aggregator can carry several transfers of the same token; matching
  // only the first log rejected legitimate payments.
  const matched = matchErc20Transfer(
    receipt.logs,
    pair.contract,
    expectedRecipient,
    expectedSender,
    expectedAmount,
  );
  if (!matched) {
    return {
      ok: false,
      reason: "No transfer to the deposit address found in this transaction",
      retryable: false,
    };
  }
  if (!matched.amountMatches) {
    return { ok: false, reason: "Token amount is below the quoted amount", retryable: false };
  }
  const decoded = matched.transfer;
  return {
    ok: true,
    observed: {
      from: observedSender,
      to: decoded.to.toLowerCase(),
      amount: decoded.value,
      settledAt,
    },
  };
}

export interface Erc20LogLike {
  address: string;
  topics: readonly Hex[];
  data: Hex;
}

/**
 * Find the ERC-20 Transfer event on `contract` that pays `recipient`.
 * Returns the transfer plus whether its amount matches the quote — a
 * recipient match with the wrong amount is surfaced so the caller can report
 * "amount mismatch" instead of "no transfer found". Pure — unit-testable
 * against fixture receipts.
 */
export function matchErc20Transfer(
  logs: readonly Erc20LogLike[],
  contract: string,
  recipient: string,
  sender: string,
  expectedAmount: string,
): { transfer: { from: string; to: string; value: string }; amountMatches: boolean } | null {
  const wantContract = contract.toLowerCase();
  const wantTo = recipient.toLowerCase();
  const wantFrom = sender.toLowerCase();
  let recipientMatch: { from: string; to: string; value: string } | null = null;
  for (const logEntry of logs) {
    if (logEntry.address.toLowerCase() !== wantContract) continue;
    if (logEntry.topics[0]?.toLowerCase() !== ERC20_TRANSFER_EVENT_TOPIC) continue;
    const decoded = decodeTransfer(logEntry.topics, logEntry.data);
    if (!decoded) continue;
    if (decoded.to.toLowerCase() !== wantTo) continue;
    if (decoded.from.toLowerCase() !== wantFrom) continue;
    if (compareAmount(decoded.value, expectedAmount)) {
      return { transfer: decoded, amountMatches: true };
    }
    recipientMatch = recipientMatch ?? decoded;
  }
  return recipientMatch ? { transfer: recipientMatch, amountMatches: false } : null;
}

const ERC20_TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function decodeTransfer(topics: readonly Hex[], data: Hex):
  | { from: string; to: string; value: string }
  | null {
  if (topics.length < 3) return null;
  const fromTopic = topics[1];
  const toTopic = topics[2];
  if (!fromTopic || !toTopic) return null;
  if (fromTopic.length !== 66 || toTopic.length !== 66 || data.length !== 66) return null;
  const from = "0x" + fromTopic.slice(-40);
  const to = "0x" + toTopic.slice(-40);
  const valueHex = data.startsWith("0x") ? data.slice(2) : data;
  try {
    const value = BigInt("0x" + valueHex).toString();
    return { from, to, value };
  } catch {
    return null;
  }
}
