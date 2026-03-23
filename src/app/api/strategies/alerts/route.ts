import { getDb } from "@/lib/db";
import type { StrategyAlert } from "@/types/active-strategy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const db = getDb();

    let query: string;
    const queryParams: unknown[] = [];

    if (wallet) {
      query = `
        SELECT sa.* FROM strategy_alerts sa
        JOIN active_strategies s ON sa.strategy_id = s.id
        WHERE s.wallet_address = ?
        ${unreadOnly ? "AND sa.read = 0" : ""}
        ORDER BY sa.created_at DESC
        LIMIT ?
      `;
      queryParams.push(wallet, limit);
    } else {
      query = `
        SELECT * FROM strategy_alerts
        ${unreadOnly ? "WHERE read = 0" : ""}
        ORDER BY created_at DESC
        LIMIT ?
      `;
      queryParams.push(limit);
    }

    const rows = db.prepare(query).all(...queryParams) as Record<string, unknown>[];

    const alerts: StrategyAlert[] = rows.map((row) => ({
      id: row.id as string,
      strategyId: row.strategy_id as string,
      type: row.type as StrategyAlert["type"],
      severity: row.severity as StrategyAlert["severity"],
      poolId: row.pool_id as string | null,
      protocol: row.protocol as string,
      symbol: row.symbol as string,
      chain: row.chain as string,
      message: row.message as string,
      detail: row.detail as string,
      suggestion: row.suggestion as string | null,
      read: (row.read as number) === 1,
      createdAt: row.created_at as string,
    }));

    // Also return total unread count
    const countRow = wallet
      ? db.prepare(
          "SELECT COUNT(*) as count FROM strategy_alerts sa JOIN active_strategies s ON sa.strategy_id = s.id WHERE s.wallet_address = ? AND sa.read = 0"
        ).get(wallet) as { count: number }
      : db.prepare("SELECT COUNT(*) as count FROM strategy_alerts WHERE read = 0").get() as { count: number };

    return Response.json({ alerts, unreadCount: countRow.count });
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return Response.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { alertIds, markAllRead, wallet } = body as {
      alertIds?: string[];
      markAllRead?: boolean;
      wallet?: string;
    };

    const db = getDb();

    if (markAllRead) {
      if (wallet) {
        db.prepare(
          `UPDATE strategy_alerts SET read = 1
           WHERE strategy_id IN (SELECT id FROM active_strategies WHERE wallet_address = ?)
           AND read = 0`
        ).run(wallet);
      } else {
        db.prepare("UPDATE strategy_alerts SET read = 1 WHERE read = 0").run();
      }
    } else if (alertIds && alertIds.length > 0) {
      const placeholders = alertIds.map(() => "?").join(",");
      db.prepare(`UPDATE strategy_alerts SET read = 1 WHERE id IN (${placeholders})`).run(...alertIds);
    }

    return Response.json({ message: "Alerts updated" });
  } catch (error) {
    console.error("Failed to update alerts:", error);
    return Response.json({ error: "Failed to update alerts" }, { status: 500 });
  }
}
