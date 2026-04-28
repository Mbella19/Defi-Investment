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
// First line of an EIP-4361 message: "<domain> wants you to sign in with your Ethereum account:"
const DOMAIN_RE = /^([^\s]+) wants you to sign in with your Ethereum account:/m;
const URI_RE = /^URI: (.+)$/m;
const VERSION_RE = /^Version: (.+)$/m;
const CHAIN_ID_RE = /^Chain ID: (\d+)$/m;
const EXPIRATION_RE = /^Expiration Time: (.+)$/m;
const NOT_BEFORE_RE = /^Not Before: (.+)$/m;

const ISSUED_TOLERANCE_MS = 10 * 60 * 1000;
const SUPPORTED_VERSION = "1";

export interface VerifySiweInput {
  message: string;
  signature: string;
  /**
   * Required in production. Both the EIP-4361 Domain (first line) and the
   * Origin of the URI field must match this exactly. Pass `request.headers.get("host")`
   * or `process.env.NEXT_PUBLIC_APP_HOST`. Without this the message is
   * replayable across deployments that share the SESSION_SECRET.
   */
  expectedOrigin?: string;
  /** If set, the message's Chain ID must match this number. */
  expectedChainId?: number;
}

export interface VerifySiweResult {
  ok: boolean;
  address?: string;
  error?: string;
}

function originOf(uri: string): string | null {
  try {
    return new URL(uri).host;
  } catch {
    return null;
  }
}

export async function verifySiweMessage(input: VerifySiweInput): Promise<VerifySiweResult> {
  const { message, signature, expectedOrigin, expectedChainId } = input;
  if (typeof message !== "string" || typeof signature !== "string") {
    return { ok: false, error: "message and signature are required strings" };
  }

  const addrMatch = message.match(ADDRESS_RE);
  if (!addrMatch || !isAddress(addrMatch[0])) {
    return { ok: false, error: "message does not contain a valid wallet address" };
  }
  const claimedAddress = getAddress(addrMatch[0]);

  // Domain (first line) and URI must agree, and both must match expectedOrigin.
  const domainMatch = message.match(DOMAIN_RE);
  if (!domainMatch) return { ok: false, error: "message missing Domain header line" };
  const domain = domainMatch[1];

  const uriMatch = message.match(URI_RE);
  if (!uriMatch) return { ok: false, error: "message missing URI field" };
  const uriHost = originOf(uriMatch[1]);
  if (!uriHost) return { ok: false, error: "URI field is not a valid URL" };

  if (expectedOrigin) {
    // Domain may include a port (matches Host header); URI host always does.
    if (domain !== expectedOrigin) {
      return { ok: false, error: `Domain ${domain} does not match expected origin ${expectedOrigin}` };
    }
    if (uriHost !== expectedOrigin) {
      return { ok: false, error: `URI host ${uriHost} does not match expected origin ${expectedOrigin}` };
    }
  } else {
    // Even without an expectedOrigin, Domain ↔ URI must agree internally.
    if (domain !== uriHost) {
      return { ok: false, error: `Domain ${domain} does not match URI host ${uriHost}` };
    }
  }

  const versionMatch = message.match(VERSION_RE);
  if (!versionMatch) return { ok: false, error: "message missing Version field" };
  if (versionMatch[1].trim() !== SUPPORTED_VERSION) {
    return { ok: false, error: `unsupported SIWE version: ${versionMatch[1]}` };
  }

  const chainIdMatch = message.match(CHAIN_ID_RE);
  if (!chainIdMatch) return { ok: false, error: "message missing Chain ID field" };
  const chainId = Number(chainIdMatch[1]);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    return { ok: false, error: "Chain ID is not a positive integer" };
  }
  if (typeof expectedChainId === "number" && chainId !== expectedChainId) {
    return { ok: false, error: `Chain ID ${chainId} does not match expected ${expectedChainId}` };
  }

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

  // Optional Expiration Time / Not Before windows.
  const expirationMatch = message.match(EXPIRATION_RE);
  if (expirationMatch) {
    const exp = Date.parse(expirationMatch[1]);
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return { ok: false, error: "message Expiration Time has passed" };
    }
  }
  const notBeforeMatch = message.match(NOT_BEFORE_RE);
  if (notBeforeMatch) {
    const nbf = Date.parse(notBeforeMatch[1]);
    if (!Number.isNaN(nbf) && nbf > Date.now()) {
      return { ok: false, error: "message Not Before is in the future" };
    }
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
