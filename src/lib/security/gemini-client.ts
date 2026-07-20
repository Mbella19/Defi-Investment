import { spawn } from "child_process";
import { getAiMode, requireEnv, resolveBaseUrl } from "./ai-mode";

export interface GeminiInvokeOptions {
  /** Model id. Defaults to gemini-3.5-flash. */
  model?: string;
  /** Thinking level (API mode). Defaults to "high". */
  reasoning?: "low" | "medium" | "high";
  timeoutMs?: number;
  /** Working directory for gemini (CLI mode only). */
  cwd?: string;
}

// Gemini 3.5 Flash is the adversarial REVIEWER of Codex's proposals, run at
// high thinking.
//
// Two model-name conventions because the local CLI and the hosted API differ:
//   - CLI (`agy`): reasoning is baked into the human-readable model name, e.g.
//     "Gemini 3.5 Flash (High)". Binary + name overridable via env.
//   - API: model id "gemini-3.5-flash" + a separate thinkingLevel.
const DEFAULT_MODEL = "gemini-3.5-flash"; // API mode
const DEFAULT_REASONING = "high" as const;
const CLI_BIN = process.env.GEMINI_CLI_BIN?.trim() || "agy";
const CLI_MODEL = process.env.GEMINI_CLI_MODEL?.trim() || "Gemini 3.5 Flash (High)";
const STDERR_CAP_BYTES = 64 * 1024;
const TIMEOUT_GRACE_MS = 1_500;

/**
 * Invoke Gemini. Routes to the local `gemini` CLI or the Google Generative
 * Language API depending on AI_MODE / GEMINI_MODE (defaults to "cli").
 */
export function invokeGemini(prompt: string, opts: GeminiInvokeOptions = {}): Promise<string> {
  if (getAiMode("gemini") === "api") {
    return invokeGeminiApi(prompt, opts);
  }
  return invokeGeminiCli(prompt, opts);
}

function invokeGeminiCli(prompt: string, opts: GeminiInvokeOptions): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 360_000;
  const model = opts.model ?? CLI_MODEL;

  // `agy` (the current Gemini CLI): `--print` runs a single prompt
  // non-interactively (prompt piped over stdin so long prompts don't hit
  // ARG_MAX); `--mode plan` keeps it from executing tool calls; the model
  // name encodes the thinking level. `--print-timeout` is raised to our own
  // budget so agy's internal 5-minute default can't truncate a 6-minute run.
  const printTimeout = `${Math.ceil(timeoutMs / 1000)}s`;
  const args = ["--print", "--model", model, "--mode", "plan", "--print-timeout", printTimeout];

  return new Promise<string>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let errBytes = 0;

    const proc = spawn(CLI_BIN, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      cwd: opts.cwd,
      detached: true,
    });

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const killTree = (signal: NodeJS.Signals) => {
      if (proc.pid === undefined) return;
      try {
        process.kill(-proc.pid, signal);
      } catch {
        try { proc.kill(signal); } catch { /* already gone */ }
      }
    };

    const timeout = setTimeout(() => {
      killTree("SIGTERM");
      setTimeout(() => killTree("SIGKILL"), TIMEOUT_GRACE_MS).unref();
      settle(() => reject(new Error(`gemini CLI timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    proc.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
    proc.stderr.on("data", (c: Buffer) => {
      if (errBytes < STDERR_CAP_BYTES) {
        errChunks.push(c);
        errBytes += c.length;
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString("utf-8");
        settle(() => reject(new Error(`gemini CLI exited ${code}: ${stderr.slice(0, 500) || "no stderr"}`)));
        return;
      }
      const text = Buffer.concat(stdoutChunks).toString("utf-8").trim();
      if (!text) {
        settle(() => reject(new Error("gemini CLI produced no output")));
        return;
      }
      settle(() => resolve(text));
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });

    proc.stdin.on("error", (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });
    proc.stdin.end(prompt);
  });
}

async function invokeGeminiApi(prompt: string, opts: GeminiInvokeOptions): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const reasoning = opts.reasoning ?? DEFAULT_REASONING;
  const timeoutMs = opts.timeoutMs ?? 360_000;
  const baseUrl = resolveBaseUrl("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com");

  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // Gemini 3.x thinking level. (API-mode only; CLI mode uses the
        // model's default thinking. Field name/casing tracks the Generative
        // Language v1beta thinkingConfig — adjust if Google revises it.)
        generationConfig: { thinkingConfig: { thinkingLevel: reasoning.toUpperCase() } },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 500) || res.statusText}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini API blocked prompt: ${data.promptFeedback.blockReason}`);
    }
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new Error("Gemini API returned no text content");
    return text;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Gemini API timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
