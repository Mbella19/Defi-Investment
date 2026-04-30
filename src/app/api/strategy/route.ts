import { generateStrategy } from "@/lib/strategist";
import {
  createJob,
  emitEvent,
  completeJob,
  failJob,
  getJob,
  publicView,
} from "@/lib/strategy-jobs";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireWallet } from "@/lib/auth/guard";
import { getPlan } from "@/lib/plans/access";
import {
  recordStrategyGeneration,
  strategyGenerationsThisMonth,
} from "@/lib/plans/usage";
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

  let criteria: StrategyCriteria;
  try {
    criteria = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!criteria.budget || criteria.budget <= 0 || criteria.budget > 10_000_000) {
    return Response.json(
      { error: "Budget must be between $1 and $10,000,000" },
      { status: 400 },
    );
  }

  const plan = getPlan(auth.wallet);
  const used = strategyGenerationsThisMonth(auth.wallet);
  if (used >= plan.capabilities.monthlyStrategies) {
    return Response.json(
      {
        error: "Monthly strategy limit reached",
        tier: plan.tier,
        used,
        limit: plan.capabilities.monthlyStrategies,
        upgradePath: plan.tier === "free" ? "pro" : plan.tier === "pro" ? "ultra" : null,
      },
      { status: 402 },
    );
  }

  // Tier-aware criteria coercion. Free can't pick risk band or stable-only;
  // only Ultra can supply a custom APY range outside the risk-band preset.
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
    !criteria.targetApyMin ||
    !criteria.targetApyMax ||
    criteria.targetApyMin >= criteria.targetApyMax
  ) {
    return Response.json({ error: "Invalid APY range" }, { status: 400 });
  }

  const job = createJob();
  recordStrategyGeneration(auth.wallet, job.id);

  void generateStrategy(criteria, {
    onProgress: (event) => emitEvent(job.id, event),
    mode: plan.capabilities.strategistMode,
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
    message: job.events[0]?.message ?? "Preparing allocation workflow...",
    tier: plan.tier,
    used: used + 1,
    limit: plan.capabilities.monthlyStrategies,
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
