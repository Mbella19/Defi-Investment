import { spawn } from "child_process";

export interface ClaudeInvokeOptions {
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  timeoutMs?: number;
}

/**
 * Invoke the local claude CLI with a prompt over stdin. Text-mode output.
 * Mirrors the pattern in src/lib/anthropic.ts.
 */
export function invokeClaude(prompt: string, opts: ClaudeInvokeOptions = {}): Promise<string> {
  const model = opts.model ?? "claude-opus-4-7";
  const effort = opts.effort ?? "max";
  const timeoutMs = opts.timeoutMs ?? 180_000;

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    const proc = spawn("claude", ["-p", "--output-format", "text", "--model", model, "--effort", effort], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`claude CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", (c: Buffer) => errChunks.push(c));

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const output = Buffer.concat(chunks).toString("utf-8");
      if (code === 0 && output.trim()) {
        resolve(output);
      } else {
        const stderr = Buffer.concat(errChunks).toString("utf-8");
        reject(new Error(`claude CLI exited ${code}: ${stderr || "no output"}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

/**
 * Strict JSON extractor. Handles markdown fences, surrounding prose, and
 * picks the outermost balanced `{...}` block.
 */
export function extractJson<T = unknown>(text: string): T {
  let str = text.trim();

  const fence = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) str = fence[1].trim();

  const start = str.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model output");

  let depth = 0;
  let end = start;
  let inString = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const slice = str.slice(start, end + 1);
  return JSON.parse(slice) as T;
}
