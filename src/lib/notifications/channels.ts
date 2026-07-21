import "server-only";
import { getDb } from "@/lib/db";
import { log } from "@/lib/log";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "crypto";

export type ChannelKind = "email" | "telegram" | "slack" | "discord";

export interface UserChannel {
  walletAddress: string;
  channel: ChannelKind;
  endpoint: string;
  verified: boolean;
  enabled: boolean;
  createdAt: string;
  verifiedAt: string | null;
}

export interface PendingVerification {
  walletAddress: string;
  channel: ChannelKind;
  endpoint: string;
  attempts: number;
  expiresAt: string;
  createdAt: string;
}

const VERIFICATION_TTL_MIN = 30;
const MAX_ATTEMPTS = 5;
const KEY_VERSION = 1;
const ENCRYPTED_SENTINEL = "encrypted:v1";

interface ChannelRow {
  wallet_address: string;
  channel: string;
  endpoint: string;
  verified: number;
  enabled: number;
  created_at: string;
  verified_at: string | null;
  endpoint_ciphertext: string | null;
  endpoint_iv: string | null;
  endpoint_tag: string | null;
  key_version: number | null;
}

interface VerifRow {
  wallet_address: string;
  channel: string;
  endpoint: string;
  code: string;
  code_hash: string | null;
  attempts: number;
  expires_at: string;
  created_at: string;
  endpoint_ciphertext: string | null;
  endpoint_iv: string | null;
  endpoint_tag: string | null;
  key_version: number | null;
}

