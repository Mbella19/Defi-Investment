import "server-only";
import { getDb } from "@/lib/db";
import { randomBytes } from "crypto";

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
  code: string;
  attempts: number;
  expiresAt: string;
  createdAt: string;
}

const VERIFICATION_TTL_MIN = 30;
const MAX_ATTEMPTS = 5;

interface ChannelRow {
  wallet_address: string;
  channel: string;
  endpoint: string;
  verified: number;
  enabled: number;
  created_at: string;
  verified_at: string | null;
}

interface VerifRow {
  wallet_address: string;
  channel: string;
  endpoint: string;
  code: string;
  attempts: number;
  expires_at: string;
  created_at: string;
}

function rowToChannel(row: ChannelRow): UserChannel {
  return {
    walletAddress: row.wallet_address,
    channel: row.channel as ChannelKind,
    endpoint: row.endpoint,
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
    endpoint: row.endpoint,
    code: row.code,
    attempts: row.attempts,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function listUserChannels(wallet: string): UserChannel[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM user_channels WHERE wallet_address = ?")
    .all(wallet.toLowerCase()) as ChannelRow[];
  return rows.map(rowToChannel);
}

/** Channels that are verified, enabled, and ready to receive alerts. */
export function listDeliverableChannels(wallet: string): UserChannel[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM user_channels WHERE wallet_address = ? AND verified = 1 AND enabled = 1",
    )
    .all(wallet.toLowerCase()) as ChannelRow[];
  return rows.map(rowToChannel);
}

export function upsertChannel(params: {
  wallet: string;
  channel: ChannelKind;
  endpoint: string;
  verified: boolean;
}): void {
  const db = getDb();
  const verifiedAt = params.verified ? new Date().toISOString() : null;
  db.prepare(
    `INSERT INTO user_channels (wallet_address, channel, endpoint, verified, enabled, verified_at)
     VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(wallet_address, channel) DO UPDATE SET
       endpoint = excluded.endpoint,
       verified = excluded.verified,
       enabled = 1,
       verified_at = excluded.verified_at`,
  ).run(
    params.wallet.toLowerCase(),
    params.channel,
    params.endpoint,
    params.verified ? 1 : 0,
    verifiedAt,
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
  const max = 10 ** digits;
  const n = randomBytes(4).readUInt32BE(0) % max;
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
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TTL_MIN * 60 * 1000,
  ).toISOString();
  db.prepare(
    `INSERT INTO channel_verifications (wallet_address, channel, endpoint, code, attempts, expires_at)
     VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT(wallet_address, channel) DO UPDATE SET
       endpoint = excluded.endpoint,
       code = excluded.code,
       attempts = 0,
       expires_at = excluded.expires_at,
       created_at = datetime('now')`,
  ).run(
    params.wallet.toLowerCase(),
    params.channel,
    params.endpoint,
    params.code,
    expiresAt,
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
  return rowToVerification(row);
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
  const row = db
    .prepare(
      "SELECT * FROM channel_verifications WHERE channel = ? AND code = ?",
    )
    .get(channel, code) as VerifRow | undefined;
  if (!row) return null;
  return rowToVerification(row);
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
  if (new Date(row.expires_at).getTime() < Date.now()) {
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
  if (row.code.trim() !== code.trim()) {
    db.prepare(
      "UPDATE channel_verifications SET attempts = attempts + 1 WHERE wallet_address = ? AND channel = ?",
    ).run(wallet.toLowerCase(), channel);
    return { ok: false, reason: "Code does not match." };
  }
  db.prepare(
    "DELETE FROM channel_verifications WHERE wallet_address = ? AND channel = ?",
  ).run(wallet.toLowerCase(), channel);
  return { ok: true, endpoint: row.endpoint };
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
