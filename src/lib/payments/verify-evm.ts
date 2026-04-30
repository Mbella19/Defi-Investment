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
}): Promise<
  | { ok: true; observed: { from: string; to: string; amount: string } }
  | { ok: false; reason: string }
> {
  const { chain, txHash, pair, expectedRecipient, expectedAmount } = params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Invalid transaction hash" };
  }
  const client = clientForChain(chain);

  const [tx, receipt, latest] = await Promise.all([
    client.getTransaction({ hash: txHash as Hex }).catch(() => null),
    client.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null),
    client.getBlockNumber().catch(() => null),
  ]);

  if (!tx) return { ok: false, reason: "Transaction not found" };
  if (!receipt) return { ok: false, reason: "Transaction not yet mined" };
  if (receipt.status !== "success") return { ok: false, reason: "Transaction reverted" };

  const required = REQUIRED_CONFIRMATIONS_BY_CHAIN[chain] ?? 6;
  if (latest !== null && receipt.blockNumber !== null && latest - receipt.blockNumber < BigInt(required)) {
    return {
      ok: false,
      reason: `Need ${required} confirmations — got ${latest - receipt.blockNumber}`,
    };
  }

  if (pair.contract === null) {
    // Native ETH or BNB transfer — recipient + value live on the tx itself.
    const observedTo = (tx.to ?? "").toLowerCase();
    if (observedTo !== expectedRecipient.toLowerCase()) {
      return { ok: false, reason: `Recipient mismatch (got ${observedTo})` };
    }
    if (!compareAmount(tx.value.toString(), expectedAmount)) {
      return { ok: false, reason: "Amount mismatch with quote" };
    }
    return {
      ok: true,
      observed: {
        from: tx.from.toLowerCase(),
        to: observedTo,
        amount: tx.value.toString(),
      },
    };
  }

  // ERC20 transfer — scan receipt logs for the matching Transfer event.
  const expectedContract = pair.contract.toLowerCase();
  const matching = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === expectedContract &&
      log.topics[0]?.toLowerCase() === ERC20_TRANSFER_EVENT_TOPIC,
  );
  if (!matching) {
    return { ok: false, reason: "No matching token transfer in receipt" };
  }
  const decoded = decodeTransfer(matching.topics, matching.data);
  if (!decoded) return { ok: false, reason: "Could not decode transfer log" };
  if (decoded.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
    return { ok: false, reason: `Recipient mismatch (got ${decoded.to})` };
  }
  if (!compareAmount(decoded.value, expectedAmount)) {
    return { ok: false, reason: "Token amount mismatch with quote" };
  }
  return {
    ok: true,
    observed: {
      from: decoded.from.toLowerCase(),
      to: decoded.to.toLowerCase(),
      amount: decoded.value,
    },
  };
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
  const from = "0x" + fromTopic.slice(-40);
  const to = "0x" + toTopic.slice(-40);
  const valueHex = data.startsWith("0x") ? data.slice(2) : data;
  const value = BigInt("0x" + valueHex).toString();
  return { from, to, value };
}
