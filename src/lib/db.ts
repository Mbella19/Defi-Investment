import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "sovereign.db");

let _db: InstanceType<typeof Database> | null = null;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_strategies (
      id TEXT PRIMARY KEY,
      wallet_address TEXT,
      strategy_json TEXT NOT NULL,
      criteria_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      projected_apy REAL NOT NULL,
      total_budget REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS strategy_alerts (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL REFERENCES active_strategies(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      pool_id TEXT,
      protocol TEXT NOT NULL,
      symbol TEXT NOT NULL,
      chain TEXT NOT NULL,
      message TEXT NOT NULL,
      detail TEXT NOT NULL,
      suggestion TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_strategies_wallet ON active_strategies(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_strategies_status ON active_strategies(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_strategy ON strategy_alerts(strategy_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_read ON strategy_alerts(read);
  `);

  // Repair malformed alert.pool_id values written before the bugfix:
  // they were stored as "<strategyId>-<realPoolId>-<index>" instead of
  // just "<realPoolId>", so the DeFiLlama pool deep-link 500'd. Strip the
  // strategy_id prefix and the trailing "-<index>" suffix in-place. Safe to
  // run on every boot — it's a no-op once rows are clean.
  const malformed = db
    .prepare(
      "SELECT id, strategy_id, pool_id FROM strategy_alerts WHERE pool_id IS NOT NULL AND pool_id LIKE strategy_id || '-%'",
    )
    .all() as Array<{ id: string; strategy_id: string; pool_id: string }>;
  if (malformed.length > 0) {
    const updateStmt = db.prepare("UPDATE strategy_alerts SET pool_id = ? WHERE id = ?");
    const fix = db.transaction((rows: typeof malformed) => {
      for (const r of rows) {
        const stripped = r.pool_id.slice(r.strategy_id.length + 1);
        // Drop the trailing "-<index>" (allocations[i] in the strategy)
        const repaired = stripped.replace(/-\d+$/, "");
        if (repaired && repaired !== r.pool_id) {
          updateStmt.run(repaired, r.id);
        }
      }
    });
    fix(malformed);
  }
}
