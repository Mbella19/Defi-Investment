import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { log } from "@/lib/log";
import type { InvestmentStrategy, StrategyCriteria } from "@/types/strategy";

export type JobStage =
  | "starting"
  | "fetching_data"
  | "filtering_pools"
  | "deep_analysis"
  | "lead_proposer"
  | "reviewers"
  | "lead_revision"
  | "finalizing"
  | "done"
  | "error";

export interface JobEvent {
  ts: number;
  stage: JobStage;
  message: string;
  sub?: { done: number; total: number };
}

export interface JobResult {
  strategy: InvestmentStrategy;
  poolsScanned: number;
  protocolsAnalyzed: number;
  protocolsDeepAnalyzed: number;
}

export interface StrategyJob {
  id: string;
  /** Lowercase wallet that started the job — job reads are scoped to it. */
  wallet: string;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  events: JobEvent[];
  result?: JobResult;
  error?: string;
}

const JOB_TTL_MS = 30 * 60 * 1000;
const STUCK_TTL_MS = 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const DB_RETENTION_DAYS = 7;
const PERSISTED_EVENTS = 50;
const LEASE_MS = 20 * 60 * 1000;
const jobs = new Map<string, StrategyJob>();

export interface StrategyJobPayload {
  criteria: StrategyCriteria;
  mode: "solo" | "dual" | "council";
}

/* ---------- SQLite write-through ----------
 * The Map stays the hot path; the DB copy makes results survive restarts
 * and closed tabs. Persistence is best-effort — a DB hiccup must never
 * break the in-flight pipeline. */

