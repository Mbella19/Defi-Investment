import { fetchPoolSeriesMany, alignSeries } from "@/lib/tools/pool-history";
import { correlationMatrix } from "@/lib/tools/correlation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireWallet } from "@/lib/auth/guard";
import { requireCapability } from "@/lib/plans/access";
import { log } from "@/lib/log";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  poolIds?: unknown;
  windowDays?: unknown;
}

export async function POST(request: Request) {
  const auth = requireWallet(request);
  if ("response" in auth) return auth.response;
  const cap = requireCapability(auth.wallet, "toolCorrelation");
  if (!cap.ok) return cap.response;
  // Each call fans out to up to 12 DeFiLlama history endpoints — bursting is
  // the dominant cost. 30/h per wallet/IP is comfortable for normal use.
  const limited = enforceRateLimit(request, "tools.correlation", { max: 30, windowMs: 60 * 60 * 1000 });
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
    const rawIds = Array.isArray(body.poolIds) ? body.poolIds : [];
    const poolIds = rawIds.filter(
      (value): value is string =>
        typeof value === "string" && /^[A-Za-z0-9:_-]{1,200}$/.test(value),
    );
    if (poolIds.length !== rawIds.length) {
      return Response.json({ error: "One or more pool IDs are invalid." }, { status: 400 });
    }
    if (poolIds.length < 2) {
      return Response.json(
        { error: "Provide at least 2 pool IDs to compute correlation." },
        { status: 400 },
      );
    }
    if (poolIds.length > 12) {
      return Response.json(
        { error: "Cap is 12 pools per matrix to keep API time reasonable." },
        { status: 400 },
      );
    }
    if (new Set(poolIds).size !== poolIds.length) {
      return Response.json({ error: "Each pool can appear only once." }, { status: 400 });
    }

    if (
      body.windowDays !== undefined &&
      (typeof body.windowDays !== "number" || !Number.isInteger(body.windowDays))
    ) {
      return Response.json({ error: "windowDays must be an integer" }, { status: 400 });
    }
    const requestedWindow = body.windowDays ?? 90;
    const windowDays = Math.min(365, Math.max(30, requestedWindow));

    const series = await fetchPoolSeriesMany(poolIds);
    const resolvedIds = new Set(series.map((s) => s.poolId));
    const missing = poolIds.filter((id) => !resolvedIds.has(id));

    if (series.length < 2) {
      return Response.json(
        {
          error: "Could not fetch history for enough pools to correlate.",
          missing,
        },
        { status: 502 },
      );
    }

    const ordered = poolIds
      .map((id) => series.find((s) => s.poolId === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);

    const { dates, matrix } = alignSeries(ordered, windowDays);
    if (dates.length < 30) {
      return Response.json(
        {
          error: `Only ${dates.length} overlapping daily observations across the selected pools — need at least 30 to correlate.`,
          missing,
          overlapDays: dates.length,
        },
        { status: 422 },
      );
    }

    const grid = correlationMatrix(matrix, dates).map((row) =>
      row.map((value) => (Number.isFinite(value) ? value : null)),
    );

    return Response.json({
      poolIds: ordered.map((s) => s.poolId),
      windowDays,
      overlapDays: dates.length,
      changeObservations: dates.length - 1,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      matrix: grid,
      missing,
      caveat:
        "This measures co-movement in APY changes, not token-price, smart-contract, bridge, or protocol dependency risk.",
    });
  } catch (err) {
    log.warn("correlation", "analysis failed", { error: err });
    return Response.json({ error: "Correlation analysis is temporarily unavailable" }, { status: 502 });
  }
}
