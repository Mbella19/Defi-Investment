import { randomUUID } from "crypto";
import {
  createJob,
  getJob,
  getJobByIdempotency,
  getStrategyJobPayload,
  publicView,
} from "@/lib/strategy-jobs";
import { kickStrategyWorker } from "@/lib/strategy-worker";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireWallet } from "@/lib/auth/guard";
import { getPlan } from "@/lib/plans/access";
import {
  releaseUsage,
  reserveMonthlyUsage,
  strategyGenerationsThisMonth,
} from "@/lib/plans/usage";
import { isRiskAppetite } from "@/lib/strategy-validate";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";
import type { StrategyCriteria } from "@/types/strategy";

export const maxDuration = 800;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

const RISK_PRESETS: Record<NonNullable<StrategyCriteria["riskAppetite"]>, [number, number]> = {
  low: [3, 10],
  medium: [6, 18],
  high: [12, 40],
};

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "strategy", { max: 5, windowMs: 60 * 60 * 1000 });
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
  const input = parsed as Record<string, unknown>;
  // Persist and forward only the documented request contract. This prevents
  // arbitrary client fields from being retained in job payloads or entering
  // downstream model context.
  const criteria = {
    budget: input.budget,
    riskAppetite: input.riskAppetite,
    targetApyMin: input.targetApyMin,
    targetApyMax: input.targetApyMax,
    assetType: input.assetType,
  } as StrategyCriteria;

  // Strict types before the pipeline: a string budget survived the old
  // truthiness check via coercion, and an unknown riskAppetite silently
  // behaved as "high" downstream (skipping every stability gate).
  if (
    typeof criteria.budget !== "number" ||
    !Number.isFinite(criteria.budget) ||
    criteria.budget <= 0 ||
    criteria.budget > 10_000_000
  ) {
    return Response.json(
      { error: "Budget must be a number between $1 and $10,000,000" },
      { status: 400 },
    );
  }
  if (criteria.riskAppetite !== undefined && !isRiskAppetite(criteria.riskAppetite)) {
    return Response.json(
      { error: "riskAppetite must be low, medium, or high" },
      { status: 400 },
    );
  }
  if (
    criteria.assetType !== undefined &&
    criteria.assetType !== "all" &&
    criteria.assetType !== "stablecoins"
  ) {
    return Response.json(
      { error: "assetType must be 'all' or 'stablecoins'" },
      { status: 400 },
    );
  }
  criteria.riskAppetite ??= "medium";
  criteria.assetType ??= "all";

  const plan = getPlan(auth.wallet);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey.trim())) {
    return Response.json({ error: "Invalid Idempotency-Key header" }, { status: 400 });
  }

  // Tier-aware criteria coercion must happen before idempotency comparison so
  // the key binds to the exact server-authorized operation, not raw input the
  // caller was not entitled to use.
  if (!plan.capabilities.riskBandSelection) {
    criteria.riskAppetite = "medium";
  }
  if (!plan.capabilities.stablecoinToggle) {
    criteria.assetType = "all";
  }
  if (!plan.capabilities.customApyMode) {
    const preset = RISK_PRESETS[criteria.riskAppetite ?? "medium"] ?? RISK_PRESETS.medium;
    criteria.targetApyMin = preset[0];
    criteria.targetApyMax = preset[1];
  }

  if (
    typeof criteria.targetApyMin !== "number" ||
    !Number.isFinite(criteria.targetApyMin) ||
    criteria.targetApyMin < 0 ||
    criteria.targetApyMin > 1_000 ||
    typeof criteria.targetApyMax !== "number" ||
    !Number.isFinite(criteria.targetApyMax) ||
    criteria.targetApyMax <= 0 ||
    criteria.targetApyMax > 1_000 ||
    criteria.targetApyMin >= criteria.targetApyMax
  ) {
    return Response.json({ error: "Invalid APY range" }, { status: 400 });
  }

  const existing = getJobByIdempotency(auth.wallet, idempotencyKey);
  if (existing) {
    const prior = getStrategyJobPayload(existing.id);
    if (
      !prior ||
      prior.mode !== plan.capabilities.strategistMode ||
      prior.criteria.budget !== criteria.budget ||
      prior.criteria.riskAppetite !== criteria.riskAppetite ||
      prior.criteria.targetApyMin !== criteria.targetApyMin ||
      prior.criteria.targetApyMax !== criteria.targetApyMax ||
      (prior.criteria.assetType ?? "all") !== (criteria.assetType ?? "all")
    ) {
      return Response.json(
        { error: "Idempotency key was already used for a different strategy request" },
        { status: 409 },
      );
    }
    kickStrategyWorker();
    return Response.json(
      {
        ...publicView(existing),
        jobId: existing.id,
        tier: plan.tier,
        used: strategyGenerationsThisMonth(auth.wallet),
        limit: plan.capabilities.monthlyStrategies,
        idempotentReplay: true,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const usageId = randomUUID();
  const reservation = reserveMonthlyUsage({
    wallet: auth.wallet,
    kind: "strategy",
    id: usageId,
    limit: plan.capabilities.monthlyStrategies,
  });
  if (!reservation.ok) {
    return Response.json(
      {
        error: "Monthly strategy limit reached",
        tier: plan.tier,
        used: reservation.used,
        limit: plan.capabilities.monthlyStrategies,
        upgradePath: plan.tier === "free" ? "pro" : plan.tier === "pro" ? "ultra" : null,
      },
      { status: 402 },
    );
  }

  let job;
  try {
    job = createJob(
      auth.wallet,
      { criteria, mode: plan.capabilities.strategistMode },
      idempotencyKey,
      usageId,
    );
    if (job.id !== usageId) {
      // Another request won the idempotency race after our initial lookup.
      // Its job owns the charge; release this request's provisional usage.
      releaseUsage(usageId);
    }
  } catch (error) {
    releaseUsage(usageId);
    throw error;
  }
  kickStrategyWorker();

  return Response.json({
    jobId: job.id,
    status: job.status,
    progress: 0,
    message: job.events[0]?.message ?? "Preparing allocation workflow...",
    tier: plan.tier,
    used: job.id === usageId
      ? reservation.used
      : strategyGenerationsThisMonth(auth.wallet),
    limit: plan.capabilities.monthlyStrategies,
  });
}

export async function GET(request: Request) {
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  kickStrategyWorker();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
    return Response.json({ error: "Missing job id" }, { status: 400 });
  }
  const job = getJob(id);
  // 404 (not 403) for someone else's job — don't leak existence.
  if (!job || job.wallet !== auth.wallet.toLowerCase()) {
    return Response.json({ error: "Job not found or expired" }, { status: 404 });
  }
  return Response.json(publicView(job));
}
