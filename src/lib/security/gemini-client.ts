import { spawn } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { getAiMode, requireEnv, resolveBaseUrl } from "./ai-mode";
import { trackAiInvocation } from "@/lib/ai-telemetry";
import { childProcessEnv } from "./child-process-env";
import { fetchWithTimeout } from "@/lib/fetch-utils";

export interface GeminiInvokeOptions {
  /** Model id. API and CLI defaults use their provider-specific names. */
  model?: string;
  /** Thinking level (API mode). Defaults to "high". */
  reasoning?: "low" | "medium" | "high";
  timeoutMs?: number;
}

// Gemini 3.6 Flash is the adversarial REVIEWER of Codex's proposals, run at
// high thinking.
//
// Two model-name conventions because the local CLI and the hosted API differ:
//   - CLI (`agy`): reasoning is baked into the model name, e.g.
//     "gemini-3.6-flash-high". The name is overridable via env.
//   - API: model id "gemini-3.5-flash" + a separate thinkingLevel.
const DEFAULT_MODEL = "gemini-3.5-flash"; // API mode
const DEFAULT_REASONING = "high" as const;
const CLI_MODEL = process.env.GEMINI_CLI_MODEL?.trim() || "gemini-3.6-flash-high";
const CLI_PROMPT_CAP_BYTES = 256 * 1024;
const STDERR_CAP_BYTES = 64 * 1024;
const RESPONSE_CAP_BYTES = 8 * 1024 * 1024;
const TIMEOUT_GRACE_MS = 1_500;

/**
 * Invoke Gemini. Routes to the local `gemini` CLI or the Google Generative
 * Language API depending on AI_MODE / GEMINI_MODE (defaults to "cli").
 */
export function invokeGemini(prompt: string, opts: GeminiInvokeOptions = {}): Promise<string> {
  const apiMode = getAiMode("gemini") === "api";
  const model = opts.model ?? (apiMode ? process.env.GEMINI_MODEL ?? DEFAULT_MODEL : CLI_MODEL);
  return trackAiInvocation({
    provider: "gemini",
    model,
    prompt,
    run: () => apiMode
      ? invokeGeminiApi(prompt, { ...opts, model })
      : invokeGeminiCli(prompt, { ...opts, model }),
  });
}

async function invokeGeminiCli(prompt: string, opts: GeminiInvokeOptions): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 360_000;
  const model = opts.model ?? CLI_MODEL;
  const workDir = await mkdtemp(
    path.join(/*turbopackIgnore: true*/ tmpdir(), "gemini-out-"),
  );

  const args = buildGeminiCliArgs(prompt, {
    model,
    reasoning: opts.reasoning ?? DEFAULT_REASONING,
    timeoutMs,
  });

  try {
    return await new Promise<string>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let errBytes = 0;

    const proc = spawn("agy", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: childProcessEnv(),
      // Prompts carry all required context. Never expose the repository (or
      // its environment files) as the working directory of a local agent.
      cwd: workDir,
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

    proc.stdout.on("data", (c: Buffer) => {
      if (settled) return;
      if (stdoutBytes + c.length > RESPONSE_CAP_BYTES) {
        killTree("SIGTERM");
        setTimeout(() => killTree("SIGKILL"), TIMEOUT_GRACE_MS).unref();
        clearTimeout(timeout);
        settle(() => reject(new Error("gemini CLI response exceeded the output limit")));
        return;
      }
      stdoutChunks.push(c);
      stdoutBytes += c.length;
    });
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

    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function buildGeminiCliArgs(
  prompt: string,
  options: { model: string; reasoning: "low" | "medium" | "high"; timeoutMs: number },
): string[] {
  const promptBytes = Buffer.byteLength(prompt, "utf8");
  if (promptBytes === 0) throw new Error("gemini CLI prompt is empty");
  if (prompt.includes("\0")) throw new Error("gemini CLI prompt contains a null byte");
  if (promptBytes > CLI_PROMPT_CAP_BYTES) {
    throw new Error(`gemini CLI prompt exceeded ${CLI_PROMPT_CAP_BYTES} bytes`);
  }

  // agy 1.0's --print is a string flag; it does not consume stdin. Passing a
  // bare `--print` caused the next flag (`--model`) to become the prompt and
  // made every real response an identity sentence. Use one argv element so
  // a prompt beginning with "--" cannot be reparsed as another flag. spawn()
  // receives an argument array (never a shell), and the byte cap leaves ample
  // headroom below the platform's ARG_MAX in this local-only CLI mode.
  return [
    `--print=${prompt}`,
    "--model",
    options.model,
    "--effort",
    options.reasoning,
    "--mode",
    "plan",
    "--print-timeout",
    `${Math.ceil(options.timeoutMs / 1000)}s`,
  ];
}

async function invokeGeminiApi(prompt: string, opts: GeminiInvokeOptions): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const reasoning = opts.reasoning ?? DEFAULT_REASONING;
  const timeoutMs = opts.timeoutMs ?? 360_000;
  const baseUrl = resolveBaseUrl("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com");

  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await fetchWithTimeout(url, {
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
      redirect: "error",
    }, timeoutMs, RESPONSE_CAP_BYTES);
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`Gemini API request failed with status ${res.status}`);
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
    const message = err instanceof Error ? err.message : String(err);
    if ((err as Error).name === "AbortError" || /timed out|request timed out/i.test(message)) {
      throw new Error(`Gemini API timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}
