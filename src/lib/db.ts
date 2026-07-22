import Database from "better-sqlite3";
import { createHash } from "crypto";
import { chmodSync } from "fs";
import path from "path";
import { log } from "@/lib/log";

// This is runtime state, never a build input. The tracer-ignore annotation
// prevents a dynamic production DATABASE_PATH from making Next package the
// entire repository while preserving the existing cwd-relative default.
const CONFIGURED_DB_PATH = process.env.DATABASE_PATH || "sovereign.db";
const DB_PATH = CONFIGURED_DB_PATH === ":memory:"
  ? CONFIGURED_DB_PATH
  : path.isAbsolute(CONFIGURED_DB_PATH)
    ? CONFIGURED_DB_PATH
    : path.join(/*turbopackIgnore: true*/ process.cwd(), CONFIGURED_DB_PATH);

interface DatabaseProcessState {
  __sovereignDatabase?: InstanceType<typeof Database>;
  __sovereignDbShutdownRegistered?: boolean;
}

// Next dev can re-evaluate server modules during HMR while keeping the Node
// process alive. Process-global state prevents orphaned SQLite handles and a
// new set of signal listeners on every recompilation.
const databaseProcess = globalThis as typeof globalThis & DatabaseProcessState;
let _db: InstanceType<typeof Database> | null = databaseProcess.__sovereignDatabase ?? null;

export function getDb() {
  if (!_db) {
    const candidate = new Database(/*turbopackIgnore: true*/ DB_PATH);
    try {
      candidate.pragma("journal_mode = WAL");
      candidate.pragma("foreign_keys = ON");
      candidate.pragma("busy_timeout = 5000");
      // Payment activation, sessions, and job leases should survive a host
      // power loss once SQLite reports commit success.
      candidate.pragma("synchronous = FULL");
      candidate.pragma("trusted_schema = OFF");
      // Auto-checkpoint every 1000 frames so the WAL doesn't grow unbounded
      // in long-running production deployments.
      candidate.pragma("wal_autocheckpoint = 1000");
      migrate(candidate);
      hardenDatabaseFiles();
      _db = candidate;
      databaseProcess.__sovereignDatabase = candidate;
    } catch (error) {
      try { candidate.close(); } catch { /* best effort */ }
      throw error;
    }
  }
  registerShutdownHooks();
  return _db;
}

