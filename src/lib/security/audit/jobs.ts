import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { log } from "@/lib/log";
import type { AuditJobEvent, AuditReport, AuditStage } from "@/types/audit";

/**
 * Audit job store. Mirrors `strategy-jobs.ts` — a verified-contract audit can
 * take 5-10 minutes (Slither + Aderyn + Mythril + on-chain probing + 25 ×
 * triple-AI explanations), so we run it as a background job and the client
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
const jobs = new Map<string, AuditJob>();

function persistJob(job: AuditJob): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_jobs (id, wallet_address, contract_address, chain_id, status, events_json, result_json, error, started_at, finished_at)
         VALUES (@id, @wallet, @contractAddress, @chainId, @status, @events, @result, @error, @startedAt, @finishedAt)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           events_json = excluded.events_json,
           result_json = excluded.result_json,
           error = excluded.error,
           finished_at = excluded.finished_at`,
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
  // A "running" row absent from memory means the in-process promise died
  // with the server — report it honestly instead of spinning forever.
  if (job.status === "running") {
    job.status = "error";
    job.error = "Review was interrupted by a server restart — start a new run.";
    job.finishedAt = Date.now();
    job.events.push({ ts: Date.now(), stage: "error", message: job.error });
    persistJob(job);
  }
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
    // Keep rows referenced by a share link regardless of age.
    getDb()
      .prepare(
        `DELETE FROM audit_jobs
         WHERE started_at < ?
           AND id NOT IN (SELECT job_id FROM audit_shares)`,
      )
      .run(now - DB_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  } catch {
    /* best effort */
  }
}

// Background sweep so abandoned audits don't accumulate audit reports
// (each ~100-500KB) when the polling client closes the tab.
const _pruneTimer = setInterval(pruneExpired, PRUNE_INTERVAL_MS);
if (typeof _pruneTimer.unref === "function") _pruneTimer.unref();

export function createAuditJob(wallet: string, contractAddress: string, chainId: number): AuditJob {
  pruneExpired();
  const job: AuditJob = {
    id: randomUUID(),
    wallet: wallet.toLowerCase(),
    contractAddress,
    chainId,
    status: "running",
    startedAt: Date.now(),
    events: [
      { ts: Date.now(), stage: "starting", message: "Starting contract review..." },
    ],
  };
  jobs.set(job.id, job);
  persistJob(job);
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
    return rowToJob(row);
  } catch {
    return undefined;
  }
}

export function emitAuditEvent(id: string, event: Omit<AuditJobEvent, "ts">): void {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return;
  job.events.push({ ...event, ts: Date.now() });
  if (job.events.length > 300) job.events.splice(0, job.events.length - 300);
  persistJob(job);
}

export function completeAuditJob(id: string, result: AuditReport): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "done";
  job.finishedAt = Date.now();
  job.result = result;
  job.events.push({ ts: Date.now(), stage: "done", message: "Review complete" });
  persistJob(job);
}

export function failAuditJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "error";
  job.finishedAt = Date.now();
  job.error = error;
  job.events.push({ ts: Date.now(), stage: "error", message: error });
  persistJob(job);
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
    .replace(/Triple-AI explainer/gi, "report review")
    .replace(/AI explainer/gi, "report review")
    .replace(/AI|Claude|Codex|Gemini/gi, "review")
    .replace(/tools?/gi, "checks")
    .replace(/pipeline/gi, "workflow");
}

export function publicAuditView(job: AuditJob): PublicAuditView {
  const last = job.events[job.events.length - 1];
  return {
    id: job.id,
    contractAddress: job.contractAddress,
    chainId: job.chainId,
    status: job.status,
    progress: computeProgress(job),
    stage: publicAuditStage(last?.stage ?? "starting"),
    message: publicAuditMessage(last?.message ?? "Working..."),
    sub: last?.sub,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    events: job.events.slice(-20).map((e) => ({
      ts: e.ts,
      stage: publicAuditStage(e.stage),
      message: publicAuditMessage(e.message),
      sub: e.sub,
    })),
    result: job.result,
    error: job.error ? publicAuditMessage(job.error) : undefined,
  };
}
