import { getAuditJob, publicAuditView } from "@/lib/security/audit/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing job id" }, { status: 400 });
  }
  const job = getAuditJob(id);
  if (!job) {
    return Response.json({ error: "Audit job not found or expired" }, { status: 404 });
  }
  return Response.json(publicAuditView(job));
}
