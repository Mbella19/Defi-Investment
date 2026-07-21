import { randomUUID } from "crypto";
import { isAddress } from "viem";
import {
  createAuditJob,
  getAuditJobByIdempotency,
  publicAuditView,
} from "@/lib/security/audit/jobs";
import { kickAuditWorker } from "@/lib/security/audit/worker";
import { CHAIN_ID_TO_NAME, CHAIN_NAME_TO_ID } from "@/lib/security/etherscan";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireWallet } from "@/lib/auth/guard";
import { getPlan } from "@/lib/plans/access";
import {
  auditsThisMonth,
  releaseUsage,
  reserveMonthlyUsage,
} from "@/lib/plans/usage";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 800;

function parseChain(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return CHAIN_ID_TO_NAME[input] ? input : null;
  const asNumber = Number(input);
  if (Number.isSafeInteger(asNumber) && CHAIN_ID_TO_NAME[asNumber]) return asNumber;
  const match = Object.entries(CHAIN_NAME_TO_ID).find(
    ([name]) => name.toLowerCase() === input.toLowerCase(),
  );
  return match ? match[1] : null;
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "audit", {
    max: 3,
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
  const body = parsed as { address?: unknown; chain?: unknown };

  const address = typeof body.address === "string"
    ? body.address.trim().toLowerCase()
    : null;
  if (!address || !isAddress(address)) {
    return Response.json(
      { error: "Invalid contract address. Expected a 20-byte EVM address." },
      { status: 400 },
    );
  }
  const chainInput = typeof body.chain === "string" || typeof body.chain === "number"
    ? body.chain
    : 1;
  const chainId = parseChain(chainInput);
  if (!chainId) {
    return Response.json({ error: "Unsupported chain" }, { status: 400 });
  }

  const plan = getPlan(auth.wallet);
  const cap = plan.capabilities.monthlyAudits;
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey.trim())) {
    return Response.json({ error: "Invalid Idempotency-Key header" }, { status: 400 });
  }
  const existing = getAuditJobByIdempotency(auth.wallet, idempotencyKey);
  if (existing) {
    if (existing.contractAddress !== address || existing.chainId !== chainId) {
      return Response.json(
        { error: "Idempotency key was already used for a different audit request" },
        { status: 409 },
      );
    }
    kickAuditWorker();
    return Response.json(
      {
        ...publicAuditView(existing),
        jobId: existing.id,
        tier: plan.tier,
        used: auditsThisMonth(auth.wallet),
        limit: cap,
        idempotentReplay: true,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const jobId = randomUUID();
  const reservation = reserveMonthlyUsage({
    wallet: auth.wallet,
    kind: "audit",
    id: jobId,
    limit: cap,
  });
  if (!reservation.ok) {
    return Response.json(
      {
        error: "Monthly audit limit reached",
        tier: plan.tier,
        used: reservation.used,
        limit: cap,
        upgradePath: plan.tier === "free" ? "pro" : plan.tier === "pro" ? "ultra" : null,
      },
      { status: 402 },
    );
  }

  let job;
  try {
    job = createAuditJob(auth.wallet, address, chainId, idempotencyKey, jobId);
    if (job.id !== jobId) {
      // Another identical request won the unique idempotency insert. Only its
      // durable job should consume the wallet's monthly allowance.
      releaseUsage(jobId);
    }
  } catch (error) {
    releaseUsage(jobId);
    throw error;
  }
  kickAuditWorker();

  return Response.json(
    {
      jobId: job.id,
      status: job.status,
      contractAddress: address,
      chainId,
      progress: 0,
      message: job.events[0]?.message ?? "Starting contract review...",
      tier: plan.tier,
      used: job.id === jobId ? reservation.used : auditsThisMonth(auth.wallet),
      limit: cap,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
