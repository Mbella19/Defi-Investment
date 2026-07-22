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

type OkOrErr = { ok: true; text: string } | { ok: false; error: string };

export interface EnsembleRawResult {
  codex: OkOrErr;
  gemini: OkOrErr;
}

export interface InvokeOptions {
  timeoutMs?: number;
}

function settleToOkErr(res: PromiseSettledResult<string>): OkOrErr {
  if (res.status === "fulfilled") return { ok: true, text: res.value };
  const error = res.reason instanceof Error ? res.reason.message : String(res.reason);
  return { ok: false, error };
}

/**
 * Run the same prompt through Codex GPT-5.6 (sol, xhigh) and Gemini 3.6 Flash
 * (high) in parallel. Either model failing does not abort the other.
 */
export async function ensembleInvoke(
  prompt: string,
  opts: InvokeOptions = {},
): Promise<EnsembleRawResult> {
  const timeoutMs = opts.timeoutMs ?? 360_000;

  const [codexRes, geminiRes] = await Promise.allSettled([
    invokeCodex(prompt, { effort: "xhigh", timeoutMs }),
    invokeGemini(prompt, { reasoning: "high", timeoutMs }),
  ]);

  return {
    codex: settleToOkErr(codexRes),
    gemini: settleToOkErr(geminiRes),
  };
}

/**
 * Parse each model's output as JSON. Returns nulls for models that failed or
 * produced unparseable output, with the error captured in `errors`.
 */
export function ensembleExtractJson<T = unknown>(raw: EnsembleRawResult): {
  codex: T | null;
  gemini: T | null;
  errors: { source: AiSource; error: string }[];
} {
  const errors: { source: AiSource; error: string }[] = [];
  const extract = (source: AiSource, r: OkOrErr): T | null => {
    if (!r.ok) {
      errors.push({ source, error: r.error });
      return null;
    }
    try {
      return extractJson<T>(r.text);
    } catch (err) {
      errors.push({ source, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  };

  return {
    codex: extract("codex", raw.codex),
    gemini: extract("gemini", raw.gemini),
    errors,
  };
}
