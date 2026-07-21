import { createHash, createHmac, randomBytes } from "crypto";
import { requireWallet } from "@/lib/auth/guard";
import { getAuditJob } from "@/lib/security/audit/jobs";
import { getDb } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function shareSecret(): string {
  const secret = process.env.AUDIT_SHARE_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("AUDIT_SHARE_SECRET or SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

function tokenFor(jobId: string, wallet: string, nonce: string): string {
  return createHmac("sha256", shareSecret())
    .update(`audit-share:v1:${jobId}:${wallet}:${nonce}`)
    .digest("base64url");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create (or return the existing) public share token for a finished audit.
 * The public page at /report/[token] renders the persisted report with no
 * auth — the token is the only secret. Sharing pins the audit_jobs row so
 * the normal retention prune skips it.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "audit.share", { max: 30, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;

  let parsed: unknown;
  try {
    parsed = await readJsonBody(request);
  } catch (error) {
    return jsonBodyErrorResponse(error);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const body = parsed as { jobId?: unknown };
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(jobId)) {
    return Response.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = getAuditJob(jobId);
  if (!job || job.wallet !== auth.wallet.toLowerCase()) {
    return Response.json({ error: "Review job not found" }, { status: 404 });
  }
  if (job.status !== "done" || !job.result) {
    return Response.json({ error: "Only finished reviews can be shared" }, { status: 400 });
  }

  const db = getDb();
  const wallet = auth.wallet.toLowerCase();
  const share = db.transaction(() => {
    // Read and create under the same write transaction. Two concurrent share
    // requests must return the same live capability rather than letting the
    // second request revoke the link returned to the first.
    const existing = db
      .prepare(
        `SELECT token_nonce, expires_at FROM audit_shares
         WHERE job_id = ? AND wallet_address = ? AND revoked_at IS NULL
           AND datetime(expires_at) > datetime('now') AND token_nonce IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(jobId, wallet) as { token_nonce: string; expires_at: string } | undefined;
    if (existing) {
      const token = tokenFor(jobId, wallet, existing.token_nonce);
      return { token, expiresAt: existing.expires_at };
    }

    const nonce = randomBytes(16).toString("base64url");
    const token = tokenFor(jobId, wallet, nonce);
    const hash = tokenHash(token);
    const expiresAt = new Date(Date.now() + SHARE_TTL_MS).toISOString();
    db.prepare(
      `UPDATE audit_shares SET revoked_at = datetime('now')
       WHERE job_id = ? AND wallet_address = ? AND revoked_at IS NULL`,
    ).run(jobId, wallet);
    db.prepare(
      `INSERT INTO audit_shares
         (token, token_hash, token_nonce, job_id, wallet_address, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(hash, hash, nonce, jobId, wallet, expiresAt);
    return { token, expiresAt };
  })();

  return Response.json({
    token: share.token,
    path: `/report/${share.token}`,
    expiresAt: share.expiresAt,
  });
}

export async function DELETE(request: Request) {
  const limited = enforceRateLimit(request, "audit.share.revoke", {
    max: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;

  let parsed: unknown;
  try {
    parsed = await readJsonBody(request);
  } catch (error) {
    return jsonBodyErrorResponse(error);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const body = parsed as { jobId?: unknown };
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(jobId)) {
    return Response.json({ error: "jobId is required" }, { status: 400 });
  }
  const result = getDb()
    .prepare(
      `UPDATE audit_shares SET revoked_at = datetime('now')
       WHERE job_id = ? AND wallet_address = ? AND revoked_at IS NULL`,
    )
    .run(jobId, auth.wallet.toLowerCase());
  return Response.json({ ok: true, revoked: result.changes });
}