function hardenDatabaseFiles(): void {
  if (DB_PATH === ":memory:") return;
  for (const candidate of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    try {
      chmodSync(/*turbopackIgnore: true*/ candidate, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      log.warn("database", "could not restrict database file permissions", {
        databasePath: candidate,
        error,
      });
    }
  }
}

function registerShutdownHooks() {
  if (databaseProcess.__sovereignDbShutdownRegistered) return;
  databaseProcess.__sovereignDbShutdownRegistered = true;
  const close = () => {
    try {
      databaseProcess.__sovereignDatabase?.close();
      databaseProcess.__sovereignDatabase = undefined;
      _db = null;
    } catch {
      /* best effort */
    }
  };
  process.once("beforeExit", close);
  const onSignal = (exitCode: number) => {
    close();
    process.exitCode = exitCode;
    // Next/process supervisors normally close listeners themselves. This is
    // only a bounded fallback so registering our DB cleanup hook can never
    // turn SIGTERM into a process that stays alive forever.
    const forceExit = setTimeout(() => process.exit(exitCode), 5_000);
    forceExit.unref();
  };
  process.once("SIGINT", () => onSignal(130));
  process.once("SIGTERM", () => onSignal(0));
}

function migrate(db: InstanceType<typeof Database>) {
  const bootstrap = db.transaction(() => db.exec(`
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

    -- Paid subscription state. One row per wallet, replaced on each new payment.
    CREATE TABLE IF NOT EXISTS subscriptions (
      wallet_address TEXT PRIMARY KEY,
      tier TEXT NOT NULL,
      activated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      payment_chain TEXT,
      payment_token TEXT,
      payment_amount TEXT,
      payment_tx_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Pending crypto payments. One row per quote — verified or expired.
    CREATE TABLE IF NOT EXISTS pending_payments (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      tier TEXT NOT NULL,
      chain TEXT NOT NULL,
      token TEXT NOT NULL,
      recipient_address TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      amount_token TEXT NOT NULL,
      token_decimals INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- One row per strategy generation call so we can enforce monthly caps even
    -- when generated drafts are discarded before activation.
    CREATE TABLE IF NOT EXISTS strategy_generations (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- One row per smart-contract audit run so we can enforce monthly caps
    -- per tier. Recorded at job creation; failed runs still count toward
    -- the cap so users can't retry-spam after failures.
    CREATE TABLE IF NOT EXISTS audit_runs (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Per-user notification channels. One row per (wallet, channel) pair —
    -- so a user can have at most one email, one telegram, one slack, one
    -- per-user discord channel configured at a time. The endpoint format
    -- depends on channel: email = address, telegram = chat_id, slack =
    -- webhook URL, discord = webhook URL.
    CREATE TABLE IF NOT EXISTS user_channels (
      wallet_address TEXT NOT NULL,
      channel TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      verified_at TEXT,
      PRIMARY KEY (wallet_address, channel)
    );

    -- Pending verification challenges. For email: 6-digit numeric code sent
    -- via the email itself. For telegram: alphanumeric token used as the
    -- /start parameter on the deeplink; the bot replies + we match it back
    -- to this row when the user pings the bot.
    CREATE TABLE IF NOT EXISTS channel_verifications (
      wallet_address TEXT NOT NULL,
      channel TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      code TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (wallet_address, channel)
    );

    -- Durable job state for the two long-running pipelines. The in-memory
    -- Maps in strategy-jobs.ts / audit/jobs.ts stay the hot path; these rows
    -- make results survive server restarts and closed tabs, and bind every
    -- job to the wallet that started it (job status reads are wallet-scoped).
    CREATE TABLE IF NOT EXISTS strategy_jobs (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      status TEXT NOT NULL,
      events_json TEXT NOT NULL DEFAULT '[]',
      result_json TEXT,
      error TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_jobs (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      contract_address TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      events_json TEXT NOT NULL DEFAULT '[]',
      result_json TEXT,
      error TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_strategy_jobs_wallet ON strategy_jobs(wallet_address, started_at);
    CREATE INDEX IF NOT EXISTS idx_audit_jobs_wallet ON audit_jobs(wallet_address, started_at);

    -- Persisted protocol security analyses. The in-process cache in
    -- anthropic.ts remains the hot path; this copy survives restarts and is
    -- reused across users so the ensemble doesn't re-run for the
    -- same protocol within the TTL.
    CREATE TABLE IF NOT EXISTS protocol_analyses (
      slug TEXT PRIMARY KEY,
      analysis_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Public share tokens for finished audit reports. A share pins its
    -- audit_jobs row (the prune skips shared jobs) so the public page keeps
    -- rendering after the normal retention window.
    CREATE TABLE IF NOT EXISTS audit_shares (
      token TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_shares_job ON audit_shares(job_id);

    CREATE INDEX IF NOT EXISTS idx_pending_wallet ON pending_payments(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_payments(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_tx ON pending_payments(tx_hash) WHERE tx_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_strategy_gen_wallet ON strategy_generations(wallet_address, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_runs_wallet ON audit_runs(wallet_address, created_at);
    CREATE INDEX IF NOT EXISTS idx_user_channels_wallet ON user_channels(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_channel_verif_code ON channel_verifications(channel, code);
  `));
  bootstrap();

  const hasMigration = (name: string): boolean =>
    Boolean(db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get(name));
  const applyMigration = (name: string, body: () => void): void => {
    if (hasMigration(name)) return;
    db.transaction(() => {
      body();
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(name);
    })();
  };

  // Additive column for expiry reminders — gated behind schema_migrations
  // because SQLite has no ALTER TABLE ... IF NOT EXISTS.
  const REMINDER_COL = "add_subscriptions_reminder_sent_at_v1";
  applyMigration(REMINDER_COL, () => {
    db.exec("ALTER TABLE subscriptions ADD COLUMN reminder_sent_at TEXT");
  });

  // One-shot repair for malformed alert.pool_id values written before the
  // bugfix ("<strategyId>-<realPoolId>-<index>" instead of "<realPoolId>"),
  // gated behind schema_migrations so it runs at most once per database.
  const REPAIR_NAME = "repair_malformed_alert_pool_ids_v1";
  applyMigration(REPAIR_NAME, () => {
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
  });

  applyMigration("security_and_durable_runtime_v2", () => {
    db.exec(`
      CREATE TABLE auth_sessions (
        token_hash TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        csrf_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
      CREATE INDEX idx_auth_sessions_wallet ON auth_sessions(wallet_address, expires_at);
      CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at, revoked_at);

      CREATE TABLE auth_nonces (
        nonce_hash TEXT PRIMARY KEY,
        issued_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER
      );
      CREATE INDEX idx_auth_nonces_expiry ON auth_nonces(expires_at, consumed_at);

      CREATE TABLE rate_limit_buckets (
        bucket_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        window_start INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX idx_rate_limit_expiry ON rate_limit_buckets(expires_at);

      CREATE TABLE usage_reservations (
        id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('strategy', 'audit')),
        period_start TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('reserved', 'settled', 'released')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_usage_reservation_wallet
        ON usage_reservations(wallet_address, kind, period_start, status);

      CREATE TABLE ai_usage_events (
        id TEXT PRIMARY KEY,
        wallet_address TEXT,
        job_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        operation TEXT NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        estimated_cost_usd REAL,
        duration_ms INTEGER NOT NULL,
        cache_hit INTEGER NOT NULL DEFAULT 0,
        success INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_ai_usage_created ON ai_usage_events(created_at);
      CREATE INDEX idx_ai_usage_job ON ai_usage_events(job_id);

      CREATE TABLE alert_incidents (
        incident_key TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL REFERENCES active_strategies(id) ON DELETE CASCADE,
        alert_id TEXT REFERENCES strategy_alerts(id) ON DELETE SET NULL,
        state TEXT NOT NULL CHECK(state IN ('open', 'recovered')),
        severity TEXT NOT NULL,
        opened_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE alert_outbox (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL REFERENCES strategy_alerts(id) ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'delivering', 'delivered', 'dead')),
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at INTEGER NOT NULL,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        delivered_at INTEGER,
        UNIQUE(alert_id, channel)
      );
      CREATE INDEX idx_alert_outbox_pending ON alert_outbox(status, available_at);

      CREATE TABLE upstream_cache (
        cache_key TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        content_encoding TEXT NOT NULL,
        payload BLOB NOT NULL,
        fetched_at INTEGER NOT NULL,
        fresh_until INTEGER NOT NULL,
        stale_until INTEGER NOT NULL
      );
      CREATE INDEX idx_upstream_cache_expiry ON upstream_cache(stale_until);

      ALTER TABLE pending_payments ADD COLUMN chain_id INTEGER;
      ALTER TABLE pending_payments ADD COLUMN token_contract TEXT;
      ALTER TABLE pending_payments ADD COLUMN unit_price_usd REAL;
      ALTER TABLE pending_payments ADD COLUMN canonical_tx_hash TEXT;
      ALTER TABLE pending_payments ADD COLUMN claim_deadline_at TEXT;

      ALTER TABLE strategy_jobs ADD COLUMN payload_json TEXT;
      ALTER TABLE strategy_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE strategy_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 2;
      ALTER TABLE strategy_jobs ADD COLUMN available_at INTEGER;
      ALTER TABLE strategy_jobs ADD COLUMN lease_owner TEXT;
      ALTER TABLE strategy_jobs ADD COLUMN lease_expires_at INTEGER;
      ALTER TABLE strategy_jobs ADD COLUMN heartbeat_at INTEGER;
      ALTER TABLE strategy_jobs ADD COLUMN idempotency_key TEXT;
      ALTER TABLE strategy_jobs ADD COLUMN updated_at INTEGER;

      ALTER TABLE audit_jobs ADD COLUMN payload_json TEXT;
      ALTER TABLE audit_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE audit_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 2;
      ALTER TABLE audit_jobs ADD COLUMN available_at INTEGER;
      ALTER TABLE audit_jobs ADD COLUMN lease_owner TEXT;
      ALTER TABLE audit_jobs ADD COLUMN lease_expires_at INTEGER;
      ALTER TABLE audit_jobs ADD COLUMN heartbeat_at INTEGER;
      ALTER TABLE audit_jobs ADD COLUMN idempotency_key TEXT;
      ALTER TABLE audit_jobs ADD COLUMN updated_at INTEGER;

      ALTER TABLE audit_shares ADD COLUMN expires_at TEXT;
      ALTER TABLE audit_shares ADD COLUMN revoked_at TEXT;

      ALTER TABLE user_channels ADD COLUMN endpoint_ciphertext TEXT;
      ALTER TABLE user_channels ADD COLUMN endpoint_iv TEXT;
      ALTER TABLE user_channels ADD COLUMN endpoint_tag TEXT;
      ALTER TABLE user_channels ADD COLUMN key_version INTEGER;
    `);

    db.prepare(
      `UPDATE pending_payments
       SET chain_id = CASE chain WHEN 'ethereum' THEN 1 WHEN 'bsc' THEN 56 ELSE NULL END,
           canonical_tx_hash = CASE
             WHEN chain IN ('ethereum', 'bsc') AND tx_hash IS NOT NULL THEN LOWER(tx_hash)
             ELSE NULL
           END,
           claim_deadline_at = datetime(expires_at, '+24 hours'),
           unit_price_usd = NULL`,
    ).run();

    // Keep one canonical claimant if legacy rows differ only by hash casing.
    const duplicates = db.prepare(
      `SELECT chain_id, canonical_tx_hash
       FROM pending_payments
       WHERE canonical_tx_hash IS NOT NULL
       GROUP BY chain_id, canonical_tx_hash
       HAVING COUNT(*) > 1`,
    ).all() as Array<{ chain_id: number; canonical_tx_hash: string }>;
    const rowsForHash = db.prepare(
      `SELECT id, status FROM pending_payments
       WHERE chain_id = ? AND canonical_tx_hash = ?
       ORDER BY CASE WHEN status = 'confirmed' THEN 0 ELSE 1 END, created_at ASC`,
    );
    const clearDuplicate = db.prepare(
      `UPDATE pending_payments
       SET canonical_tx_hash = NULL,
           status = CASE WHEN status = 'confirmed' THEN status ELSE 'failed' END
       WHERE id = ?`,
    );
    for (const duplicate of duplicates) {
      const rows = rowsForHash.all(duplicate.chain_id, duplicate.canonical_tx_hash) as Array<{
        id: string;
        status: string;
      }>;
      for (const row of rows.slice(1)) clearDuplicate.run(row.id);
    }

    db.exec(`
      DROP INDEX IF EXISTS idx_pending_tx;
      CREATE UNIQUE INDEX idx_pending_chain_tx
        ON pending_payments(chain_id, canonical_tx_hash)
        WHERE canonical_tx_hash IS NOT NULL;
      CREATE INDEX idx_strategy_jobs_claim
        ON strategy_jobs(status, available_at, lease_expires_at);
      CREATE UNIQUE INDEX idx_strategy_jobs_idempotency
        ON strategy_jobs(wallet_address, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE INDEX idx_audit_jobs_claim
        ON audit_jobs(status, available_at, lease_expires_at);
      CREATE UNIQUE INDEX idx_audit_jobs_idempotency
        ON audit_jobs(wallet_address, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE INDEX idx_audit_shares_expiry ON audit_shares(expires_at, revoked_at);
    `);
  });

  applyMigration("evm_payment_integrity_v3", () => {
    db.exec(`
      ALTER TABLE pending_payments ADD COLUMN payer_address TEXT;
      ALTER TABLE pending_payments ADD COLUMN settled_at TEXT;

      UPDATE pending_payments
      SET status = 'failed', canonical_tx_hash = NULL
      WHERE chain NOT IN ('ethereum', 'bsc') AND status = 'pending';

      UPDATE pending_payments
      SET token_contract = CASE
        WHEN chain = 'ethereum' AND token = 'USDC' THEN '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
        WHEN chain = 'ethereum' AND token = 'USDT' THEN '0xdac17f958d2ee523a2206206994597c13d831ec7'
        WHEN chain = 'bsc' AND token = 'USDC' THEN '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
        WHEN chain = 'bsc' AND token = 'USDT' THEN '0x55d398326f99059ff775485246999027b3197955'
        ELSE NULL
      END
      WHERE chain IN ('ethereum', 'bsc');

      DROP INDEX IF EXISTS idx_pending_chain_tx;
      CREATE UNIQUE INDEX idx_pending_confirmed_chain_tx
        ON pending_payments(chain_id, canonical_tx_hash)
        WHERE canonical_tx_hash IS NOT NULL AND status = 'confirmed';
      CREATE INDEX idx_pending_unconfirmed_chain_tx
        ON pending_payments(chain_id, canonical_tx_hash)
        WHERE canonical_tx_hash IS NOT NULL AND status != 'confirmed';
    `);
  });

  applyMigration("atomic_usage_backfill_v1", () => {
    const now = Date.now();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO usage_reservations
         (id, wallet_address, kind, period_start, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'settled', ?, ?)`,
    );
    const strategyRows = db
      .prepare("SELECT id, wallet_address, created_at FROM strategy_generations")
      .all() as Array<{ id: string; wallet_address: string; created_at: string }>;
    const auditRows = db
      .prepare("SELECT id, wallet_address, created_at FROM audit_runs")
      .all() as Array<{ id: string; wallet_address: string; created_at: string }>;
    const period = (value: string): string => {
      const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
      const date = new Date(normalized);
      if (!Number.isFinite(date.getTime())) {
        const fallback = new Date(now);
        return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1)).toISOString();
      }
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
    };
    for (const row of strategyRows) {
      insert.run(row.id, row.wallet_address.toLowerCase(), "strategy", period(row.created_at), now, now);
    }
    for (const row of auditRows) {
      insert.run(row.id, row.wallet_address.toLowerCase(), "audit", period(row.created_at), now, now);
    }
  });

  applyMigration("bind_active_strategy_to_job_v1", () => {
    db.exec(`
      ALTER TABLE active_strategies ADD COLUMN source_job_id TEXT;
      CREATE UNIQUE INDEX idx_active_strategy_source_job
        ON active_strategies(wallet_address, source_job_id)
        WHERE source_job_id IS NOT NULL;
    `);
  });

  applyMigration("monitoring_and_notification_integrity_v1", () => {
    db.exec(`
      ALTER TABLE alert_incidents ADD COLUMN incident_type TEXT;
      ALTER TABLE alert_incidents ADD COLUMN subject_key TEXT;
      CREATE INDEX idx_alert_incidents_strategy_state
        ON alert_incidents(strategy_id, state, incident_type);

      ALTER TABLE channel_verifications ADD COLUMN endpoint_ciphertext TEXT;
      ALTER TABLE channel_verifications ADD COLUMN endpoint_iv TEXT;
      ALTER TABLE channel_verifications ADD COLUMN endpoint_tag TEXT;
      ALTER TABLE channel_verifications ADD COLUMN key_version INTEGER;
      ALTER TABLE channel_verifications ADD COLUMN code_hash TEXT;
      CREATE INDEX idx_channel_verif_hash
        ON channel_verifications(channel, code_hash);
    `);
  });

  applyMigration("audit_share_secrets_v1", () => {
    db.exec("ALTER TABLE audit_shares ADD COLUMN token_hash TEXT");
    const shares = db
      .prepare("SELECT token FROM audit_shares")
      .all() as Array<{ token: string }>;
    const update = db.prepare(
      `UPDATE audit_shares
       SET token = ?, token_hash = ?, expires_at = COALESCE(expires_at, datetime('now', '+30 days'))
       WHERE token = ?`,
    );
    for (const share of shares) {
      const hash = createHash("sha256").update(share.token).digest("hex");
      update.run(hash, hash, share.token);
    }
    db.exec(`
      CREATE UNIQUE INDEX idx_audit_shares_token_hash
        ON audit_shares(token_hash) WHERE token_hash IS NOT NULL;
    `);
  });

  applyMigration("audit_share_idempotency_v1", () => {
    db.exec(`
      ALTER TABLE audit_shares ADD COLUMN token_nonce TEXT;
      CREATE INDEX idx_audit_shares_owner_job
        ON audit_shares(wallet_address, job_id, revoked_at, expires_at);
    `);
  });

  applyMigration("session_auth_method_v1", () => {
    db.exec(`
      ALTER TABLE auth_sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'siwe'
        CHECK(auth_method IN ('siwe', 'dev'));
    `);
  });

  applyMigration("strategy_job_safe_errors_v1", () => {
    db.exec(`
      ALTER TABLE strategy_jobs ADD COLUMN error_code TEXT;
      ALTER TABLE strategy_jobs ADD COLUMN public_error TEXT;
    `);
  });
}
