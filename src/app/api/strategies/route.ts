import { getDb } from "@/lib/db";
import { ensureSchedulerStarted } from "@/lib/monitor-scheduler";
import { requireWallet } from "@/lib/auth/guard";
import { isRiskAppetite, validateStrategyShape } from "@/lib/strategy-validate";
import type { ActiveStrategy } from "@/types/active-strategy";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";

// Every active strategy is scanned every 15 minutes (pool history, RPC pause
// checks, exploit matching) — an unbounded list is an unbounded monitoring
// bill. 25 concurrent mandates is far beyond real usage.
const MAX_STRATEGIES_PER_WALLET = 25;

export async function GET(request: Request) {
  try {
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    ensureSchedulerStarted();

    const db = getDb();

    // Always scope by the authenticated wallet — never the client-supplied
    // query param. Anyone with the URL would otherwise be able to read any
    // wallet's strategies just by passing ?wallet=0x….
    const rows = db
      .prepare("SELECT * FROM active_strategies WHERE wallet_address = ? ORDER BY created_at DESC")
      .all(auth.wallet);

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
    const auth = requireWallet(request);
    if ("response" in auth) return auth.response;
    ensureSchedulerStarted();

    const body = await request.json();
    const { strategy, criteria } = body as {
      strategy: InvestmentStrategy;
      criteria: StrategyCriteria;
    };

    if (!strategy || !criteria) {
      return Response.json({ error: "strategy and criteria are required" }, { status: 400 });
    }

    // Reject malformed bodies BEFORE they hit the database. An arbitrary
    // "strategy" blob previously 500'd on the NOT NULL projected_apy column
    // at best — and at worst inserted a row that crashed the monitor sweep
    // for every user.
    if (
      typeof criteria.budget !== "number" ||
      !Number.isFinite(criteria.budget) ||
      criteria.budget <= 0 ||
      criteria.budget > 10_000_000
    ) {
      return Response.json(
        { error: "criteria.budget must be a number between 1 and 10,000,000" },
        { status: 400 },
      );
    }
    if (!isRiskAppetite(criteria.riskAppetite)) {
      return Response.json(
        { error: "criteria.riskAppetite must be low, medium, or high" },
        { status: 400 },
      );
    }
    const shapeError = validateStrategyShape(strategy, criteria, { requireProjectedApy: true });
    if (shapeError) {
      return Response.json({ error: `Invalid strategy: ${shapeError}` }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const db = getDb();

    const existing = db
      .prepare("SELECT COUNT(*) AS n FROM active_strategies WHERE wallet_address = ?")
      .get(auth.wallet) as { n: number };
    if (existing.n >= MAX_STRATEGIES_PER_WALLET) {
      return Response.json(
        {
          error: `Strategy limit reached (${MAX_STRATEGIES_PER_WALLET}). Archive or delete an existing strategy first.`,
        },
        { status: 400 },
      );
    }

    // wallet_address always comes from the authenticated session — ignore
    // anything the client sends in the body.
    db.prepare(`
      INSERT INTO active_strategies (id, wallet_address, strategy_json, criteria_json, status, projected_apy, total_budget)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id,
      auth.wallet,
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
