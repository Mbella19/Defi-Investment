import { extractJson } from "./extract-json";
import { invokeCodex } from "./codex-client";
import { invokeGemini } from "./gemini-client";

/**
 * The AI ensemble is two independent reasoners: Codex GPT-5.6 (sol) at xhigh
 * effort — the lead — and Gemini 3.6 Flash at high effort — the adversarial
 * cross-check. Same prompt to both in parallel; either failing does not abort
 * the other, so callers must handle partial results.
 */
export type AiSource = "codex" | "gemini";

export interface InvokeOptions {
  timeoutMs?: number;
}

export interface JsonInvokeOptions<T> extends InvokeOptions {
  /** Reject syntactically valid JSON that does not satisfy the caller's schema. */
  validate?: (value: unknown) => value is T;
}

export interface JsonInvocationResult<T> {
  value: T | null;
  error: string | null;
  retried: boolean;
  recovered: boolean;
}

export interface EnsembleJsonResult<T> {
  codex: T | null;
  gemini: T | null;
  errors: { source: AiSource; error: string }[];
  retriedSources: AiSource[];
  recoveredSources: AiSource[];
}

const STRICT_JSON_RETRY_INSTRUCTION = `FORMAT RECOVERY REQUIREMENT:
Your previous attempt was unavailable, incomplete, invalid JSON, or did not match the requested schema.
Return exactly one complete JSON object that follows the original schema and enum values.
Do not use Markdown fences, comments, ellipses, prose outside the object, or truncated fields.`;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function invokeSource(
  source: AiSource,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  return source === "codex"
    ? invokeCodex(prompt, { effort: "xhigh", timeoutMs })
    : invokeGemini(prompt, { reasoning: "high", timeoutMs });
}

function parseAndValidate<T>(
  text: string,
  validate?: (value: unknown) => value is T,
): T {
  const parsed = extractJson<unknown>(text);
  if (validate && !validate(parsed)) {
    throw new Error("Model JSON did not match the required schema");
  }
  return parsed as T;
}

/**
 * Invoke one provider for a JSON response. A failed invocation, malformed
 * response, or schema mismatch gets exactly one provider-local retry with a
 * strict format reminder. The other provider is never repeated needlessly.
 */
export async function invokeJsonWithRetry<T>(
  source: AiSource,
  prompt: string,
  opts: JsonInvokeOptions<T> = {},
): Promise<JsonInvocationResult<T>> {
  const timeoutMs = opts.timeoutMs ?? 360_000;
  let lastError = "Model response was unavailable";

  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\n${STRICT_JSON_RETRY_INSTRUCTION}`;
    try {
      const output = await invokeSource(source, attemptPrompt, timeoutMs);
      const value = parseAndValidate(output, opts.validate);
      return {
        value,
        error: null,
        retried: attempt > 0,
        recovered: attempt > 0,
      };
    } catch (error) {
      lastError = errorMessage(error);
    }
  }

  return {
    value: null,
    error: lastError,
    retried: true,
    recovered: false,
  };
}

/**
 * Run both independent reviewers in parallel and require usable JSON from
 * each. Only a provider that fails or returns invalid output is retried.
 */
export async function ensembleInvokeJson<T>(
  prompt: string,
  opts: JsonInvokeOptions<T> = {},
): Promise<EnsembleJsonResult<T>> {
  const [codex, gemini] = await Promise.all([
    invokeJsonWithRetry<T>("codex", prompt, opts),
    invokeJsonWithRetry<T>("gemini", prompt, opts),
  ]);
  const errors: EnsembleJsonResult<T>["errors"] = [];
  const retriedSources: AiSource[] = [];
  const recoveredSources: AiSource[] = [];

  for (const [source, result] of [
    ["codex", codex],
    ["gemini", gemini],
  ] as const) {
    if (result.retried) retriedSources.push(source);
    if (result.recovered) recoveredSources.push(source);
    if (result.error) errors.push({ source, error: result.error });
  }

  return {
    codex: codex.value,
    gemini: gemini.value,
    errors,
    retriedSources,
    recoveredSources,
  };
}
