import { invokeClaude, extractJson } from "./claude-client";
import { invokeCodex } from "./codex-client";
import { invokeGemini } from "./gemini-client";

export type AiSource = "claude" | "codex" | "gemini";

type OkOrErr = { ok: true; text: string } | { ok: false; error: string };

export interface TripleRawResult {
  claude: OkOrErr;
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
 * Run the same prompt through Claude Opus 4.7 (max), Codex GPT-5.5 (xhigh),
 * and Gemini 3.1 Pro Preview in parallel. Any model failing does not abort
 * the others — callers must handle partial results.
 */
export async function tripleInvoke(prompt: string, opts: InvokeOptions = {}): Promise<TripleRawResult> {
  const timeoutMs = opts.timeoutMs ?? 360_000;

  const [claudeRes, codexRes, geminiRes] = await Promise.allSettled([
    invokeClaude(prompt, { effort: "max", timeoutMs }),
    invokeCodex(prompt, { timeoutMs }),
    invokeGemini(prompt, { timeoutMs }),
  ]);

  return {
    claude: settleToOkErr(claudeRes),
    codex: settleToOkErr(codexRes),
    gemini: settleToOkErr(geminiRes),
  };
}

/**
 * Parse each model's output as JSON. Returns nulls for models that failed or
 * produced unparseable output, with the error captured in `errors`.
 */
export function tripleExtractJson<T = unknown>(raw: TripleRawResult): {
  claude: T | null;
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
    claude: extract("claude", raw.claude),
    codex: extract("codex", raw.codex),
    gemini: extract("gemini", raw.gemini),
    errors,
  };
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

/** Pick the highest severity string. Case-insensitive. Accepts any number of inputs. */
export function maxSeverity<S extends string>(...severities: S[]): S {
  if (severities.length === 0) return "" as S;
  return severities.reduce((best, s) => {
    const rb = SEVERITY_RANK[String(best).toLowerCase()] ?? 0;
    const rs = SEVERITY_RANK[String(s).toLowerCase()] ?? 0;
    return rs > rb ? s : best;
  });
}

/**
 * Deduplicate strings by full normalized text (case-insensitive, whitespace-
 * collapsed). Distinct recommendations that share a prefix are preserved.
 */
export function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
