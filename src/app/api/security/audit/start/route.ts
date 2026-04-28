import { runMultiEngineAudit } from "@/lib/security/audit/orchestrator";
import {
  createAuditJob,
  emitAuditEvent,
  completeAuditJob,
  failAuditJob,
} from "@/lib/security/audit/jobs";
import { CHAIN_NAME_TO_ID } from "@/lib/security/etherscan";
import { enforceRateLimit } from "@/lib/rate-limit";

// Multi-engine audit takes 5-10 minutes; this route fires the job and returns
// the id. Client polls /api/security/audit/status?id=<jobId>.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 800;

function parseChain(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) && input > 0 ? input : null;
  const asNum = Number(input);
  if (Number.isFinite(asNum) && asNum > 0) return asNum;
  const match = Object.entries(CHAIN_NAME_TO_ID).find(
    ([name]) => name.toLowerCase() === input.toLowerCase()
  );
  return match ? match[1] : null;
}

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export async function POST(request: Request) {
  // Multi-engine audits are 5-10min each and run Slither/Aderyn/Mythril
  // plus 25× triple-AI explanations. Tight per-caller cap.
  const limited = enforceRateLimit(request, "audit", { max: 3, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  let body: { address?: string; chain?: string | number; skipMythril?: boolean; skipAi?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const address = body.address;
  if (!address || !isValidAddress(address)) {
    return Response.json(
      { error: "Invalid contract address. Expected 0x-prefixed 40-hex-char string." },
      { status: 400 }
    );
  }

  const chainId = parseChain(body.chain ?? 1);
  if (!chainId) {
    return Response.json({ error: `Unsupported chain: ${body.chain}` }, { status: 400 });
  }

  const job = createAuditJob(address, chainId);

  // Fire and forget — orchestrator resolves long after the response ships.
  void runMultiEngineAudit(address, chainId, {
    skipMythril: body.skipMythril,
    skipAiExplanation: body.skipAi,
    onProgress: (event) => emitAuditEvent(job.id, event),
  })
    .then((report) => completeAuditJob(job.id, report))
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Audit job ${job.id} failed:`, err);
      failAuditJob(job.id, message);
    });

  return Response.json({
    jobId: job.id,
    status: job.status,
    contractAddress: address,
    chainId,
    progress: 0,
    message: job.events[0]?.message ?? "Starting contract review...",
  });
}
