import { fetchAllPools } from "@/lib/defillama";
import { fetchPoolSeriesMany } from "@/lib/tools/pool-history";
import {
  simulate,
  type AllocationInput,
  type PoolMeta,
  type Scenario,
} from "@/lib/tools/yield-simulator";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireWallet } from "@/lib/auth/guard";
import { requireCapability } from "@/lib/plans/access";
import { log } from "@/lib/log";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_SCENARIOS: Scenario[] = [
  "baseline",
  "depeg",
  "tvl_crash",
  "market_drawdown",
];

interface RawAllocation {
  poolId?: unknown;
  weightPct?: unknown;
}

interface Body {
  allocations?: unknown;
  principalUsd?: unknown;
  horizonDays?: unknown;
  scenario?: unknown;
}

function parseAllocations(raw: unknown): AllocationInput[] {
  if (!Array.isArray(raw)) return [];
  const out: AllocationInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const a = item as RawAllocation;
    const poolId =
      typeof a.poolId === "string" && /^[A-Za-z0-9:_-]{1,200}$/.test(a.poolId)
        ? a.poolId
        : null;
    const weight = a.weightPct;
    if (
      !poolId ||
      typeof weight !== "number" ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 100
    ) continue;
    out.push({ poolId, weightPct: weight });
  }
  return out;
}

export async function POST(request: Request) {
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const cap = requireCapability(auth.wallet, "toolSimulator");
  if (!cap.ok) return cap.response;
  // Mirrors /api/tools/correlation — both fan out to DeFiLlama history.
  const limited = enforceRateLimit(request, "tools.simulate", { max: 30, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  try {
    let parsed: unknown;
    try {
      parsed = await readJsonBody(request);
    } catch (error) {
      return jsonBodyErrorResponse(error);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "JSON body must be an object" }, { status: 400 });
    }
    const body = parsed as Body;

    if (!Array.isArray(body.allocations) || body.allocations.length < 1) {
      return Response.json(
        { error: "Provide at least 1 allocation with poolId and weightPct." },
        { status: 400 },
      );
    }
    if (body.allocations.length > 8) {
      return Response.json(
        { error: "Cap is 8 allocations per simulation." },
        { status: 400 },
      );
    }

    const allocations = parseAllocations(body.allocations);
    if (allocations.length !== body.allocations.length) {
      return Response.json(
        { error: "Every allocation must contain a valid poolId and numeric weightPct." },
        { status: 400 },
      );
    }
    if (new Set(allocations.map((allocation) => allocation.poolId)).size !== allocations.length) {
      return Response.json({ error: "Each pool can appear only once." }, { status: 400 });
    }

    const totalWeight = allocations.reduce((s, a) => s + a.weightPct, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      return Response.json(
        { error: `Allocation weights must sum to 100% (got ${totalWeight.toFixed(1)}%).` },
        { status: 400 },
      );
    }

    const principalRaw = body.principalUsd === undefined ? 10_000 : body.principalUsd;
    if (
      typeof principalRaw !== "number" ||
      !Number.isFinite(principalRaw) ||
      principalRaw <= 0 ||
      principalRaw > 1_000_000_000
    ) {
      return Response.json(
        { error: "principalUsd must be between 0 and 1,000,000,000." },
        { status: 400 },
      );
    }
    const principalUsd = principalRaw;

    const horizonRaw = body.horizonDays === undefined ? 90 : body.horizonDays;
    if (
      typeof horizonRaw !== "number" ||
      !Number.isInteger(horizonRaw) ||
      horizonRaw < 30 ||
      horizonRaw > 365
    ) {
      return Response.json(
        { error: "horizonDays must be an integer between 30 and 365." },
        { status: 400 },
      );
    }
    const horizonDays = horizonRaw;

    if (body.scenario !== undefined && typeof body.scenario !== "string") {
      return Response.json({ error: "scenario must be a string" }, { status: 400 });
    }
    const scenarioRaw = body.scenario ?? "baseline";
    if (!(VALID_SCENARIOS as string[]).includes(scenarioRaw)) {
      return Response.json({ error: "Unknown simulation scenario." }, { status: 400 });
    }
    const scenario = scenarioRaw as Scenario;

    const poolIds = allocations.map((a) => a.poolId);
    const [series, allPools] = await Promise.all([
      fetchPoolSeriesMany(poolIds),
      fetchAllPools(),
    ]);

    const seriesById = new Map(series.map((s) => [s.poolId, s]));
    const metaById = new Map<string, PoolMeta>();
    for (const p of allPools) {
      if (typeof p.pool === "string" && poolIds.includes(p.pool)) {
        metaById.set(p.pool, {
          symbol: p.symbol ?? "?",
          protocol: p.project ?? "?",
          chain: p.chain ?? "?",
          stablecoin: p.stablecoin === true,
        });
      }
    }

    const unavailable = poolIds.filter(
      (poolId) =>
        !seriesById.has(poolId) ||
        (seriesById.get(poolId)?.points.length ?? 0) < 30 ||
        !metaById.has(poolId),
    );
    if (unavailable.length > 0) {
      return Response.json(
        {
          error:
            "Simulation requires current metadata and at least 30 history points for every selected pool.",
          unavailable,
        },
        { status: 422 },
      );
    }

    const result = simulate({
      allocations,
      seriesById,
      metaById,
      principalUsd,
      horizonDays,
      scenario,
    });

    return Response.json(result);
  } catch (err) {
    log.warn("simulator", "analysis failed", { error: err });
    return Response.json({ error: "Simulation is temporarily unavailable" }, { status: 502 });
  }
}
