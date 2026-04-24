import { getDb } from "@/lib/db";
import { fetchAllPools } from "@/lib/defillama";
import { runMonitorScan } from "@/lib/monitor";
import { DEFAULT_ALERT_CONFIG } from "@/types/portfolio";
import type { PortfolioPosition } from "@/types/portfolio";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { strategyId } = body as { strategyId?: string };

    const db = getDb();

    const rows = strategyId
      ? db.prepare("SELECT * FROM active_strategies WHERE id = ? AND status = 'active'").all(strategyId)
      : db.prepare("SELECT * FROM active_strategies WHERE status = 'active'").all();

    if ((rows as unknown[]).length === 0) {
      return Response.json({ results: [], newAlerts: [] });
    }

    const allPools = await fetchAllPools();

    const allNewAlerts: Array<{
      id: string;
      strategyId: string;
      type: string;
      severity: string;
      poolId: string | null;
      protocol: string;
      symbol: string;
      chain: string;
      message: string;
      detail: string;
      createdAt: string;
    }> = [];

    const dedupStmt = db.prepare(
      `SELECT COUNT(*) as count FROM strategy_alerts
       WHERE strategy_id = ? AND type = ? AND pool_id = ?
       AND created_at > datetime('now', '-24 hours')`
    );

    const insertStmt = db.prepare(
      `INSERT INTO strategy_alerts (id, strategy_id, type, severity, pool_id, protocol, symbol, chain, message, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const row of rows as Record<string, unknown>[]) {
      const sId = row.id as string;
      const strategy = JSON.parse(row.strategy_json as string) as InvestmentStrategy;
      const criteria = JSON.parse(row.criteria_json as string) as StrategyCriteria;
      const createdAt = row.created_at as string;

      const positions: PortfolioPosition[] = strategy.allocations.map((alloc, i) => ({
        id: `${sId}-${alloc.poolId}-${i}`,
        poolId: alloc.poolId,
        protocol: alloc.protocol,
        chain: alloc.chain,
        symbol: alloc.symbol,
        investedAmount: alloc.allocationAmount,
        entryApy: alloc.apy,
        entryTvl: alloc.tvl,
        entryDate: createdAt,
        riskAppetite: criteria.riskAppetite,
      }));

      const alerts = runMonitorScan(positions, allPools, DEFAULT_ALERT_CONFIG);

      for (const alert of alerts) {
        const { count } = dedupStmt.get(sId, alert.type, alert.positionId) as { count: number };
        if (count > 0) continue;

        const alertId = crypto.randomUUID();
        insertStmt.run(
          alertId,
          sId,
          alert.type,
          alert.severity,
          alert.positionId,
          alert.protocol,
          alert.symbol,
          alert.chain,
          alert.message,
          alert.detail,
        );

        allNewAlerts.push({
          id: alertId,
          strategyId: sId,
          type: alert.type,
          severity: alert.severity,
          poolId: alert.positionId,
          protocol: alert.protocol,
          symbol: alert.symbol,
          chain: alert.chain,
          message: alert.message,
          detail: alert.detail,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return Response.json({
      scanned: (rows as unknown[]).length,
      newAlerts: allNewAlerts,
    });
  } catch (error) {
    console.error("Strategy monitor scan failed:", error);
    const message = error instanceof Error ? error.message : "Monitor scan failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
