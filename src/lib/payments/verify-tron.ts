import "server-only";
import { createHash } from "crypto";
import bs58 from "bs58";
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

function sha256(buf: Buffer): Buffer {
  return createHash("sha256").update(buf).digest();
}

/**
 * Normalize any Tron address representation to canonical lowercase hex
 * ("41" + 40 hex chars). TronGrid mixes formats across endpoints: base58check
 * ("T…"), prefixed hex ("41…" / "0x41…"), and bare 20-byte EVM-style hex.
 * Our config/env hold base58 — comparing raw strings never matched, which
 * silently failed every Tron payment verification.
 *
 * Returns null for anything that doesn't parse as a Tron address.
 */
export function normalizeTronAddress(input: string | null | undefined): string | null {
  if (!input) return null;
  const addr = input.trim();

  // Base58check: T-prefixed, decodes to 21-byte payload (0x41 + address) + 4-byte checksum.
  if (/^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(addr)) {
    let decoded: Uint8Array;
    try {
      decoded = bs58.decode(addr);
    } catch {
      return null;
    }
    if (decoded.length !== 25) return null;
    const payload = Buffer.from(decoded.slice(0, 21));
    const checksum = Buffer.from(decoded.slice(21));
    const expected = sha256(sha256(payload)).subarray(0, 4);
    if (!checksum.equals(expected)) return null;
    if (payload[0] !== 0x41) return null;
    return payload.toString("hex").toLowerCase();
  }

  const hex = addr.startsWith("0x") || addr.startsWith("0X") ? addr.slice(2) : addr;
  // Prefixed hex form: 41 + 20 bytes.
  if (/^41[0-9a-fA-F]{40}$/.test(hex)) return hex.toLowerCase();
  // Bare 20-byte hex (some event payloads drop the 0x41 network prefix).
  if (/^[0-9a-fA-F]{40}$/.test(hex)) return `41${hex.toLowerCase()}`;

  return null;
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
  const expectedContract = normalizeTronAddress(pair.contract);
  const expectedTo = normalizeTronAddress(expectedRecipient);
  if (!expectedContract || !expectedTo) {
    return { ok: false, reason: "Tron payment configuration is invalid (contract/recipient address)" };
  }
  // Same recipient-first matching as the EVM verifier: consider every
  // Transfer on our token, prefer one whose amount matches the quote, and
  // keep a recipient-only match so amount mismatches report clearly.
  let recipientMatch: TronEvent | null = null;
  let amountMatch: TronEvent | null = null;
  for (const ev of events) {
    if (ev.event_name !== "Transfer" || !ev.result) continue;
    if (normalizeTronAddress(ev.contract_address) !== expectedContract) continue;
    if (normalizeTronAddress(ev.result.to) !== expectedTo) continue;
    if (compareAmount(ev.result.value ?? "0", expectedAmount)) {
      amountMatch = ev;
      break;
    }
    recipientMatch = recipientMatch ?? ev;
  }
  if (!amountMatch) {
    if (recipientMatch) {
      return { ok: false, reason: "Amount mismatch with quote" };
    }
    return { ok: false, reason: "No matching TRC20 Transfer event in tx" };
  }
  return {
    ok: true,
    observed: {
      from: normalizeTronAddress(amountMatch.result?.from) ?? "",
      to: expectedTo,
      amount: amountMatch.result?.value ?? "0",
    },
  };
}
