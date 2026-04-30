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
    if (!item || typeof item !== "object") continue;
    const a = item as RawAllocation;
    const poolId = typeof a.poolId === "string" ? a.poolId : null;
    const weight = Number(a.weightPct);
    if (!poolId || !Number.isFinite(weight) || weight <= 0) continue;
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
    const body = (await request.json().catch(() => ({}))) as Body;

    const allocations = parseAllocations(body.allocations);
    if (allocations.length < 1) {
      return Response.json(
        { error: "Provide at least 1 allocation with poolId and weightPct." },
        { status: 400 },
      );
    }
    if (allocations.length > 8) {
      return Response.json(
        { error: "Cap is 8 allocations per simulation." },
        { status: 400 },
      );
    }

    const totalWeight = allocations.reduce((s, a) => s + a.weightPct, 0);
    if (Math.abs(totalWeight - 100) > 1) {
      return Response.json(
        { error: `Allocation weights must sum to 100% (got ${totalWeight.toFixed(1)}%).` },
        { status: 400 },
      );
    }

    const principalRaw = Number(body.principalUsd);
    const principalUsd = Number.isFinite(principalRaw) && principalRaw > 0
      ? Math.min(1_000_000_000, principalRaw)
      : 10_000;

    const horizonRaw = Number(body.horizonDays);
    const horizonDays = Number.isFinite(horizonRaw) && horizonRaw > 0
      ? Math.min(365, Math.max(30, Math.floor(horizonRaw)))
      : 90;

    const scenarioRaw = typeof body.scenario === "string" ? body.scenario : "baseline";
    const scenario = (VALID_SCENARIOS as string[]).includes(scenarioRaw)
      ? (scenarioRaw as Scenario)
      : "baseline";

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
        });
      }
    }

    if (seriesById.size === 0) {
      return Response.json(
        { error: "Could not fetch history for any of the selected pools." },
        { status: 502 },
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
    const message = err instanceof Error ? err.message : "Simulation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
