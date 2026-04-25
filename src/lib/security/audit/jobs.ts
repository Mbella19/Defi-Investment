import { randomUUID } from "crypto";
import type { AuditJobEvent, AuditReport, AuditStage } from "@/types/audit";

/**
 * In-memory audit job store. Mirrors `strategy-jobs.ts` — a verified-contract
 * audit can take 5-10 minutes (Slither + Aderyn + Mythril + on-chain probing
 * + 25 × triple-AI explanations), so we run it as a background job and the
 * client polls for progress.
 */

export interface AuditJob {
  id: string;
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
const jobs = new Map<string, AuditJob>();

function pruneExpired() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const cutoff = job.finishedAt ? JOB_TTL_MS : STUCK_TTL_MS;
    const ref = job.finishedAt ?? job.startedAt;
    if (now - ref > cutoff) jobs.delete(id);
  }
}

export function createAuditJob(contractAddress: string, chainId: number): AuditJob {
  pruneExpired();
  const job: AuditJob = {
    id: randomUUID(),
    contractAddress,
    chainId,
    status: "running",
    startedAt: Date.now(),
    events: [
      { ts: Date.now(), stage: "starting", message: "Starting multi-engine audit pipeline…" },
    ],
  };
  jobs.set(job.id, job);
  return job;
}

export function getAuditJob(id: string): AuditJob | undefined {
  pruneExpired();
  return jobs.get(id);
}

export function emitAuditEvent(id: string, event: Omit<AuditJobEvent, "ts">): void {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return;
  job.events.push({ ...event, ts: Date.now() });
  if (job.events.length > 300) job.events.splice(0, job.events.length - 300);
}

export function completeAuditJob(id: string, result: AuditReport): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "done";
  job.finishedAt = Date.now();
  job.result = result;
  job.events.push({ ts: Date.now(), stage: "done", message: "Audit complete" });
}

export function failAuditJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "error";
  job.finishedAt = Date.now();
  job.error = error;
  job.events.push({ ts: Date.now(), stage: "error", message: error });
}

const STAGE_RANGE: Record<AuditStage, [number, number]> = {
  starting: [0, 2],
  fetching_source: [2, 10],
  fetching_onchain: [10, 18],
  running_tools: [18, 60],
  ai_explanation: [60, 88],
  scsvs_mapping: [88, 92],
  consensus: [92, 96],
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
  stage: AuditStage;
  message: string;
  sub?: { done: number; total: number };
  elapsedMs: number;
  events: AuditJobEvent[];
  result?: AuditReport;
  error?: string;
}

export function publicAuditView(job: AuditJob): PublicAuditView {
  const last = job.events[job.events.length - 1];
  return {
    id: job.id,
    contractAddress: job.contractAddress,
    chainId: job.chainId,
    status: job.status,
    progress: computeProgress(job),
    stage: last?.stage ?? "starting",
    message: last?.message ?? "Working…",
    sub: last?.sub,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    events: job.events.slice(-20),
    result: job.result,
    error: job.error,
  };
}
