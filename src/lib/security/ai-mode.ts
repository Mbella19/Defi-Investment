export type AiProvider = "codex" | "gemini";
export type AiMode = "cli" | "api";

const PER_PROVIDER_ENV: Record<AiProvider, string> = {
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
 *   1. Per-provider env var (OPENAI_MODE / GEMINI_MODE)
 *   2. Global AI_MODE
 *   3. Default to "cli" (local dev parity)
 *
 * Production rejects CLI mode. Besides binaries being absent on most hosts,
 * local agent CLIs have access to their credential/config home and are not an
 * appropriate boundary for attacker-influenced protocol text. CLI mode is a
 * development convenience only; production must use the tool-free HTTPS API
 * path. FORCE_AI_API_MODE provides the same guard in custom non-production
 * staging environments.
 */
function isHostedRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production" ||
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
      `${provider} is in CLI mode in a production runtime — set AI_MODE=api (or ${PER_PROVIDER_ENV[provider]}=api) and provide the matching API key.`,
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

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Resolve `*_BASE_URL` env vars for the AI providers. Validates that the
 * value parses as a URL and uses https — these URLs carry API keys, so a
 * misconfigured http:// endpoint would send credentials in cleartext. Plain
 * http is allowed only for localhost (local proxies / test doubles).
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
  if (parsed.protocol === "http:" && !LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `${envName} uses plain http for a non-local host — API keys would travel in cleartext. Use https.`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${envName} must use http or https; got ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${envName} must not contain credentials, a query, or a fragment`);
  }
  return value.replace(/\/$/, "");
}
