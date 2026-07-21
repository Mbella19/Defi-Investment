import { createHash } from "crypto";
import { getDb } from "@/lib/db";

const NONCE_TTL_MS = 10 * 60 * 1000;
const MAX_ACTIVE_NONCES = 10_000;

function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

function prune(now: number): void {
  const db = getDb();
  db.prepare("DELETE FROM auth_nonces WHERE expires_at <= ? OR consumed_at IS NOT NULL").run(now);
  const row = db.prepare("SELECT COUNT(*) AS count FROM auth_nonces").get() as { count: number };
  if (row.count > MAX_ACTIVE_NONCES) {
    db.prepare(
      `DELETE FROM auth_nonces WHERE nonce_hash IN (
         SELECT nonce_hash FROM auth_nonces ORDER BY issued_at ASC LIMIT ?
       )`,
    ).run(row.count - MAX_ACTIVE_NONCES);
  }
}

export function rememberNonce(nonce: string): void {
  const now = Date.now();
  const db = getDb();
  db.transaction(() => {
    prune(now);
    db.prepare(
      `INSERT OR REPLACE INTO auth_nonces
       (nonce_hash, issued_at, expires_at, consumed_at) VALUES (?, ?, ?, NULL)`,
    ).run(hashNonce(nonce), now, now + NONCE_TTL_MS);
  })();
}

/** Atomically consume a live nonce. Invalid, expired, and replayed values fail. */
export function consumeNonce(nonce: string): boolean {
  const now = Date.now();
  const result = getDb()
    .prepare(
      `UPDATE auth_nonces SET consumed_at = ?
       WHERE nonce_hash = ? AND consumed_at IS NULL AND expires_at > ?`,
    )
    .run(now, hashNonce(nonce), now);
  return result.changes === 1;
}
