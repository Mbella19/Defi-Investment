import { fetchPoolSeriesMany, alignSeries } from "@/lib/tools/pool-history";
import { correlationMatrix } from "@/lib/tools/correlation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  poolIds?: unknown;
  windowDays?: unknown;
}

export async function POST(request: Request) {
  // Each call fans out to up to 12 DeFiLlama history endpoints — bursting is
  // the dominant cost. 30/h per wallet/IP is comfortable for normal use.
  const limited = enforceRateLimit(request, "tools.correlation", { max: 30, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const rawIds = Array.isArray(body.poolIds) ? body.poolIds : [];
    const poolIds = rawIds.map(String).filter(Boolean);
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

    const requestedWindow = Number(body.windowDays);
    const windowDays =
      Number.isFinite(requestedWindow) && requestedWindow > 0
        ? Math.min(365, Math.max(14, Math.floor(requestedWindow)))
        : 90;

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
    if (dates.length < 14) {
      return Response.json(
        {
          error: `Only ${dates.length} overlapping days of history across the selected pools — need at least 14 to correlate.`,
          missing,
          overlapDays: dates.length,
        },
        { status: 422 },
      );
    }

    const grid = correlationMatrix(matrix);

    return Response.json({
      poolIds: ordered.map((s) => s.poolId),
      windowDays,
      overlapDays: dates.length,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      matrix: grid,
      missing,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Correlation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
