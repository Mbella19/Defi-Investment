import { getDb } from "@/lib/db";
import { requireWallet } from "@/lib/auth/guard";
import { log } from "@/lib/log";
import type { ActiveStrategy } from "@/types/active-strategy";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

function validId(id: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(id);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    const { id } = await params;
    if (!validId(id)) return Response.json({ error: "Strategy not found" }, { status: 404 });
    const db = getDb();

    // Scope by wallet — return 404 (not 403) for someone else's strategy so
    // we don't leak existence information to unauthorized callers.
    const row = db
      .prepare("SELECT * FROM active_strategies WHERE id = ? AND wallet_address = ?")
      .get(id, auth.wallet) as Record<string, unknown> | undefined;
    if (!row) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    const alertCount = (
      db.prepare("SELECT COUNT(*) as count FROM strategy_alerts WHERE strategy_id = ? AND read = 0").get(id) as { count: number }
    ).count;

    const strategy: ActiveStrategy = {
      id: row.id as string,
      sourceJobId: (row.source_job_id as string | null) ?? undefined,
      walletAddress: row.wallet_address as string | null,
      strategy: JSON.parse(row.strategy_json as string) as InvestmentStrategy,
      criteria: JSON.parse(row.criteria_json as string) as StrategyCriteria,
      status: row.status as ActiveStrategy["status"],
      projectedApy: row.projected_apy as number,
      totalBudget: row.total_budget as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      alertCount,
    };

    return Response.json({ strategy });
  } catch (error) {
    log.error("strategies", "failed to get strategy", { error });
    return Response.json({ error: "Failed to get strategy" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    const { id } = await params;
    if (!validId(id)) return Response.json({ error: "Strategy not found" }, { status: 404 });
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      return jsonBodyErrorResponse(error);
    }
    const status =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as { status?: unknown }).status
        : undefined;

    if (
      typeof status !== "string" ||
      !["active", "paused", "archived"].includes(status)
    ) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(
      "UPDATE active_strategies SET status = ?, updated_at = datetime('now') WHERE id = ? AND wallet_address = ?"
    ).run(status, id, auth.wallet);

    if (result.changes === 0) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    return Response.json({ id, status, message: `Strategy ${status}` });
  } catch (error) {
    log.error("strategies", "failed to update strategy", { error });
    return Response.json({ error: "Failed to update strategy" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    const { id } = await params;
    if (!validId(id)) return Response.json({ error: "Strategy not found" }, { status: 404 });
    const db = getDb();

    const result = db
      .prepare("DELETE FROM active_strategies WHERE id = ? AND wallet_address = ?")
      .run(id, auth.wallet);
    if (result.changes === 0) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    return Response.json({ message: "Strategy deleted" });
  } catch (error) {
    log.error("strategies", "failed to delete strategy", { error });
    return Response.json({ error: "Failed to delete strategy" }, { status: 500 });
  }
}
