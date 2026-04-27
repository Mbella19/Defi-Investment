export type AiProvider = "claude" | "codex" | "gemini";
export type AiMode = "cli" | "api";

const PER_PROVIDER_ENV: Record<AiProvider, string> = {
  claude: "CLAUDE_MODE",
  codex: "OPENAI_MODE",
  gemini: "GEMINI_MODE",
};

function normalize(value: string | undefined): AiMode | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "cli" || v === "api") return v;
  return undefined;
}

/**
 * Resolve the runtime mode for a given AI provider.
 *
 * Precedence:
 *   1. Per-provider env var (CLAUDE_MODE / OPENAI_MODE / GEMINI_MODE)
 *   2. Global AI_MODE
 *   3. Default to "cli" (local dev parity)
 */
export function getAiMode(provider: AiProvider): AiMode {
  return (
    normalize(process.env[PER_PROVIDER_ENV[provider]]) ??
    normalize(process.env.AI_MODE) ??
    "cli"
  );
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`${name} is not set — required for API mode`);
  }
  return v.trim();
}

/**
 * Resolve `*_BASE_URL` env vars for the AI providers. Validates that the
 * value parses as a URL and uses http/https — anything else (file:, data:,
 * javascript:, etc.) would be silently concatenated into a fetch otherwise.
 * Strips trailing slash for consistent path concatenation.
 */
export function resolveBaseUrl(envName: string, fallback: string): string {
  const raw = process.env[envName];
  if (!raw || !raw.trim()) return fallback.replace(/\/$/, "");
  const value = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${envName} is not a valid URL: ${JSON.stringify(value)}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${envName} must use http or https; got ${parsed.protocol}`);
  }
  return value.replace(/\/$/, "");
}
