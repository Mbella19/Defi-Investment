import { createHmac, timingSafeEqual, randomBytes } from "crypto";

/**
 * Server-side session helpers. The cookie value is a self-contained,
 * HMAC-signed JSON blob — no DB row, no external session store. This works
 * across serverless instances because verification only needs SESSION_SECRET.
 */

const COOKIE_NAME = "sov_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface SessionPayload {
  /** Lower-case 0x-prefixed wallet address. */
  wallet: string;
  /** Expiration epoch milliseconds. */
  exp: number;
}

function getSecret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET is not set or is shorter than 32 chars — required for cookie auth",
    );
  }
  return Buffer.from(s, "utf-8");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function sign(payloadB64: string): string {
  return b64url(createHmac("sha256", getSecret()).update(payloadB64).digest());
}

/** Build a signed cookie value for a wallet. */
export function buildSessionCookie(wallet: string): string {
  const payload: SessionPayload = {
    wallet: wallet.toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/** Parse a cookie header into a map. */
function parseCookies(header: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) map.set(k, decodeURIComponent(v));
  }
  return map;
}

/** Read+verify the session cookie from a request; return wallet or null. */
export function getSessionWallet(request: Request): string | null {
  if (!process.env.SESSION_SECRET) return null;
  const cookies = parseCookies(request.headers.get("cookie"));
  const raw = cookies.get(COOKIE_NAME);
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payloadB64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(payloadB64);
  // timingSafeEqual requires equal lengths; bail if not.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf-8")) as SessionPayload;
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (typeof payload.wallet !== "string" || !/^0x[a-f0-9]{40}$/.test(payload.wallet)) return null;
  return payload.wallet;
}

export function sessionCookieHeader(wallet: string): string {
  const value = buildSessionCookie(wallet);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** 32-byte random nonce, base64url-encoded. */
export function generateNonce(): string {
  return b64url(randomBytes(32));
}
