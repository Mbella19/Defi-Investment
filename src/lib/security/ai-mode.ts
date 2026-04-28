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
 *
 * On hosted deploys, "cli" is rejected because serverless runtimes don't
 * have local `claude` / `codex` / `gemini` binaries — calling AI routes
 * would fail with cryptic spawn ENOENT after the first request. We detect
 * "hosted" via VERCEL=1 (Vercel sets it) rather than NODE_ENV=production,
 * because `next start` locally also sets NODE_ENV=production but the local
 * CLI binaries are still available there. Set FORCE_AI_API_MODE=1 to
 * trigger the same check on other hosting platforms.
 */
function isHostedRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.FORCE_AI_API_MODE === "1" ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

export function getAiMode(provider: AiProvider): AiMode {
  const mode =
    normalize(process.env[PER_PROVIDER_ENV[provider]]) ??
    normalize(process.env.AI_MODE) ??
    "cli";
  if (mode === "cli" && isHostedRuntime()) {
    throw new Error(
      `${provider} is in CLI mode on a hosted runtime — set AI_MODE=api (or ${PER_PROVIDER_ENV[provider]}=api) and provide the matching API key. ` +
        "Local CLI binaries aren't available on serverless runtimes.",
    );
  }
  return mode;
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
