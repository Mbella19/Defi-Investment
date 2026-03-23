import { getDb } from "@/lib/db";
import type { ActiveStrategy } from "@/types/active-strategy";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const row = db.prepare("SELECT * FROM active_strategies WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    const alertCount = (
      db.prepare("SELECT COUNT(*) as count FROM strategy_alerts WHERE strategy_id = ? AND read = 0").get(id) as { count: number }
    ).count;

    const strategy: ActiveStrategy = {
      id: row.id as string,
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
    console.error("Failed to get strategy:", error);
    return Response.json({ error: "Failed to get strategy" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: "active" | "paused" | "archived" };

    if (!["active", "paused", "archived"].includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(
      "UPDATE active_strategies SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, id);

    if (result.changes === 0) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    return Response.json({ id, status, message: `Strategy ${status}` });
  } catch (error) {
    console.error("Failed to update strategy:", error);
    return Response.json({ error: "Failed to update strategy" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const result = db.prepare("DELETE FROM active_strategies WHERE id = ?").run(id);
    if (result.changes === 0) {
      return Response.json({ error: "Strategy not found" }, { status: 404 });
    }

    return Response.json({ message: "Strategy deleted" });
  } catch (error) {
    console.error("Failed to delete strategy:", error);
    return Response.json({ error: "Failed to delete strategy" }, { status: 500 });
  }
}
