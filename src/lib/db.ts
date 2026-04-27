import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "sovereign.db");

let _db: InstanceType<typeof Database> | null = null;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    // Auto-checkpoint every 1000 frames so the WAL doesn't grow unbounded
    // in long-running production deployments.
    _db.pragma("wal_autocheckpoint = 1000");
    migrate(_db);
    registerShutdownHooks();
  }
  return _db;
}

let _shutdownRegistered = false;
function registerShutdownHooks() {
  if (_shutdownRegistered) return;
  _shutdownRegistered = true;
  const close = () => {
    try {
      _db?.close();
      _db = null;
    } catch {
      /* best effort */
    }
  };
  process.once("beforeExit", close);
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

function migrate(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS strategy_breach_state (
      strategy_id TEXT NOT NULL REFERENCES active_strategies(id) ON DELETE CASCADE,
      pool_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      consecutive_breaches INTEGER NOT NULL,
      first_breach_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_breach_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (strategy_id, pool_id, alert_type)
    );

    CREATE INDEX IF NOT EXISTS idx_strategies_wallet ON active_strategies(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_strategies_status ON active_strategies(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_strategy ON strategy_alerts(strategy_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_read ON strategy_alerts(read);
    CREATE INDEX IF NOT EXISTS idx_breach_strategy ON strategy_breach_state(strategy_id);
  `);

  // One-shot repair for malformed alert.pool_id values written before the
  // bugfix ("<strategyId>-<realPoolId>-<index>" instead of "<realPoolId>"),
  // gated behind schema_migrations so it runs at most once per database.
  const REPAIR_NAME = "repair_malformed_alert_pool_ids_v1";
  const alreadyApplied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE name = ?")
    .get(REPAIR_NAME);
  if (!alreadyApplied) {
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
          const repaired = stripped.replace(/-\d+$/, "");
          if (repaired && repaired !== r.pool_id) {
            updateStmt.run(repaired, r.id);
          }
        }
      });
      fix(malformed);
    }
    db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(REPAIR_NAME);
  }
}
