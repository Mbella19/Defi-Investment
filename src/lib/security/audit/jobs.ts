import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { log } from "@/lib/log";
import type { AuditJobEvent, AuditReport, AuditStage } from "@/types/audit";

/**
 * Audit job store. Mirrors `strategy-jobs.ts` — a verified-contract audit can
 * take 5-10 minutes (Slither + Aderyn + Mythril + on-chain probing + 25 ×
 * ensemble explanations), so we run it as a background job and the client
 * polls for progress. The in-memory Map is the hot path; every mutation is
 * written through to SQLite so a finished report survives restarts and the
 * share feature can serve it later.
 */

export interface AuditJob {
  id: string;
  /** Lowercase wallet that started the job — job reads are scoped to it. */
  wallet: string;
  contractAddress: string;
  chainId: number;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  events: AuditJobEvent[];
  result?: AuditReport;
  error?: string;
}

const JOB_TTL_MS = 60 * 60 * 1000; // 1h after completion
const STUCK_TTL_MS = 90 * 60 * 1000; // 1.5h before pruning a stuck job
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
const DB_RETENTION_DAYS = 30; // reports back share links — keep longer than strategy jobs
const PERSISTED_EVENTS = 50;
const LEASE_MS = 20 * 60 * 1000;
const jobs = new Map<string, AuditJob>();

export interface AuditJobPayload {
  contractAddress: string;
  chainId: number;
}

