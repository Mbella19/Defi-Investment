import { spawn } from "child_process";
import { getAiMode, requireEnv, resolveBaseUrl } from "./ai-mode";

export interface GeminiInvokeOptions {
  /** Model id. Defaults to gemini-3.1-pro-preview. */
  model?: string;
  timeoutMs?: number;
  /** Working directory for gemini (CLI mode only). */
  cwd?: string;
}

const DEFAULT_MODEL = "gemini-3.1-pro-preview";
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
  const model = opts.model ?? DEFAULT_MODEL;

  // `-p ""` (empty prompt) + piping the real prompt over stdin: this forces
  // the gemini CLI into non-interactive prompt mode without putting the full
  // prompt onto argv. Long prompts (>100KB) would blow ARG_MAX otherwise, and
  // some gemini versions won't read stdin unless `-p` is present at all.
  // `--approval-mode plan` keeps the CLI from trying to execute tool calls.
  const args = ["-p", "", "-m", model, "--approval-mode", "plan"];

  return new Promise<string>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let errBytes = 0;

    const proc = spawn("gemini", args, {
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