interface EncryptedValue {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

function encryptionKey(): Buffer {
  const material = process.env.CHANNEL_ENCRYPTION_KEY?.trim() || process.env.SESSION_SECRET?.trim();
  if (!material || material.length < 32) {
    throw new Error(
      "CHANNEL_ENCRYPTION_KEY or a SESSION_SECRET of at least 32 characters is required",
    );
  }
  return createHash("sha256")
    .update(`sovereign:notification-endpoints:v${KEY_VERSION}\u0000${material}`)
    .digest();
}

function associatedData(
  scope: "channel" | "verification",
  wallet: string,
  channel: ChannelKind,
): Buffer {
  return Buffer.from(`${scope}:${wallet.toLowerCase()}:${channel}`, "utf8");
}

function encryptEndpoint(
  endpoint: string,
  scope: "channel" | "verification",
  wallet: string,
  channel: ChannelKind,
): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(associatedData(scope, wallet, channel));
  const ciphertext = Buffer.concat([cipher.update(endpoint, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    keyVersion: KEY_VERSION,
  };
}

function decryptEndpoint(
  row: Pick<
    ChannelRow | VerifRow,
    | "wallet_address"
    | "channel"
    | "endpoint"
    | "endpoint_ciphertext"
    | "endpoint_iv"
    | "endpoint_tag"
    | "key_version"
  >,
  scope: "channel" | "verification",
): string {
  if (
    row.endpoint_ciphertext &&
    row.endpoint_iv &&
    row.endpoint_tag &&
    row.key_version === KEY_VERSION
  ) {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(row.endpoint_iv, "base64url"),
    );
    decipher.setAAD(
      associatedData(scope, row.wallet_address, row.channel as ChannelKind),
    );
    decipher.setAuthTag(Buffer.from(row.endpoint_tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(row.endpoint_ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
  if (row.endpoint && row.endpoint !== ENCRYPTED_SENTINEL) return row.endpoint;
  throw new Error("Notification endpoint cannot be decrypted");
}

function verificationCodeHash(channel: ChannelKind, code: string): string {
  return createHmac("sha256", encryptionKey())
    .update(`verification:${channel}:${code.trim()}`)
    .digest("hex");
}

function safeEqualHex(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function rowToChannel(row: ChannelRow): UserChannel {
  return {
    walletAddress: row.wallet_address,
    channel: row.channel as ChannelKind,
    endpoint: decryptEndpoint(row, "channel"),
    verified: row.verified === 1,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    verifiedAt: row.verified_at,
  };
}

function rowToVerification(row: VerifRow): PendingVerification {
  return {
    walletAddress: row.wallet_address,
    channel: row.channel as ChannelKind,
    endpoint: decryptEndpoint(row, "verification"),
    attempts: row.attempts,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function migrateLegacyChannel(row: ChannelRow): void {
  if (row.endpoint_ciphertext || !row.endpoint || row.endpoint === ENCRYPTED_SENTINEL) return;
  const encrypted = encryptEndpoint(
    row.endpoint,
    "channel",
    row.wallet_address,
    row.channel as ChannelKind,
  );
  getDb()
    .prepare(
      `UPDATE user_channels
       SET endpoint = ?, endpoint_ciphertext = ?, endpoint_iv = ?, endpoint_tag = ?, key_version = ?
       WHERE wallet_address = ? AND channel = ? AND endpoint = ?`,
    )
    .run(
      ENCRYPTED_SENTINEL,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      encrypted.keyVersion,
      row.wallet_address,
      row.channel,
      row.endpoint,
    );
}

function migrateLegacyVerification(row: VerifRow): void {
  if (
    row.endpoint_ciphertext ||
    !row.endpoint ||
    row.endpoint === ENCRYPTED_SENTINEL ||
    !row.code ||
    row.code === ENCRYPTED_SENTINEL
  ) {
    return;
  }
  const channel = row.channel as ChannelKind;
  const encrypted = encryptEndpoint(
    row.endpoint,
    "verification",
    row.wallet_address,
    channel,
  );
  getDb()
    .prepare(
      `UPDATE channel_verifications
       SET endpoint = ?, code = ?, endpoint_ciphertext = ?, endpoint_iv = ?,
           endpoint_tag = ?, key_version = ?, code_hash = ?
       WHERE wallet_address = ? AND channel = ? AND code = ?`,
    )
    .run(
      ENCRYPTED_SENTINEL,
      ENCRYPTED_SENTINEL,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      encrypted.keyVersion,
      verificationCodeHash(channel, row.code),
      row.wallet_address,
      row.channel,
      row.code,
    );
}

function safeChannel(row: ChannelRow): UserChannel | null {
  try {
    const channel = rowToChannel(row);
    migrateLegacyChannel(row);
    return channel;
  } catch (error) {
    log.warn("notification-channels", "could not decrypt configured endpoint", {
      channel: row.channel,
      wallet: row.wallet_address,
      error,
    });
    return null;
  }
}

export function listUserChannels(wallet: string): UserChannel[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM user_channels WHERE wallet_address = ?")
    .all(wallet.toLowerCase()) as ChannelRow[];
  return rows.flatMap((row) => {
    const channel = safeChannel(row);
    return channel ? [channel] : [];
  });
}

/** Channels that are verified, enabled, and ready to receive alerts. */
export function listDeliverableChannels(wallet: string): UserChannel[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM user_channels WHERE wallet_address = ? AND verified = 1 AND enabled = 1",
    )
    .all(wallet.toLowerCase()) as ChannelRow[];
  return rows.flatMap((row) => {
    const channel = safeChannel(row);
    return channel ? [channel] : [];
  });
}

export function redactChannelEndpoint(channel: ChannelKind, endpoint: string): string {
  if (channel === "email") {
    const [local, domain] = endpoint.split("@");
    if (!local || !domain) return "Configured email";
    return `${local.slice(0, Math.min(2, local.length))}${local.length > 2 ? "•••" : ""}@${domain}`;
  }
  if (channel === "telegram") return `Telegram chat ending ${endpoint.slice(-4)}`;
  return `${channel === "slack" ? "Slack" : "Discord"} webhook •••${endpoint.slice(-6)}`;
}

export function upsertChannel(params: {
  wallet: string;
  channel: ChannelKind;
  endpoint: string;
  verified: boolean;
}): void {
  const db = getDb();
  const wallet = params.wallet.toLowerCase();
  const verifiedAt = params.verified ? new Date().toISOString() : null;
  const encrypted = encryptEndpoint(params.endpoint, "channel", wallet, params.channel);
  db.prepare(
    `INSERT INTO user_channels
       (wallet_address, channel, endpoint, verified, enabled, verified_at,
        endpoint_ciphertext, endpoint_iv, endpoint_tag, key_version)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
     ON CONFLICT(wallet_address, channel) DO UPDATE SET
       endpoint = excluded.endpoint,
       endpoint_ciphertext = excluded.endpoint_ciphertext,
       endpoint_iv = excluded.endpoint_iv,
       endpoint_tag = excluded.endpoint_tag,
       key_version = excluded.key_version,
       verified = excluded.verified,
       enabled = 1,
       verified_at = excluded.verified_at`,
  ).run(
    wallet,
    params.channel,
    ENCRYPTED_SENTINEL,
    params.verified ? 1 : 0,
    verifiedAt,
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.tag,
    encrypted.keyVersion,
  );
}

export function deleteChannel(wallet: string, channel: ChannelKind): void {
  const db = getDb();
  db.prepare(
    "DELETE FROM user_channels WHERE wallet_address = ? AND channel = ?",
  ).run(wallet.toLowerCase(), channel);
  db.prepare(
    "DELETE FROM channel_verifications WHERE wallet_address = ? AND channel = ?",
  ).run(wallet.toLowerCase(), channel);
}

export function setChannelEnabled(
  wallet: string,
  channel: ChannelKind,
  enabled: boolean,
): void {
  const db = getDb();
  db.prepare(
    "UPDATE user_channels SET enabled = ? WHERE wallet_address = ? AND channel = ?",
  ).run(enabled ? 1 : 0, wallet.toLowerCase(), channel);
}

export function generateNumericCode(digits = 6): string {
  if (!Number.isSafeInteger(digits) || digits < 4 || digits > 9) {
    throw new Error("Verification-code length must be between 4 and 9 digits");
  }
  const max = 10 ** digits;
  const n = randomInt(0, max);
  return n.toString().padStart(digits, "0");
}

export function generateAlphanumericToken(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}

export function startVerification(params: {
  wallet: string;
  channel: ChannelKind;
  endpoint: string;
  code: string;
}): void {
  const db = getDb();
  const wallet = params.wallet.toLowerCase();
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TTL_MIN * 60 * 1000,
  ).toISOString();
  const encrypted = encryptEndpoint(
    params.endpoint,
    "verification",
    wallet,
    params.channel,
  );
  db.prepare(
    `INSERT INTO channel_verifications
       (wallet_address, channel, endpoint, code, attempts, expires_at,
        endpoint_ciphertext, endpoint_iv, endpoint_tag, key_version, code_hash)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(wallet_address, channel) DO UPDATE SET
       endpoint = excluded.endpoint,
       code = excluded.code,
       endpoint_ciphertext = excluded.endpoint_ciphertext,
       endpoint_iv = excluded.endpoint_iv,
       endpoint_tag = excluded.endpoint_tag,
       key_version = excluded.key_version,
       code_hash = excluded.code_hash,
       attempts = 0,
       expires_at = excluded.expires_at,
       created_at = datetime('now')`,
  ).run(
    wallet,
    params.channel,
    ENCRYPTED_SENTINEL,
    ENCRYPTED_SENTINEL,
    expiresAt,
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.tag,
    encrypted.keyVersion,
    verificationCodeHash(params.channel, params.code),
  );
}

export function getVerification(
  wallet: string,
  channel: ChannelKind,
): PendingVerification | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM channel_verifications WHERE wallet_address = ? AND channel = ?",
    )
    .get(wallet.toLowerCase(), channel) as VerifRow | undefined;
  if (!row) return null;
  const expiry = Date.parse(row.expires_at);
  if (!Number.isFinite(expiry) || expiry <= Date.now() || row.attempts >= MAX_ATTEMPTS) {
    clearVerification(row.wallet_address, row.channel as ChannelKind);
    return null;
  }
  try {
    const pending = rowToVerification(row);
    migrateLegacyVerification(row);
    return pending;
  } catch {
    return null;
  }
}

/**
 * Look up a pending verification by channel + code (used for telegram /start
 * webhook matching, where the bot only knows the token, not the wallet).
 */
export function findVerificationByCode(
  channel: ChannelKind,
  code: string,
): PendingVerification | null {
  const db = getDb();
  const hash = verificationCodeHash(channel, code);
  const row = db
    .prepare(
      `SELECT * FROM channel_verifications
       WHERE channel = ? AND (code_hash = ? OR (code_hash IS NULL AND code = ?))`,
    )
    .get(channel, hash, code) as VerifRow | undefined;
  if (!row) return null;
  const expiry = Date.parse(row.expires_at);
  if (!Number.isFinite(expiry) || expiry <= Date.now() || row.attempts >= MAX_ATTEMPTS) {
    clearVerification(row.wallet_address, row.channel as ChannelKind);
    return null;
  }
  try {
    const pending = rowToVerification(row);
    migrateLegacyVerification(row);
    return pending;
  } catch {
    return null;
  }
}

/**
 * Verify a code for a channel. Returns true on match, false on
 * mismatch/expired/exhausted-attempts. On match, the verification row is
 * cleared. On mismatch, the attempts counter is bumped.
 */
export function consumeVerification(
  wallet: string,
  channel: ChannelKind,
  code: string,
): { ok: true; endpoint: string } | { ok: false; reason: string } {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM channel_verifications WHERE wallet_address = ? AND channel = ?",
    )
    .get(wallet.toLowerCase(), channel) as VerifRow | undefined;
  if (!row) return { ok: false, reason: "No pending verification — start over." };
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    db.prepare(
      "DELETE FROM channel_verifications WHERE wallet_address = ? AND channel = ?",
    ).run(wallet.toLowerCase(), channel);
    return { ok: false, reason: "Verification expired — request a fresh code." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    db.prepare(
      "DELETE FROM channel_verifications WHERE wallet_address = ? AND channel = ?",
    ).run(wallet.toLowerCase(), channel);
    return { ok: false, reason: "Too many attempts — request a fresh code." };
  }
  const suppliedHash = verificationCodeHash(channel, code);
  const matches = row.code_hash
    ? safeEqualHex(suppliedHash, row.code_hash)
    : timingSafeEqual(
        createHash("sha256").update(code.trim()).digest(),
        createHash("sha256").update(row.code.trim()).digest(),
      );
  if (!matches) {
    db.prepare(
      "UPDATE channel_verifications SET attempts = attempts + 1 WHERE wallet_address = ? AND channel = ?",
    ).run(wallet.toLowerCase(), channel);
    return { ok: false, reason: "Code does not match." };
  }
  db.prepare(
    "DELETE FROM channel_verifications WHERE wallet_address = ? AND channel = ?",
  ).run(wallet.toLowerCase(), channel);
  try {
    return { ok: true, endpoint: decryptEndpoint(row, "verification") };
  } catch {
    return { ok: false, reason: "Verification data is unavailable — start over." };
  }
}

/**
 * Clear the pending verification (used after the telegram bot matches a
 * /start token and we've already upserted the channel as verified).
 */
export function clearVerification(wallet: string, channel: ChannelKind): void {
  const db = getDb();
  db.prepare(
    "DELETE FROM channel_verifications WHERE wallet_address = ? AND channel = ?",
  ).run(wallet.toLowerCase(), channel);
}
