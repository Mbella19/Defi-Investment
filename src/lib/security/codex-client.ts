import { spawn } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export interface CodexInvokeOptions {
  /** Override model (defaults to whatever ~/.codex/config.toml has — typically gpt-5.5). */
  model?: string;
  /** Override reasoning effort. Defaults to user's config (typically "xhigh"). */
  effort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  timeoutMs?: number;
  /** Working directory for codex. Defaults to current. */
  cwd?: string;
}

/**
 * Invoke the local `codex` CLI (OpenAI Codex / GPT-5.5) non-interactively.
 * Mirrors invokeClaude's contract: prompt over stdin, returns final assistant text.
 *
 * Uses `--sandbox read-only` for safety — codex never writes files during these
 * security review calls. Output capture is via `-o <file>` so we get only the
 * final assistant message, not the run log noise.
 */
const STDERR_CAP_BYTES = 64 * 1024;
const TIMEOUT_GRACE_MS = 1_500;

export async function invokeCodex(prompt: string, opts: CodexInvokeOptions = {}): Promise<string> {
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

      // detached:true puts the child in its own process group so we can signal
      // the whole subtree on timeout (codex spawns an LLM client subprocess).
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
        // Escalate to SIGKILL if the process group ignores SIGTERM.
        setTimeout(() => killTree("SIGKILL"), TIMEOUT_GRACE_MS).unref();
        settle(() => reject(new Error(`codex CLI timed out after ${timeoutMs}ms`)));
      }, timeoutMs);

      proc.stdout.on("data", () => {/* discard event log; final message lives in outFile */});
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

      // EPIPE on early child exit must not crash the parent process.
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