function persistJob(job: AuditJob): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_jobs
           (id, wallet_address, contract_address, chain_id, status, events_json,
            result_json, error, started_at, finished_at, heartbeat_at, updated_at)
         VALUES (@id, @wallet, @contractAddress, @chainId, @status, @events,
                 @result, @error, @startedAt, @finishedAt, @now, @now)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           events_json = excluded.events_json,
           result_json = excluded.result_json,
           error = excluded.error,
           finished_at = excluded.finished_at,
           heartbeat_at = excluded.heartbeat_at,
           updated_at = excluded.updated_at,
           lease_expires_at = CASE
             WHEN excluded.status = 'running' THEN MAX(COALESCE(audit_jobs.lease_expires_at, 0), @leaseUntil)
             ELSE NULL
           END,
           lease_owner = CASE WHEN excluded.status = 'running' THEN audit_jobs.lease_owner ELSE NULL END`,
      )
      .run({
        id: job.id,
        wallet: job.wallet,
        contractAddress: job.contractAddress,
        chainId: job.chainId,
        status: job.status,
        events: JSON.stringify(job.events.slice(-PERSISTED_EVENTS)),
        result: job.result ? JSON.stringify(job.result) : null,
        error: job.error ?? null,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt ?? null,
        now: Date.now(),
        leaseUntil: Date.now() + LEASE_MS,
      });
  } catch (err) {
    log.warn("audit-jobs", "persist failed", {
      jobId: job.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

interface AuditJobRow {
  id: string;
  wallet_address: string;
  contract_address: string;
  chain_id: number;
  status: string;
  events_json: string;
  result_json: string | null;
  error: string | null;
  started_at: number;
  finished_at: number | null;
  payload_json: string | null;
  attempts: number;
  max_attempts: number;
  idempotency_key: string | null;
}

function rowToJob(row: AuditJobRow): AuditJob {
  let events: AuditJobEvent[] = [];
  try {
    const parsed = JSON.parse(row.events_json);
    if (Array.isArray(parsed)) events = parsed as AuditJobEvent[];
  } catch {
    /* keep empty */
  }
  let result: AuditReport | undefined;
  if (row.result_json) {
    try {
      result = JSON.parse(row.result_json) as AuditReport;
    } catch {
      /* corrupt result — treat as absent */
    }
  }
  const job: AuditJob = {
    id: row.id,
    wallet: row.wallet_address,
    contractAddress: row.contract_address,
    chainId: row.chain_id,
    status: row.status as AuditJob["status"],
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    events,
    result,
    error: row.error ?? undefined,
  };
  return job;
}

function pruneExpired() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const cutoff = job.finishedAt ? JOB_TTL_MS : STUCK_TTL_MS;
    const ref = job.finishedAt ?? job.startedAt;
    if (now - ref > cutoff) jobs.delete(id);
  }
  try {
    // Keep rows referenced by a currently active share link. Expired or
    // revoked public links must not pin large reports forever.
    const db = getDb();
    db.prepare(
      `DELETE FROM audit_shares
       WHERE datetime(expires_at) <= datetime('now')
          OR (revoked_at IS NOT NULL AND datetime(revoked_at) <= datetime('now', '-30 days'))`,
    ).run();
    db
      .prepare(
        `DELETE FROM audit_jobs
         WHERE status IN ('done', 'error')
           AND started_at < ?
           AND id NOT IN (
             SELECT job_id FROM audit_shares
             WHERE revoked_at IS NULL AND datetime(expires_at) > datetime('now')
           )`,
      )
      .run(now - DB_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  } catch {
    /* best effort */
  }
}

function failExhaustedLeases(): void {
  const now = Date.now();
  const db = getDb();
  const exhausted = db
    .prepare(
      `SELECT id FROM audit_jobs
       WHERE status = 'running' AND attempts >= max_attempts
         AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
    )
    .all(now) as Array<{ id: string }>;
  if (exhausted.length === 0) return;
  const update = db.prepare(
    `UPDATE audit_jobs
     SET status = 'error', error = ?, finished_at = ?, lease_owner = NULL,
         lease_expires_at = NULL, heartbeat_at = ?, updated_at = ?
     WHERE id = ? AND status = 'running' AND attempts >= max_attempts
       AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
  );
  db.transaction(() => {
    for (const { id } of exhausted) {
      const message = "Review was interrupted before completion and exhausted automatic recovery";
      const result = update.run(message, now, now, now, id, now);
      if (result.changes !== 1) continue;
      const cached = jobs.get(id);
      if (cached) {
        cached.status = "error";
        cached.error = message;
        cached.finishedAt = now;
        cached.events.push({ ts: now, stage: "error", message });
      }
    }
  })();
}

// Background sweep so abandoned audits don't accumulate audit reports
// (each ~100-500KB) when the polling client closes the tab.
const _pruneTimer = setInterval(pruneExpired, PRUNE_INTERVAL_MS);
if (typeof _pruneTimer.unref === "function") _pruneTimer.unref();

function normalizeIdempotencyKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^[A-Za-z0-9._:-]{8,128}$/.test(trimmed) ? trimmed : null;
}

export function getAuditJobByIdempotency(
  wallet: string,
  key: string | null | undefined,
): AuditJob | undefined {
  const normalized = normalizeIdempotencyKey(key);
  if (!normalized) return undefined;
  const row = getDb()
    .prepare("SELECT * FROM audit_jobs WHERE wallet_address = ? AND idempotency_key = ?")
    .get(wallet.toLowerCase(), normalized) as AuditJobRow | undefined;
  if (!row) return undefined;
  const job = rowToJob(row);
  jobs.set(job.id, job);
  return job;
}

export function createAuditJob(
  wallet: string,
  contractAddress: string,
  chainId: number,
  idempotencyKey?: string | null,
  jobId?: string,
): AuditJob {
  pruneExpired();
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const existing = getAuditJobByIdempotency(wallet, normalizedKey);
  if (existing) return existing;
  const now = Date.now();
  const job: AuditJob = {
    id: jobId ?? randomUUID(),
    wallet: wallet.toLowerCase(),
    contractAddress: contractAddress.toLowerCase(),
    chainId,
    status: "running",
    startedAt: now,
    events: [
      { ts: now, stage: "starting", message: "Starting contract review..." },
    ],
  };
  const inserted = getDb()
    .prepare(
      `INSERT OR IGNORE INTO audit_jobs
         (id, wallet_address, contract_address, chain_id, status, events_json,
          started_at, payload_json, attempts, max_attempts, available_at,
          idempotency_key, updated_at)
       VALUES (?, ?, ?, ?, 'running', ?, ?, ?, 0, 2, ?, ?, ?)`,
    )
    .run(
      job.id,
      job.wallet,
      job.contractAddress,
      job.chainId,
      JSON.stringify(job.events),
      now,
      JSON.stringify({ contractAddress: job.contractAddress, chainId: job.chainId }),
      now,
      normalizedKey,
      now,
    );
  if (inserted.changes !== 1) {
    const raced = getAuditJobByIdempotency(wallet, normalizedKey);
    if (raced) return raced;
    throw new Error("Could not create audit job");
  }
  jobs.set(job.id, job);
  return job;
}

export function getAuditJob(id: string): AuditJob | undefined {
  pruneExpired();
  const inMemory = jobs.get(id);
  if (inMemory) return inMemory;
  try {
    const row = getDb()
      .prepare("SELECT * FROM audit_jobs WHERE id = ?")
      .get(id) as AuditJobRow | undefined;
    if (!row) return undefined;
    const job = rowToJob(row);
    jobs.set(job.id, job);
    return job;
  } catch {
    return undefined;
  }
}

export function emitAuditEvent(id: string, event: Omit<AuditJobEvent, "ts">): void {
  const job = jobs.get(id) ?? getAuditJob(id);
  if (!job || job.status !== "running") return;
  job.events.push({ ...event, ts: Date.now() });
  if (job.events.length > 300) job.events.splice(0, job.events.length - 300);
  persistJob(job);
}

export function completeAuditJob(id: string, result: AuditReport): void {
  const job = jobs.get(id) ?? getAuditJob(id);
  if (!job) return;
  job.status = "done";
  job.finishedAt = Date.now();
  job.result = result;
  job.events.push({ ts: Date.now(), stage: "done", message: "Review complete" });
  persistJob(job);
}

export function failAuditJob(id: string, error: string): void {
  const job = jobs.get(id) ?? getAuditJob(id);
  if (!job) return;
  job.status = "error";
  job.finishedAt = Date.now();
  job.error = error;
  job.events.push({ ts: Date.now(), stage: "error", message: error });
  persistJob(job);
}

export function claimNextAuditJob(
  workerId: string,
): { job: AuditJob; payload: AuditJobPayload } | null {
  failExhaustedLeases();
  const db = getDb();
  const now = Date.now();
  const row = db.transaction(() => {
    const candidate = db
      .prepare(
        `SELECT id FROM audit_jobs
         WHERE status = 'running' AND payload_json IS NOT NULL
           AND attempts < max_attempts
           AND COALESCE(available_at, 0) <= ?
           AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
         ORDER BY started_at ASC
         LIMIT 1`,
      )
      .get(now, now) as { id: string } | undefined;
    if (!candidate) return undefined;
    const claimed = db
      .prepare(
        `UPDATE audit_jobs
         SET lease_owner = ?, lease_expires_at = ?, heartbeat_at = ?,
             attempts = attempts + 1, updated_at = ?
         WHERE id = ? AND status = 'running'
           AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
      )
      .run(workerId, now + LEASE_MS, now, now, candidate.id, now);
    if (claimed.changes !== 1) return undefined;
    return db.prepare("SELECT * FROM audit_jobs WHERE id = ?").get(candidate.id) as AuditJobRow;
  })();
  if (!row?.payload_json) return null;
  let payload: AuditJobPayload;
  try {
    payload = JSON.parse(row.payload_json) as AuditJobPayload;
  } catch {
    const job = rowToJob(row);
    jobs.set(job.id, job);
    failAuditJob(job.id, "Stored review input is invalid");
    return null;
  }
  const job = rowToJob(row);
  jobs.set(job.id, job);
  return { job, payload };
}

