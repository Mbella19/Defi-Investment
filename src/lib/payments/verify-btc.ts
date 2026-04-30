import "server-only";
import { fetchWithTimeout } from "@/lib/fetch-utils";
import { compareAmount } from "./pricing";

const MEMPOOL_BASE = process.env.MEMPOOL_API_URL || "https://mempool.space/api";
const REQUIRED_CONFIRMATIONS = 1; // single conf is enough for the value bracket here

interface MempoolTx {
  status?: { confirmed?: boolean; block_height?: number };
  vin?: Array<{ prevout?: { scriptpubkey_address?: string } }>;
  vout?: Array<{ scriptpubkey_address?: string; value?: number }>;
}

export async function verifyBitcoinTransaction(params: {
  txHash: string;
  expectedRecipient: string;
  expectedAmount: string;
}): Promise<
  | { ok: true; observed: { from: string; to: string; amount: string } }
  | { ok: false; reason: string }
> {
  const { txHash, expectedRecipient, expectedAmount } = params;
  if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Invalid Bitcoin tx hash" };
  }

  const txRes = await fetchWithTimeout(`${MEMPOOL_BASE}/tx/${txHash}`);
  if (!txRes.ok) {
    return { ok: false, reason: `mempool.space lookup failed (${txRes.status})` };
  }
  const tx = (await txRes.json()) as MempoolTx;

  if (!tx.status?.confirmed) {
    return { ok: false, reason: "Bitcoin tx not yet confirmed" };
  }

  const tipRes = await fetchWithTimeout(`${MEMPOOL_BASE}/blocks/tip/height`);
  let tipHeight = 0;
  if (tipRes.ok) {
    const txt = await tipRes.text();
    tipHeight = Number(txt.trim()) || 0;
  }
  const txHeight = tx.status.block_height ?? 0;
  const conf = tipHeight && txHeight ? tipHeight - txHeight + 1 : 0;
  if (conf < REQUIRED_CONFIRMATIONS) {
    return { ok: false, reason: `Need ${REQUIRED_CONFIRMATIONS} confirmation(s) — got ${conf}` };
  }

  const matching = (tx.vout ?? []).find(
    (out) => out.scriptpubkey_address === expectedRecipient,
  );
  if (!matching || typeof matching.value !== "number") {
    return { ok: false, reason: "Deposit address not present in tx outputs" };
  }
  const observedSats = BigInt(matching.value).toString();
  if (!compareAmount(observedSats, expectedAmount)) {
    return { ok: false, reason: "Amount mismatch with quote" };
  }
  // Best-effort `from` — first input's scriptpubkey_address.
  const from = tx.vin?.[0]?.prevout?.scriptpubkey_address ?? "";
  return {
    ok: true,
    observed: { from, to: expectedRecipient, amount: observedSats },
  };
}
