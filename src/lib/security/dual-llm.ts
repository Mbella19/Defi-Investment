import { invokeClaude, extractJson } from "./claude-client";
import { invokeCodex } from "./codex-client";

export type DualSource = "claude" | "codex";

export interface DualRawResult {
  claude: { ok: true; text: string } | { ok: false; error: string };
  codex: { ok: true; text: string } | { ok: false; error: string };
}

export interface DualOptions {
  timeoutMs?: number;
}

/**
 * Run the same prompt through Claude Opus 4.7 (max effort) and Codex GPT-5.5
 * (xhigh effort) in parallel. Either model failing does not abort the other —
 * callers must handle partial results.
 */
export async function dualInvoke(prompt: string, opts: DualOptions = {}): Promise<DualRawResult> {
  const timeoutMs = opts.timeoutMs ?? 360_000;

  const [claudeRes, codexRes] = await Promise.allSettled([
    invokeClaude(prompt, { effort: "max", timeoutMs }),
    invokeCodex(prompt, { timeoutMs }),
  ]);

  return {
    claude:
      claudeRes.status === "fulfilled"
        ? { ok: true, text: claudeRes.value }
        : { ok: false, error: claudeRes.reason instanceof Error ? claudeRes.reason.message : String(claudeRes.reason) },
    codex:
      codexRes.status === "fulfilled"
        ? { ok: true, text: codexRes.value }
        : { ok: false, error: codexRes.reason instanceof Error ? codexRes.reason.message : String(codexRes.reason) },
  };
}

/**
 * Parse each model's output as JSON. Returns nulls for models that failed or
 * produced unparseable output, with the error captured in `errors`.
 */
export function dualExtractJson<T = unknown>(raw: DualRawResult): {
  claude: T | null;
  codex: T | null;
  errors: { source: DualSource; error: string }[];
} {
  const errors: { source: DualSource; error: string }[] = [];

  let claude: T | null = null;
  if (raw.claude.ok) {
    try {
      claude = extractJson<T>(raw.claude.text);
    } catch (err) {
      errors.push({ source: "claude", error: err instanceof Error ? err.message : String(err) });
    }
  } else {
    errors.push({ source: "claude", error: raw.claude.error });
  }

  let codex: T | null = null;
  if (raw.codex.ok) {
    try {
      codex = extractJson<T>(raw.codex.text);
    } catch (err) {
      errors.push({ source: "codex", error: err instanceof Error ? err.message : String(err) });
    }
  } else {
    errors.push({ source: "codex", error: raw.codex.error });
  }

  return { claude, codex, errors };
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

/** Pick the higher of two severity strings. Case-insensitive. */
export function maxSeverity<S extends string>(a: S, b: S): S {
  const ra = SEVERITY_RANK[String(a).toLowerCase()] ?? 0;
  const rb = SEVERITY_RANK[String(b).toLowerCase()] ?? 0;
  return ra >= rb ? a : b;
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
