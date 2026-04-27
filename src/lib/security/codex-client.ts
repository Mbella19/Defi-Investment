import { spawn } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { getAiMode, requireEnv, resolveBaseUrl } from "./ai-mode";

export interface CodexInvokeOptions {
  /** Override model. CLI: ~/.codex/config.toml default. API: OPENAI_MODEL env or gpt-5.5. */
  model?: string;
  /** Override reasoning effort. CLI: user's config (typically "xhigh"). API: maps to OpenAI effort levels. */
  effort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  timeoutMs?: number;
  /** Working directory for codex (CLI mode only). */
  cwd?: string;
}

const STDERR_CAP_BYTES = 64 * 1024;
const TIMEOUT_GRACE_MS = 1_500;
const DEFAULT_API_MODEL = "gpt-5.5";

/**
 * Invoke OpenAI's reasoning model. Routes to the local `codex` CLI or the
 * OpenAI Responses API depending on AI_MODE / OPENAI_MODE (defaults to "cli").
 */
export function invokeCodex(prompt: string, opts: CodexInvokeOptions = {}): Promise<string> {
  if (getAiMode("codex") === "api") {
    return invokeCodexApi(prompt, opts);
  }
  return invokeCodexCli(prompt, opts);
}

async function invokeCodexCli(prompt: string, opts: CodexInvokeOptions): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 360_000;

  const outDir = await mkdtemp(join(tmpdir(), "codex-out-"));
  const outFile = join(outDir, "last.txt");

  try {
    return await new Promise<string>((resolve, reject) => {
      const args = [
        "exec",
        "--sandbox", "read-only",
        "--skip-git-repo-check",
        "--color", "never",
        "-o", outFile,
      ];
      if (opts.model) args.push("-m", opts.model);
      if (opts.effort) args.push("-c", `model_reasoning_effort="${opts.effort}"`);
      args.push("-");

      const errChunks: Buffer[] = [];
      let errBytes = 0;

      const proc = spawn("codex", args, {
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
        settle(() => reject(new Error(`codex CLI timed out after ${timeoutMs}ms`)));
      }, timeoutMs);

      proc.stdout.on("data", () => {/* discard event log */});
      proc.stderr.on("data", (c: Buffer) => {
        if (errBytes < STDERR_CAP_BYTES) {
          errChunks.push(c);
          errBytes += c.length;
        }
      });

      proc.on("close", async (code) => {
        clearTimeout(timeout);
        if (settled) return;
        try {
          if (code !== 0) {
            const stderr = Buffer.concat(errChunks).toString("utf-8");
            settle(() => reject(new Error(`codex CLI exited ${code}: ${stderr.slice(0, 500) || "no stderr"}`)));
            return;
          }
          const text = (await readFile(outFile, "utf-8")).trim();
          if (!text) {
            settle(() => reject(new Error("codex CLI produced no final message")));
            return;
          }
          settle(() => resolve(text));
        } catch (err) {
          settle(() => reject(err));
        }
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
  } finally {
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Map our 5-level effort to OpenAI's 4-level Responses API effort. */
function mapEffort(effort: CodexInvokeOptions["effort"]): "minimal" | "low" | "medium" | "high" {
  switch (effort) {
    case "minimal": return "minimal";
    case "low": return "low";
    case "medium": return "medium";
    case "high":
    case "xhigh":
    default: return "high";
  }
}

async function invokeCodexApi(prompt: string, opts: CodexInvokeOptions): Promise<string> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = opts.model ?? process.env.OPENAI_MODEL ?? DEFAULT_API_MODEL;
  const timeoutMs = opts.timeoutMs ?? 360_000;
  const baseUrl = resolveBaseUrl("OPENAI_BASE_URL", "https://api.openai.com");
  const effort = mapEffort(opts.effort ?? "xhigh");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/v1/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        reasoning: { effort },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 500) || res.statusText}`);
    }
    const data = (await res.json()) as {
      output_text?: string;
      output?: Array<{
        type: string;
        content?: Array<{ type: string; text?: string }>;
      }>;
    };
    let text = (data.output_text ?? "").trim();
    if (!text && Array.isArray(data.output)) {
      text = data.output
        .filter((b) => b.type === "message")
        .flatMap((b) => b.content ?? [])
        .filter((c) => (c.type === "output_text" || c.type === "text") && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("")
        .trim();
    }
    if (!text) throw new Error("OpenAI API returned no text output");
    return text;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`OpenAI API timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
