import "server-only";
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { log } from "@/lib/log";

export interface AiUsageContext {
  wallet?: string;
  jobId?: string;
  operation: string;
}

const contextStore = new AsyncLocalStorage<AiUsageContext>();
const TELEMETRY_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
const TELEMETRY_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastPrunedAt = 0;

export function withAiUsageContext<T>(
  context: AiUsageContext,
  run: () => Promise<T>,
): Promise<T> {
  return contextStore.run(context, run);
}

function tokenEstimate(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function nonNegativeEnv(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function estimateCost(
  provider: "openai" | "gemini",
  inputTokens: number,
  outputTokens: number,
): number | null {
  const prefix = provider === "openai" ? "OPENAI" : "GEMINI";
  const inputRate = nonNegativeEnv(`${prefix}_INPUT_USD_PER_MILLION`);
  const outputRate = nonNegativeEnv(`${prefix}_OUTPUT_USD_PER_MILLION`);
  if (inputRate === null || outputRate === null) return null;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

export async function trackAiInvocation(params: {
  provider: "openai" | "gemini";
  model: string;
  prompt: string;
  run: () => Promise<string>;
}): Promise<string> {
  const startedAt = Date.now();
  const inputTokens = tokenEstimate(params.prompt);
  let outputTokens = 0;
  let success = false;
  try {
    const output = await params.run();
    outputTokens = tokenEstimate(output);
    success = true;
    return output;
  } finally {
    const context = contextStore.getStore();
    try {
      const db = getDb();
      db
        .prepare(
          `INSERT INTO ai_usage_events
             (id, wallet_address, job_id, provider, model, operation,
              input_tokens, output_tokens, estimated_cost_usd, duration_ms,
              cache_hit, success, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .run(
          randomUUID(),
          context?.wallet?.toLowerCase() ?? null,
          context?.jobId ?? null,
          params.provider,
          params.model,
          context?.operation ?? "unscoped",
          inputTokens,
          outputTokens,
          estimateCost(params.provider, inputTokens, outputTokens),
          Date.now() - startedAt,
          success ? 1 : 0,
          Date.now(),
        );
      const now = Date.now();
      if (now - lastPrunedAt >= TELEMETRY_PRUNE_INTERVAL_MS) {
        db.prepare("DELETE FROM ai_usage_events WHERE created_at < ?")
          .run(now - TELEMETRY_RETENTION_MS);
        lastPrunedAt = now;
      }
    } catch (error) {
      log.warn("ai-telemetry", "usage event persistence failed", {
        provider: params.provider,
        model: params.model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
