import { generateStrategy } from "@/lib/strategist";
import {
  createJob,
  emitEvent,
  completeJob,
  failJob,
  getJob,
  publicView,
} from "@/lib/strategy-jobs";
import type { StrategyCriteria } from "@/types/strategy";

// Pipeline runs >> 60s; the route just kicks off the job and returns the id.
// Progress is polled via GET /api/strategy?id=<jobId>.
export const maxDuration = 800;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  let criteria: StrategyCriteria;
  try {
    criteria = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!criteria.budget || criteria.budget <= 0) {
    return Response.json({ error: "Invalid budget" }, { status: 400 });
  }
  if (
    !criteria.targetApyMin ||
    !criteria.targetApyMax ||
    criteria.targetApyMin >= criteria.targetApyMax
  ) {
    return Response.json({ error: "Invalid APY range" }, { status: 400 });
  }

  const job = createJob();

  // Fire and forget — generateStrategy resolves long after the HTTP response
  // has shipped. The unhandled-rejection guard funnels every failure into the
  // job store so the poll endpoint can surface it.
  void generateStrategy(criteria, {
    onProgress: (event) => emitEvent(job.id, event),
  })
    .then((result) => completeJob(job.id, result))
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Strategy job ${job.id} failed:`, err);
      failJob(job.id, message);
    });

  return Response.json({
    jobId: job.id,
    status: job.status,
    progress: 0,
    message: job.events[0]?.message ?? "Initializing strategy pipeline…",
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing job id" }, { status: 400 });
  }
  const job = getJob(id);
  if (!job) {
    return Response.json({ error: "Job not found or expired" }, { status: 404 });
  }
  return Response.json(publicView(job));
}
