import { randomUUID } from "crypto";
import type { InvestmentStrategy } from "@/types/strategy";

export type JobStage =
  | "starting"
  | "fetching_data"
  | "filtering_pools"
  | "deep_analysis"
  | "claude_proposer"
  | "reviewers"
  | "claude_revision"
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
const jobs = new Map<string, StrategyJob>();

function pruneExpired() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const cutoff = job.finishedAt ? JOB_TTL_MS : STUCK_TTL_MS;
    const ref = job.finishedAt ?? job.startedAt;
    if (now - ref > cutoff) jobs.delete(id);
  }
}

// Background sweep: clients that close their tab leave abandoned jobs
// behind. The on-read prune above only fires when somebody else reads.
const _pruneTimer = setInterval(pruneExpired, PRUNE_INTERVAL_MS);
if (typeof _pruneTimer.unref === "function") _pruneTimer.unref();

export function createJob(): StrategyJob {
  pruneExpired();
  const job: StrategyJob = {
    id: randomUUID(),
    status: "running",
    startedAt: Date.now(),
    events: [
      { ts: Date.now(), stage: "starting", message: "Preparing allocation workflow..." },
    ],
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): StrategyJob | undefined {
  pruneExpired();
  return jobs.get(id);
}

export function emitEvent(id: string, event: Omit<JobEvent, "ts">): void {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return;
  job.events.push({ ...event, ts: Date.now() });
  if (job.events.length > 200) job.events.splice(0, job.events.length - 200);
}

export function completeJob(id: string, result: JobResult): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "done";
  job.finishedAt = Date.now();
  job.result = result;
  job.events.push({ ts: Date.now(), stage: "done", message: "Allocation ready" });
}

export function failJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "error";
  job.finishedAt = Date.now();
  job.error = error;
  job.events.push({ ts: Date.now(), stage: "error", message: error });
}

// Each stage maps to a contiguous slice of the 0..100 progress bar.
// Sub-progress (e.g. "8 of 10 protocols analyzed") interpolates within its slice.
const STAGE_RANGE: Record<JobStage, [number, number]> = {
  starting: [0, 2],
  fetching_data: [2, 8],
  filtering_pools: [8, 12],
  deep_analysis: [12, 50],
  claude_proposer: [50, 68],
  reviewers: [68, 82],
  claude_revision: [82, 96],
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
  claude_proposer: "creating_proposal",
  reviewers: "checking_proposal",
  claude_revision: "finalizing_proposal",
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
  return {
    id: job.id,
    status: job.status,
    progress: computeProgress(job),
    stage: publicStage(last?.stage ?? "starting"),
    message: publicMessage(last?.message ?? "Working..."),
    sub: last?.sub,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    events: job.events.slice(-12).map((e) => ({
      ts: e.ts,
      stage: publicStage(e.stage),
      message: publicMessage(e.message),
      sub: e.sub,
    })),
    result: job.result,
    error: job.error ? publicMessage(job.error) : undefined,
  };
}
