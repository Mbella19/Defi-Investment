import { randomBytes } from "crypto";
import { requireWallet } from "@/lib/auth/guard";
import { getAuditJob } from "@/lib/security/audit/jobs";
import { getDb } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let body: { jobId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const jobId = typeof body.jobId === "string" ? body.jobId : null;
  if (!jobId) {
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
  const existing = db
    .prepare("SELECT token FROM audit_shares WHERE job_id = ? AND wallet_address = ?")
    .get(jobId, auth.wallet.toLowerCase()) as { token: string } | undefined;
  if (existing) {
    return Response.json({ token: existing.token, path: `/report/${existing.token}` });
  }

  const token = randomBytes(16).toString("base64url");
  db.prepare(
    "INSERT INTO audit_shares (token, job_id, wallet_address) VALUES (?, ?, ?)",
  ).run(token, jobId, auth.wallet.toLowerCase());

  return Response.json({ token, path: `/report/${token}` });
}
