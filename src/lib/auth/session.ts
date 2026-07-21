import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { CSRF_COOKIE_NAME } from "./constants";

const DEV_COOKIE_NAME = "sov_session";
const PROD_COOKIE_NAME = "__Host-sov_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;

interface SessionRow {
  wallet_address: string;
  csrf_hash: string;
  auth_method: "siwe" | "dev";
  last_seen_at: number;
  expires_at: number;
  revoked_at: number | null;
}

export interface SessionIdentity {
  wallet: string;
  csrfHash: string;
  authMethod: "siwe" | "dev";
  expiresAt: number;
}

export interface NewSessionCookies {
  session: string;
  csrf: string;
  csrfToken: string;
  expiresAt: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

function cookieName(): string {
  return process.env.NODE_ENV === "production" ? PROD_COOKIE_NAME : DEV_COOKIE_NAME;
}

function secureAttribute(): string {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

function tokenHash(purpose: "session" | "csrf", token: string): string {
  return createHmac("sha256", getSecret())
    .update(`${purpose}:${token}`)
    .digest("hex");
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateNonce(): string {
  return randomToken();
}

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    try {
      cookies.set(name, decodeURIComponent(part.slice(separator + 1).trim()));
    } catch {
      // Malformed caller cookies are ignored rather than turning auth into a 500.
    }
  }
  return cookies;
}

function sessionToken(request: Request): string | null {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies.get(cookieName()) ?? null;
}

function pruneExpiredSessions(): void {
  const now = Date.now();
  getDb()
    .prepare("DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL")
    .run(now);
}

export function createSessionCookies(
  wallet: string,
  authMethod: "siwe" | "dev" = "siwe",
): NewSessionCookies {
  const normalizedWallet = wallet.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
    throw new Error("Cannot create a session for an invalid wallet address");
  }
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const db = getDb();
  db.transaction(() => {
    pruneExpiredSessions();
    // A fresh SIWE login rotates prior sessions for this wallet. This keeps
    // logout/address-switch semantics deterministic on a local single-user app.
    db.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE wallet_address = ? AND revoked_at IS NULL")
      .run(now, normalizedWallet);
    db.prepare(
      `INSERT INTO auth_sessions
       (token_hash, wallet_address, csrf_hash, auth_method, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      tokenHash("session", sessionToken),
      normalizedWallet,
      tokenHash("csrf", csrfToken),
      authMethod,
      now,
      now,
      expiresAt,
    );
  })();

  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const common = `${secureAttribute()}; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
  return {
    session: `${cookieName()}=${encodeURIComponent(sessionToken)}; HttpOnly${common}`,
    csrf: `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}${common}`,
    csrfToken,
    expiresAt,
  };
}

export function appendSessionCookies(headers: Headers, cookies: NewSessionCookies): void {
  headers.append("Set-Cookie", cookies.session);
  headers.append("Set-Cookie", cookies.csrf);
}

export function getSession(request: Request): SessionIdentity | null {
  if (!process.env.SESSION_SECRET) return null;
  const rawToken = sessionToken(request);
  if (!rawToken || rawToken.length > 256) return null;
  let row: SessionRow | undefined;
  try {
    row = getDb()
      .prepare(
        `SELECT wallet_address, csrf_hash, auth_method, last_seen_at, expires_at, revoked_at
         FROM auth_sessions WHERE token_hash = ?`,
      )
      .get(tokenHash("session", rawToken)) as SessionRow | undefined;
  } catch {
    return null;
  }
  const now = Date.now();
  if (!row || row.revoked_at !== null || row.expires_at <= now) return null;
  if (!/^0x[a-f0-9]{40}$/.test(row.wallet_address)) return null;
  if (now - row.last_seen_at >= LAST_SEEN_WRITE_INTERVAL_MS) {
    try {
      getDb()
        .prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?")
        .run(now, tokenHash("session", rawToken));
    } catch {
      // Authentication remains valid if this non-security bookkeeping write fails.
    }
  }
  return {
    wallet: row.wallet_address,
    csrfHash: row.csrf_hash,
    authMethod: row.auth_method,
    expiresAt: row.expires_at,
  };
}

export function getSessionWallet(request: Request): string | null {
  return getSession(request)?.wallet ?? null;
}

export function verifySessionCsrf(request: Request): boolean {
  const session = getSession(request);
  if (!session) return false;
  const supplied = request.headers.get("x-sovereign-csrf");
  const cookie = parseCookies(request.headers.get("cookie")).get(CSRF_COOKIE_NAME);
  if (!supplied || !cookie || supplied !== cookie || supplied.length > 256) return false;
  const actual = Buffer.from(tokenHash("csrf", supplied), "hex");
  const expected = Buffer.from(session.csrfHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function revokeSession(request: Request): void {
  if (!process.env.SESSION_SECRET) return;
  const rawToken = sessionToken(request);
  if (!rawToken) return;
  try {
    getDb()
      .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?")
      .run(Date.now(), tokenHash("session", rawToken));
  } catch {
    // Clearing the browser cookie still prevents ordinary reuse on this client.
  }
}

export function appendClearedSessionCookies(headers: Headers): void {
  const common = `${secureAttribute()}; SameSite=Strict; Path=/; Max-Age=0`;
  headers.append("Set-Cookie", `${cookieName()}=; HttpOnly${common}`);
  if (cookieName() !== DEV_COOKIE_NAME) {
    headers.append("Set-Cookie", `${DEV_COOKIE_NAME}=; HttpOnly${common}`);
  }
  headers.append("Set-Cookie", `${CSRF_COOKIE_NAME}=;${common}`);
  if (CSRF_COOKIE_NAME !== "sov_csrf") {
    headers.append("Set-Cookie", `sov_csrf=;${common}`);
  }
}
