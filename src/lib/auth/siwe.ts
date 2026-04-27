import { verifyMessage, isAddress, getAddress } from "viem";
import { consumeNonce } from "./nonce-store";

/**
 * Minimal EIP-4361 (Sign-In With Ethereum) verification. We don't pull in a
 * SIWE library because the protocol is small enough to parse directly with
 * regex and viem's verifyMessage handles the cryptography.
 *
 * The client must construct a message of the form:
 *
 *   <domain> wants you to sign in with your Ethereum account:
 *   <address>
 *
 *   <statement>
 *
 *   URI: <uri>
 *   Version: 1
 *   Chain ID: <chainId>
 *   Nonce: <nonce>
 *   Issued At: <ISO timestamp>
 */

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/m;
const NONCE_RE = /^Nonce: ([A-Za-z0-9_-]+)$/m;
const ISSUED_RE = /^Issued At: (.+)$/m;

const ISSUED_TOLERANCE_MS = 10 * 60 * 1000;

export interface VerifySiweInput {
  message: string;
  signature: string;
  /** If provided, the message's URI/domain must contain this expected origin. */
  expectedOrigin?: string;
}

export interface VerifySiweResult {
  ok: boolean;
  address?: string;
  error?: string;
}

export async function verifySiweMessage(input: VerifySiweInput): Promise<VerifySiweResult> {
  const { message, signature } = input;
  if (typeof message !== "string" || typeof signature !== "string") {
    return { ok: false, error: "message and signature are required strings" };
  }

  const addrMatch = message.match(ADDRESS_RE);
  if (!addrMatch || !isAddress(addrMatch[0])) {
    return { ok: false, error: "message does not contain a valid wallet address" };
  }
  const claimedAddress = getAddress(addrMatch[0]);

  const nonceMatch = message.match(NONCE_RE);
  if (!nonceMatch) return { ok: false, error: "message missing Nonce field" };
  const nonce = nonceMatch[1];

  const issuedMatch = message.match(ISSUED_RE);
  if (!issuedMatch) return { ok: false, error: "message missing Issued At field" };
  const issuedAt = Date.parse(issuedMatch[1]);
  if (Number.isNaN(issuedAt)) {
    return { ok: false, error: "Issued At is not a valid timestamp" };
  }
  if (Math.abs(Date.now() - issuedAt) > ISSUED_TOLERANCE_MS) {
    return { ok: false, error: "message is too old or in the future (10min tolerance)" };
  }

  // Consume the nonce *before* verifying so a failed verify still burns it
  // (replay protection even on partial failures).
  if (!consumeNonce(nonce)) {
    return { ok: false, error: "nonce is invalid, expired, or already used" };
  }

  let ok = false;
  try {
    ok = await verifyMessage({
      address: claimedAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return { ok: false, error: "signature verification threw" };
  }
  if (!ok) return { ok: false, error: "signature does not match address" };

  return { ok: true, address: claimedAddress.toLowerCase() };
}