export function retryAuditJob(id: string, error: string, delayMs = 30_000): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT attempts, max_attempts FROM audit_jobs WHERE id = ?")
    .get(id) as { attempts: number; max_attempts: number } | undefined;
  if (!row || row.attempts >= row.max_attempts) {
    failAuditJob(id, error);
    return false;
  }
  const job = jobs.get(id) ?? getAuditJob(id);
  if (!job) return false;
  job.events.push({
    ts: Date.now(),
    stage: "starting",
    message: "A temporary failure interrupted the review; retrying automatically...",
  });
  if (job.events.length > 300) job.events.splice(0, job.events.length - 300);
  const now = Date.now();
  db.prepare(
    `UPDATE audit_jobs
     SET events_json = ?, error = NULL, available_at = ?, lease_owner = NULL,
         lease_expires_at = NULL, heartbeat_at = ?, updated_at = ?
     WHERE id = ? AND status = 'running'`,
  ).run(JSON.stringify(job.events.slice(-PERSISTED_EVENTS)), now + delayMs, now, now, id);
  return true;
}

// Ranges must reflect the actual emit order in audit/orchestrator.ts:
//   starting → fetching_source → fetching_onchain → running_tools
//   → consensus → ai_explanation → scsvs_mapping → assembling_report → done
// Previous ordering put consensus at 92–96 but the orchestrator emits it
// before ai_explanation, so the bar jumped 92% then dropped to 60%. Fixed.
const STAGE_RANGE: Record<AuditStage, [number, number]> = {
  starting: [0, 2],
  fetching_source: [2, 10],
  fetching_onchain: [10, 18],
  running_tools: [18, 56],
  consensus: [56, 60],
  ai_explanation: [60, 92],
  scsvs_mapping: [92, 96],
  assembling_report: [96, 99],
  done: [100, 100],
  error: [100, 100],
};

