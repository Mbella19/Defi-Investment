import { getAuditJob, publicAuditView } from "@/lib/security/audit/jobs";
import { requireWallet } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing job id" }, { status: 400 });
  }
  const job = getAuditJob(id);
  // 404 (not 403) for someone else's job — don't leak existence.
  if (!job || job.wallet !== auth.wallet.toLowerCase()) {
    return Response.json({ error: "Review job not found or expired" }, { status: 404 });
  }
  return Response.json(publicAuditView(job));
}
