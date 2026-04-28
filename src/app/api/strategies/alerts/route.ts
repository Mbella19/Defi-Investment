import { getDb } from "@/lib/db";
import { requireWallet } from "@/lib/auth/guard";
import type { StrategyAlert } from "@/types/active-strategy";

export async function GET(request: Request) {
  try {
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    // Clamp 1–100. Without a max, an unbounded `limit` lets a caller pull
    // their entire alert history and inflate response size.
    const rawLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;

    const db = getDb();

    // Always scope to the authenticated wallet's strategies.
    const query = `
      SELECT sa.* FROM strategy_alerts sa
      JOIN active_strategies s ON sa.strategy_id = s.id
      WHERE s.wallet_address = ?
      ${unreadOnly ? "AND sa.read = 0" : ""}
      ORDER BY sa.created_at DESC
      LIMIT ?
    `;
    const queryParams: unknown[] = [auth.wallet, limit];

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

    // Total unread for this wallet only.
    const countRow = db.prepare(
      "SELECT COUNT(*) as count FROM strategy_alerts sa JOIN active_strategies s ON sa.strategy_id = s.id WHERE s.wallet_address = ? AND sa.read = 0"
    ).get(auth.wallet) as { count: number };

    return Response.json({ alerts, unreadCount: countRow.count });
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return Response.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    const body = await request.json();
    const { alertIds, markAllRead } = body as {
      alertIds?: string[];
      markAllRead?: boolean;
    };

    const db = getDb();

    if (markAllRead) {
      db.prepare(
        `UPDATE strategy_alerts SET read = 1
         WHERE strategy_id IN (SELECT id FROM active_strategies WHERE wallet_address = ?)
         AND read = 0`
      ).run(auth.wallet);
    } else if (alertIds && alertIds.length > 0) {
      // Cap to keep the IN list bounded, then scope by wallet via JOIN so
      // a caller can't mark someone else's alerts.
      const capped = alertIds.slice(0, 100);
      const placeholders = capped.map(() => "?").join(",");
      db.prepare(
        `UPDATE strategy_alerts SET read = 1
         WHERE id IN (${placeholders})
         AND strategy_id IN (SELECT id FROM active_strategies WHERE wallet_address = ?)`,
      ).run(...capped, auth.wallet);
    }

    return Response.json({ message: "Alerts updated" });
  } catch (error) {
    console.error("Failed to update alerts:", error);
    return Response.json({ error: "Failed to update alerts" }, { status: 500 });
  }
}
