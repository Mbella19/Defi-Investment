import { forecastPoolApy } from "@/lib/apy-forecast";
import { fetchAllPools } from "@/lib/defillama";

async function buildLivePoolMap(): Promise<Map<string, number>> {
  // The forecast's currentApy comes from the LAST DAILY BUCKET of the pool's
  // chart history, which lags the live /pools endpoint by up to 24h. The
  // monitor scanner fires alerts off /pools, so the alert and the row's
  // "Current APY" column would otherwise disagree (this is what the user
  // saw: alert said 5.65% but the row still showed 7.1%). We override the
  // forecast's currentApy with the live /pools value so they always match.
  const map = new Map<string, number>();
  try {
    const pools = await fetchAllPools();
    for (const p of pools) {
      if (p.pool && typeof p.apy === "number" && Number.isFinite(p.apy)) {
        map.set(p.pool, p.apy);
      }
    }
  } catch {
    // If live fetch fails we fall back to the forecast's chart-derived value.
  }
  return map;
}

async function buildForecasts(ids: string[]) {
  const livePools = await buildLivePoolMap();
  return Promise.all(
    ids.map(async (id) => {
      try {
        const forecast = await forecastPoolApy(id);
        const liveApy = livePools.get(id);
        if (forecast && typeof liveApy === "number") {
          forecast.currentApy = liveApy;
        }
        return { poolId: id, forecast };
      } catch (error) {
        const message = error instanceof Error ? error.message : "forecast failed";
        return { poolId: id, forecast: null, error: message };
      }
    }),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poolIds = searchParams.getAll("poolId");
  const single = searchParams.get("poolId");

  if (poolIds.length === 0 && !single) {
    return Response.json({ error: "poolId required" }, { status: 400 });
  }

  const ids = poolIds.length > 0 ? poolIds : [single!];
  if (ids.length > MAX_POOL_IDS) {
    return Response.json(
      { error: `Too many poolIds (${ids.length}); max ${MAX_POOL_IDS} per request` },
      { status: 400 },
    );
  }
  const results = await buildForecasts(ids);
  return Response.json({ forecasts: results });
}

const MAX_POOL_IDS = 50;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { poolIds?: string[] };
    const ids = Array.isArray(body.poolIds) ? body.poolIds.filter((s): s is string => typeof s === "string") : [];
    if (ids.length === 0) {
      return Response.json({ error: "poolIds required" }, { status: 400 });
    }
    if (ids.length > MAX_POOL_IDS) {
      return Response.json(
        { error: `Too many poolIds (${ids.length}); max ${MAX_POOL_IDS} per request` },
        { status: 400 },
      );
    }

    const results = await buildForecasts(ids);
    return Response.json({ forecasts: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forecast batch failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
