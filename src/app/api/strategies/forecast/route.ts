import { forecastPoolApy } from "@/lib/apy-forecast";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poolIds = searchParams.getAll("poolId");
  const single = searchParams.get("poolId");

  if (poolIds.length === 0 && !single) {
    return Response.json({ error: "poolId required" }, { status: 400 });
  }

  const ids = poolIds.length > 0 ? poolIds : [single!];

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const forecast = await forecastPoolApy(id);
        return { poolId: id, forecast };
      } catch (error) {
        const message = error instanceof Error ? error.message : "forecast failed";
        return { poolId: id, forecast: null, error: message };
      }
    }),
  );

  return Response.json({ forecasts: results });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { poolIds?: string[] };
    const ids = Array.isArray(body.poolIds) ? body.poolIds.filter((s): s is string => typeof s === "string") : [];
    if (ids.length === 0) {
      return Response.json({ error: "poolIds required" }, { status: 400 });
    }

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const forecast = await forecastPoolApy(id);
          return { poolId: id, forecast };
        } catch (error) {
          const message = error instanceof Error ? error.message : "forecast failed";
          return { poolId: id, forecast: null, error: message };
        }
      }),
    );

    return Response.json({ forecasts: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forecast batch failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
