import "server-only";
import { fetchWithTimeout } from "@/lib/fetch-utils";
import { compareAmount } from "./pricing";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const REQUIRED_CONFIRMATIONS = 32; // ~13 sec — finalized commitment is safer

interface SolanaTxResponse {
  result?: {
    slot?: number;
    meta?: {
      err: unknown;
      preBalances?: number[];
      postBalances?: number[];
      preTokenBalances?: Array<{ accountIndex: number; mint: string; uiTokenAmount: { amount: string } }>;
      postTokenBalances?: Array<{ accountIndex: number; mint: string; uiTokenAmount: { amount: string } }>;
    };
    transaction?: {
      message?: {
        accountKeys?: string[];
      };
    };
  };
  error?: { message?: string };
}

export async function verifySolanaTransaction(params: {
  txHash: string;
  expectedRecipient: string;
  expectedAmount: string;
}): Promise<
  | { ok: true; observed: { from: string; to: string; amount: string } }
  | { ok: false; reason: string }
> {
  const { txHash, expectedRecipient, expectedAmount } = params;
  if (!/^[1-9A-HJ-NP-Za-km-z]{40,90}$/.test(txHash)) {
    return { ok: false, reason: "Invalid Solana signature" };
  }

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTransaction",
    params: [
      txHash,
      { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "finalized" },
    ],
  };

  const res = await fetchWithTimeout(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, reason: `Solana RPC failed (${res.status})` };
  const data = (await res.json()) as SolanaTxResponse;
  if (data.error) return { ok: false, reason: data.error.message ?? "Solana RPC error" };
  const result = data.result;
  if (!result || !result.transaction) {
    return { ok: false, reason: "Solana tx not yet finalized" };
  }
  if (result.meta?.err) {
    return { ok: false, reason: "Solana tx failed on-chain" };
  }

  const accountKeys = result.transaction.message?.accountKeys ?? [];
  const recipientIndex = accountKeys.findIndex((k) => k === expectedRecipient);
  if (recipientIndex === -1) {
    return { ok: false, reason: "Deposit address not present in tx" };
  }

  const pre = result.meta?.preBalances?.[recipientIndex] ?? 0;
  const post = result.meta?.postBalances?.[recipientIndex] ?? 0;
  const delta = BigInt(post) - BigInt(pre);
  if (delta <= BigInt(0)) {
    return { ok: false, reason: "Deposit address didn't receive value" };
  }
  if (!compareAmount(delta.toString(), expectedAmount)) {
    return { ok: false, reason: "SOL amount mismatch with quote" };
  }
  // Best-effort `from` — index 0 is usually the fee payer / sender.
  const from = accountKeys[0] ?? "";
  // Slot-based confirmation check
  const slotRes = await fetchWithTimeout(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [{ commitment: "finalized" }] }),
  });
  if (slotRes.ok) {
    const sd = (await slotRes.json()) as { result?: number };
    if (typeof sd.result === "number" && typeof result.slot === "number") {
      const conf = sd.result - result.slot;
      if (conf < REQUIRED_CONFIRMATIONS) {
        return { ok: false, reason: `Need more confirmations (${conf}/${REQUIRED_CONFIRMATIONS})` };
      }
    }
  }

  return {
    ok: true,
    observed: { from, to: expectedRecipient, amount: delta.toString() },
  };
}