function persistJob(job: StrategyJob): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO strategy_jobs
           (id, wallet_address, status, events_json, result_json, error, started_at, finished_at,
            heartbeat_at, updated_at)
         VALUES (@id, @wallet, @status, @events, @result, @error, @startedAt, @finishedAt,
                 @now, @now)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           events_json = excluded.events_json,
           result_json = excluded.result_json,
           error = excluded.error,
           finished_at = excluded.finished_at,
           heartbeat_at = excluded.heartbeat_at,
           updated_at = excluded.updated_at,
           lease_expires_at = CASE
             WHEN excluded.status = 'running' THEN MAX(COALESCE(strategy_jobs.lease_expires_at, 0), @leaseUntil)
             ELSE NULL
           END,
           lease_owner = CASE WHEN excluded.status = 'running' THEN strategy_jobs.lease_owner ELSE NULL END`,
      )
      .run({
        id: job.id,
        wallet: job.wallet,
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
    log.warn("strategy-jobs", "persist failed", {
      jobId: job.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

interface JobRow {
  id: string;
  wallet_address: string;
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

function rowToJob(row: JobRow): StrategyJob {
  let events: JobEvent[] = [];
  try {
    const parsed = JSON.parse(row.events_json);
    if (Array.isArray(parsed)) events = parsed as JobEvent[];
  } catch {
    /* keep empty */
  }
  let result: JobResult | undefined;
  if (row.result_json) {
    try {
      result = JSON.parse(row.result_json) as JobResult;
    } catch {
      /* corrupt result — treat as absent */
    }
  }
  const job: StrategyJob = {
    id: row.id,
    wallet: row.wallet_address,
    status: row.status as StrategyJob["status"],
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
    getDb()
      .prepare("DELETE FROM strategy_jobs WHERE status IN ('done', 'error') AND started_at < ?")
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
      `SELECT id FROM strategy_jobs
       WHERE status = 'running' AND attempts >= max_attempts
         AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
    )
    .all(now) as Array<{ id: string }>;
  if (exhausted.length === 0) return;
  const update = db.prepare(
    `UPDATE strategy_jobs
     SET status = 'error', error = ?, finished_at = ?, lease_owner = NULL,
         lease_expires_at = NULL, heartbeat_at = ?, updated_at = ?
     WHERE id = ? AND status = 'running' AND attempts >= max_attempts
       AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
  );
  db.transaction(() => {
    for (const { id } of exhausted) {
      const message = "Job was interrupted before completion and exhausted automatic recovery";
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

// Background sweep: clients that close their tab leave abandoned jobs
// behind. The on-read prune above only fires when somebody else reads.
const _pruneTimer = setInterval(pruneExpired, PRUNE_INTERVAL_MS);
if (typeof _pruneTimer.unref === "function") _pruneTimer.unref();

function normalizeIdempotencyKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^[A-Za-z0-9._:-]{8,128}$/.test(trimmed) ? trimmed : null;
}

export function getJobByIdempotency(
  wallet: string,
  key: string | null | undefined,
): StrategyJob | undefined {
  const normalized = normalizeIdempotencyKey(key);
  if (!normalized) return undefined;
  const row = getDb()
    .prepare("SELECT * FROM strategy_jobs WHERE wallet_address = ? AND idempotency_key = ?")
    .get(wallet.toLowerCase(), normalized) as JobRow | undefined;
  if (!row) return undefined;
  const job = rowToJob(row);
  jobs.set(job.id, job);
  return job;
}

export function createJob(
  wallet: string,
  payload: StrategyJobPayload,
  idempotencyKey?: string | null,
  jobId?: string,
): StrategyJob {
  pruneExpired();
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const existing = getJobByIdempotency(wallet, normalizedKey);
  if (existing) return existing;
  const now = Date.now();
  const job: StrategyJob = {
    id: jobId ?? randomUUID(),
    wallet: wallet.toLowerCase(),
    status: "running",
    startedAt: now,
    events: [
      { ts: now, stage: "starting", message: "Preparing allocation workflow..." },
    ],
  };
  const inserted = getDb()
    .prepare(
      `INSERT OR IGNORE INTO strategy_jobs
         (id, wallet_address, status, events_json, started_at, payload_json,
          attempts, max_attempts, available_at, idempotency_key, updated_at)
       VALUES (?, ?, 'running', ?, ?, ?, 0, 2, ?, ?, ?)`,
    )
    .run(
      job.id,
      job.wallet,
      JSON.stringify(job.events),
      now,
      JSON.stringify(payload),
      now,
      normalizedKey,
      now,
    );
  if (inserted.changes !== 1) {
    const raced = getJobByIdempotency(wallet, normalizedKey);
    if (raced) return raced;
    throw new Error("Could not create strategy job");
  }
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): StrategyJob | undefined {
  pruneExpired();
  const inMemory = jobs.get(id);
  if (inMemory) return inMemory;
  // Fall back to the durable copy (finished before a restart, or aged out of
  // the in-memory TTL while the user kept the tab open).
  try {
    const row = getDb()
      .prepare("SELECT * FROM strategy_jobs WHERE id = ?")
      .get(id) as JobRow | undefined;
    if (!row) return undefined;
    const job = rowToJob(row);
    jobs.set(job.id, job);
    return job;
  } catch {
    return undefined;
  }
}

export function getStrategyJobPayload(id: string): StrategyJobPayload | undefined {
  const row = getDb()
    .prepare("SELECT payload_json FROM strategy_jobs WHERE id = ?")
    .get(id) as { payload_json: string | null } | undefined;
  if (!row?.payload_json) return undefined;
  try {
    return JSON.parse(row.payload_json) as StrategyJobPayload;
  } catch {
    return undefined;
  }
}

export function emitEvent(id: string, event: Omit<JobEvent, "ts">): void {
  const job = jobs.get(id) ?? getJob(id);
  if (!job || job.status !== "running") return;
  job.events.push({ ...event, ts: Date.now() });
  if (job.events.length > 200) job.events.splice(0, job.events.length - 200);
  persistJob(job);
}

export function completeJob(id: string, result: JobResult): void {
  const job = jobs.get(id) ?? getJob(id);
  if (!job) return;
  job.status = "done";
  job.finishedAt = Date.now();
  job.result = result;
  job.events.push({ ts: Date.now(), stage: "done", message: "Allocation ready" });
  persistJob(job);
}

export function failJob(id: string, error: string): void {
  const job = jobs.get(id) ?? getJob(id);
  if (!job) return;
  job.status = "error";
  job.finishedAt = Date.now();
  job.error = error;
  job.events.push({ ts: Date.now(), stage: "error", message: error });
  persistJob(job);
}

export function claimNextStrategyJob(
  workerId: string,
): { job: StrategyJob; payload: StrategyJobPayload } | null {
  failExhaustedLeases();
  const db = getDb();
  const now = Date.now();
  const row = db.transaction(() => {
    const candidate = db
      .prepare(
        `SELECT id FROM strategy_jobs
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
        `UPDATE strategy_jobs
         SET lease_owner = ?, lease_expires_at = ?, heartbeat_at = ?,
             attempts = attempts + 1, updated_at = ?
         WHERE id = ? AND status = 'running'
           AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
      )
      .run(workerId, now + LEASE_MS, now, now, candidate.id, now);
    if (claimed.changes !== 1) return undefined;
    return db.prepare("SELECT * FROM strategy_jobs WHERE id = ?").get(candidate.id) as JobRow;
  })();
  if (!row?.payload_json) return null;
  let payload: StrategyJobPayload;
  try {
    payload = JSON.parse(row.payload_json) as StrategyJobPayload;
  } catch {
    const job = rowToJob(row);
    jobs.set(job.id, job);
    failJob(job.id, "Stored job input is invalid");
    return null;
  }
  const job = rowToJob(row);
  jobs.set(job.id, job);
  return { job, payload };
}

export function retryStrategyJob(id: string, error: string, delayMs = 30_000): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT attempts, max_attempts FROM strategy_jobs WHERE id = ?")
    .get(id) as { attempts: number; max_attempts: number } | undefined;
  if (!row || row.attempts >= row.max_attempts) {
    failJob(id, error);
    return false;
  }
  const job = jobs.get(id) ?? getJob(id);
  if (!job) return false;
  job.events.push({
    ts: Date.now(),
    stage: "starting",
    message: "A temporary failure interrupted the run; retrying automatically...",
  });
  if (job.events.length > 200) job.events.splice(0, job.events.length - 200);
  const now = Date.now();
  db.prepare(
    `UPDATE strategy_jobs
     SET events_json = ?, error = NULL, available_at = ?, lease_owner = NULL,
         lease_expires_at = NULL, heartbeat_at = ?, updated_at = ?
     WHERE id = ? AND status = 'running'`,
  ).run(JSON.stringify(job.events.slice(-PERSISTED_EVENTS)), now + delayMs, now, now, id);
  return true;
}

// Each stage maps to a contiguous slice of the 0..100 progress bar.
// Sub-progress (e.g. "8 of 10 protocols analyzed") interpolates within its slice.
const STAGE_RANGE: Record<JobStage, [number, number]> = {
  starting: [0, 2],
  fetching_data: [2, 8],
  filtering_pools: [8, 12],
  deep_analysis: [12, 50],
  lead_proposer: [50, 68],
  reviewers: [68, 82],
  lead_revision: [82, 96],
  finalizing: [96, 99],
  done: [100, 100],
  error: [100, 100],
};

function computeProgress(job: StrategyJob): number {
  if (job.status === "done") return 100;
  const last = job.events[job.events.length - 1];
  if (!last) return 0;
  const [lo, hi] = STAGE_RANGE[last.stage] ?? [0, 100];
  if (last.sub && last.sub.total > 0) {
    return Math.round(lo + (hi - lo) * (last.sub.done / last.sub.total));
  }
  return lo;
}

export interface PublicJobView {
  id: string;
  status: StrategyJob["status"];
  progress: number;
  stage: string;
  message: string;
  sub?: { done: number; total: number };
  elapsedMs: number;
  events: Array<{ ts: number; stage: string; message: string; sub?: { done: number; total: number } }>;
  result?: JobResult;
  error?: string;
}

const PUBLIC_STAGE: Record<JobStage, string> = {
  starting: "preparing",
  fetching_data: "reading_markets",
  filtering_pools: "selecting_markets",
  deep_analysis: "reviewing_markets",
  lead_proposer: "creating_proposal",
  reviewers: "checking_proposal",
  lead_revision: "finalizing_proposal",
  finalizing: "finalizing",
  done: "complete",
  error: "error",
};

function publicStage(stage: JobStage): string {
  return PUBLIC_STAGE[stage] ?? "working";
}

function publicMessage(message: string): string {
  return message
    .replace(/yield feed/gi, "market feed")
    .replace(/yield pools?/gi, "markets")
    .replace(/pools?/gi, "markets")
    .replace(/protocols?/gi, "markets")
    .replace(/ground-truth checks, AI scoring, synthesis, and heuristic vetoes/gi, "risk context")
    .replace(/AI|Claude|Codex|Gemini/gi, "review")
    .replace(/strategy pipeline/gi, "allocation workflow")
    .replace(/strategy/gi, "allocation")
    .replace(/architect/gi, "proposal")
    .replace(/reviewers?/gi, "review")
    .replace(/collaboration trail/gi, "proposal details")
    .replace(/pipeline/gi, "workflow");
}

export function publicView(job: StrategyJob): PublicJobView {
  const last = job.events[job.events.length - 1];
  const failureMessage = "Allocation generation failed after automatic retry. Please try again shortly.";
  return {
    id: job.id,
    status: job.status,
    progress: computeProgress(job),
    stage: publicStage(last?.stage ?? "starting"),
    message: job.status === "error" ? failureMessage : publicMessage(last?.message ?? "Working..."),
    sub: last?.sub,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    events: job.events.slice(-12).map((e) => ({
      ts: e.ts,
      stage: publicStage(e.stage),
      message: e.stage === "error" ? failureMessage : publicMessage(e.message),
      sub: e.sub,
    })),
    result: job.result,
    error: job.error ? failureMessage : undefined,
  };
}
