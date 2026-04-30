import "server-only";
import { fetchWithTimeout } from "@/lib/fetch-utils";
import { compareAmount } from "./pricing";
import type { PairConfig } from "./config";

const TRONGRID_BASE = process.env.TRONGRID_API_URL || "https://api.trongrid.io";

interface TronTxInfo {
  ret?: Array<{ contractRet?: string }>;
  raw_data?: {
    contract?: Array<{
      type?: string;
      parameter?: { value?: { contract_address?: string; data?: string; owner_address?: string; to_address?: string; amount?: number } };
    }>;
  };
  blockNumber?: number;
}

interface TronEvent {
  event_name?: string;
  contract_address?: string;
  result?: { from?: string; to?: string; value?: string };
}

export async function verifyTronTransaction(params: {
  txHash: string;
  pair: PairConfig;
  expectedRecipient: string;
  expectedAmount: string;
}): Promise<
  | { ok: true; observed: { from: string; to: string; amount: string } }
  | { ok: false; reason: string }
> {
  const { txHash, pair, expectedRecipient, expectedAmount } = params;
  if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Invalid Tron tx hash" };
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.TRONGRID_API_KEY) {
    headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  }

  // 1. Confirm the tx exists and was successful.
  const infoRes = await fetchWithTimeout(
    `${TRONGRID_BASE}/wallet/gettransactioninfobyid`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ value: txHash }),
    },
  );
  if (!infoRes.ok) {
    return { ok: false, reason: `Tron lookup failed (${infoRes.status})` };
  }
  const info = (await infoRes.json()) as TronTxInfo & { receipt?: { result?: string } };
  if (!info || !info.blockNumber) {
    return { ok: false, reason: "Tron tx not yet confirmed" };
  }
  if (info.receipt && info.receipt.result && info.receipt.result !== "SUCCESS") {
    return { ok: false, reason: `Tron tx status: ${info.receipt.result}` };
  }

  // 2. For TRC20 transfers, fetch the events and find the Transfer log
  // matching our token contract + recipient.
  const eventsRes = await fetchWithTimeout(
    `${TRONGRID_BASE}/v1/transactions/${txHash}/events`,
    { headers },
  );
  if (!eventsRes.ok) {
    return { ok: false, reason: `Tron events lookup failed (${eventsRes.status})` };
  }
  const eventsData = (await eventsRes.json()) as { data?: TronEvent[] };
  const events = eventsData?.data ?? [];
  if (!pair.contract) {
    return { ok: false, reason: "Native TRX payments not supported" };
  }
  const expectedContract = pair.contract.toLowerCase();
  const expectedTo = expectedRecipient.toLowerCase();
  const transfer = events.find(
    (ev) =>
      ev.event_name === "Transfer" &&
      ev.contract_address?.toLowerCase() === expectedContract &&
      ev.result?.to?.toLowerCase() === expectedTo,
  );
  if (!transfer || !transfer.result) {
    return { ok: false, reason: "No matching TRC20 Transfer event in tx" };
  }
  if (!compareAmount(transfer.result.value ?? "0", expectedAmount)) {
    return { ok: false, reason: "Amount mismatch with quote" };
  }
  return {
    ok: true,
    observed: {
      from: transfer.result.from?.toLowerCase() ?? "",
      to: expectedTo,
      amount: transfer.result.value ?? "0",
    },
  };
}