function computeProgress(job: AuditJob): number {
  if (job.status === "done") return 100;
  const last = job.events[job.events.length - 1];
  if (!last) return 0;
  const [lo, hi] = STAGE_RANGE[last.stage] ?? [0, 100];
  if (last.sub && last.sub.total > 0) {
    return Math.round(lo + (hi - lo) * (last.sub.done / last.sub.total));
  }
  return lo;
}

export interface PublicAuditView {
  id: string;
  contractAddress: string;
  chainId: number;
  status: AuditJob["status"];
  progress: number;
  stage: string;
  message: string;
  sub?: { done: number; total: number };
  elapsedMs: number;
  events: Array<{ ts: number; stage: string; message: string; sub?: { done: number; total: number } }>;
  result?: AuditReport;
  error?: string;
}

const PUBLIC_AUDIT_STAGE: Record<AuditStage, string> = {
  starting: "starting_review",
  fetching_source: "collecting_context",
  fetching_onchain: "reading_live_state",
  running_tools: "reviewing_coverage",
  consensus: "prioritizing_findings",
  ai_explanation: "preparing_summary",
  scsvs_mapping: "mapping_standards",
  assembling_report: "preparing_report",
  done: "complete",
  error: "error",
};

function publicAuditStage(stage: AuditStage): string {
  return PUBLIC_AUDIT_STAGE[stage] ?? "working";
}

function publicAuditMessage(message: string): string {
  return message
    .replace(/multi-engine audit pipeline/gi, "contract review")
    .replace(/audit pipeline/gi, "contract review")
    .replace(/audit/gi, "review")
    .replace(/Slither|Aderyn|Mythril/gi, "coverage")
    .replace(/static & symbolic analyzers/gi, "risk checks")
    .replace(/Ensemble explainer/gi, "report review")
    .replace(/AI explainer/gi, "report review")
    .replace(/AI|Claude|Codex|Gemini/gi, "review")
    .replace(/tools?/gi, "checks")
    .replace(/pipeline/gi, "workflow");
}

export function publicAuditView(job: AuditJob): PublicAuditView {
  const last = job.events[job.events.length - 1];
  const failureMessage = "Contract review failed after automatic retry. Please try again shortly.";
  return {
    id: job.id,
    contractAddress: job.contractAddress,
    chainId: job.chainId,
    status: job.status,
    progress: computeProgress(job),
    stage: publicAuditStage(last?.stage ?? "starting"),
    message: job.status === "error"
      ? failureMessage
      : publicAuditMessage(last?.message ?? "Working..."),
    sub: last?.sub,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    events: job.events.slice(-20).map((e) => ({
      ts: e.ts,
      stage: publicAuditStage(e.stage),
      message: e.stage === "error" ? failureMessage : publicAuditMessage(e.message),
      sub: e.sub,
    })),
    result: job.result,
    error: job.error ? failureMessage : undefined,
  };
}
