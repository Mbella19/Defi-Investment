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
   * full origin of the URI field must match this exactly. Pass the canonical
   * app origin (for example `https://app.example.com`). Without this the message is
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

function parsedUri(uri: string): URL | null {
  try {
    return new URL(uri);
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
  const uri = parsedUri(uriMatch[1]);
  if (!uri) return { ok: false, error: "URI field is not a valid URL" };
  if (uri.username || uri.password) {
    return { ok: false, error: "URI field must not contain credentials" };
  }

  if (expectedOrigin) {
    let expected: URL;
    try {
      expected = new URL(expectedOrigin.includes("://") ? expectedOrigin : `https://${expectedOrigin}`);
    } catch {
      return { ok: false, error: "expected origin is invalid" };
    }
    // The EIP-4361 Domain is host[:port], while URI is a full origin. Bind
    // both host and scheme so an HTTP message cannot replay against HTTPS.
    if (domain !== expected.host) {
      return { ok: false, error: `Domain ${domain} does not match expected host ${expected.host}` };
    }
    if (uri.origin !== expected.origin) {
      return { ok: false, error: `URI origin ${uri.origin} does not match expected origin ${expected.origin}` };
    }
  } else {
    // Even without an expectedOrigin, Domain ↔ URI must agree internally.
    if (domain !== uri.host) {
      return { ok: false, error: `Domain ${domain} does not match URI host ${uri.host}` };
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
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
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
    if (Number.isNaN(exp)) {
      return { ok: false, error: "message Expiration Time is not a valid timestamp" };
    }
    if (exp < Date.now()) {
      return { ok: false, error: "message Expiration Time has passed" };
    }
  }
  const notBeforeMatch = message.match(NOT_BEFORE_RE);
  if (notBeforeMatch) {
    const nbf = Date.parse(notBeforeMatch[1]);
    if (Number.isNaN(nbf)) {
      return { ok: false, error: "message Not Before is not a valid timestamp" };
    }
    if (nbf > Date.now()) {
      return { ok: false, error: "message Not Before is in the future" };
    }
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

  // Consume only after cryptographic verification. The database UPDATE is
  // atomic, so concurrent valid replays still have exactly one winner while
  // a typo/invalid signature cannot burn the user's one-time nonce.
  if (!consumeNonce(nonce)) {
    return { ok: false, error: "nonce is invalid, expired, or already used" };
  }

  return { ok: true, address: claimedAddress.toLowerCase() };
}
