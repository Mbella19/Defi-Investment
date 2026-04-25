import { spawn } from "child_process";

export interface GeminiInvokeOptions {
  /** Model id. Defaults to gemini-3.1-pro-preview. */
  model?: string;
  timeoutMs?: number;
  /** Working directory for gemini. Defaults to current. */
  cwd?: string;
}

const DEFAULT_MODEL = "gemini-3.1-pro-preview";
const STDERR_CAP_BYTES = 64 * 1024;
const TIMEOUT_GRACE_MS = 1_500;

/**
 * Invoke the local `gemini` CLI non-interactively. Mirrors invokeClaude /
 * invokeCodex contracts: pipe prompt over stdin, return final assistant text.
 *
 * Uses --approval-mode plan for a read-only sandbox — gemini will not edit
 * files during these review calls.
 */
export async function invokeGemini(prompt: string, opts: GeminiInvokeOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 360_000;
  const model = opts.model ?? DEFAULT_MODEL;

  // gemini -p takes the prompt as an arg but also accepts stdin which is
  // "appended to input on stdin". Passing an empty -p and piping the real
  // prompt via stdin keeps long prompts off argv (argv has OS size limits).
  const args = ["-p", "", "-m", model, "--approval-mode", "plan"];

  return await new Promise<string>((resolve, reject) => {
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
