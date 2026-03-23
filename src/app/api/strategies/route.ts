import { getDb } from "@/lib/db";
import type { ActiveStrategy } from "@/types/active-strategy";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");

    const db = getDb();

    const rows = wallet
      ? db.prepare("SELECT * FROM active_strategies WHERE wallet_address = ? ORDER BY created_at DESC").all(wallet)
      : db.prepare("SELECT * FROM active_strategies ORDER BY created_at DESC").all();

    // Attach alert counts
    const alertStmt = db.prepare(
      "SELECT strategy_id, COUNT(*) as count FROM strategy_alerts WHERE strategy_id = ? AND read = 0"
    );

    const strategies: ActiveStrategy[] = (rows as Record<string, unknown>[]).map((row) => {
      const alertRow = alertStmt.get(row.id as string) as { count: number } | undefined;
      return {
        id: row.id as string,
        walletAddress: row.wallet_address as string | null,
        strategy: JSON.parse(row.strategy_json as string) as InvestmentStrategy,
        criteria: JSON.parse(row.criteria_json as string) as StrategyCriteria,
        status: row.status as ActiveStrategy["status"],
        projectedApy: row.projected_apy as number,
        totalBudget: row.total_budget as number,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        alertCount: alertRow?.count ?? 0,
      };
    });

    return Response.json({ strategies });
  } catch (error) {
    console.error("Failed to list strategies:", error);
    return Response.json({ error: "Failed to list strategies" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { strategy, criteria, walletAddress } = body as {
      strategy: InvestmentStrategy;
      criteria: StrategyCriteria;
      walletAddress?: string;
    };

    if (!strategy || !criteria) {
      return Response.json({ error: "strategy and criteria are required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const db = getDb();

    db.prepare(`
      INSERT INTO active_strategies (id, wallet_address, strategy_json, criteria_json, status, projected_apy, total_budget)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id,
      walletAddress || null,
      JSON.stringify(strategy),
      JSON.stringify(criteria),
      strategy.projectedApy,
      criteria.budget,
    );

    return Response.json({
      id,
      status: "active",
      message: "Strategy activated and will be monitored",
    });
  } catch (error) {
    console.error("Failed to activate strategy:", error);
    return Response.json({ error: "Failed to activate strategy" }, { status: 500 });
  }
}
