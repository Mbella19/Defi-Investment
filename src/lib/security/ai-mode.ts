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
