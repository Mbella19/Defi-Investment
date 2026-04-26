import { spawn } from "child_process";
import { getAiMode, requireEnv } from "./ai-mode";

export interface ClaudeInvokeOptions {
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  timeoutMs?: number;
}

const DEFAULT_MODEL = "claude-opus-4-7";

/**
 * Invoke Claude with a prompt. Routes to the local CLI or the Anthropic
 * Messages API depending on AI_MODE / CLAUDE_MODE (defaults to "cli").
 */
export function invokeClaude(prompt: string, opts: ClaudeInvokeOptions = {}): Promise<string> {
  if (getAiMode("claude") === "api") {
    return invokeClaudeApi(prompt, opts);
  }
  return invokeClaudeCli(prompt, opts);
}

function invokeClaudeCli(prompt: string, opts: ClaudeInvokeOptions): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;
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
 * Effort -> extended-thinking budget. "low" disables thinking entirely.
 * Anthropic requires max_tokens > budget_tokens, so the response budget
 * floats above thinking.
 */
function thinkingBudget(effort: ClaudeInvokeOptions["effort"]): number {
  switch (effort) {
    case "max": return 16000;
    case "xhigh": return 12000;
    case "high": return 8000;
    case "medium": return 4000;
    case "low": return 0;
    default: return 16000;
  }
}

async function invokeClaudeApi(prompt: string, opts: ClaudeInvokeOptions): Promise<string> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const effort = opts.effort ?? "max";
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");

  const budget = thinkingBudget(effort);
  const responseBudget = 8192;
  const maxTokens = budget > 0 ? budget + responseBudget : responseBudget;

  type Body = {
    model: string;
    max_tokens: number;
    messages: { role: "user"; content: string }[];
    thinking?: { type: "enabled"; budget_tokens: number };
  };
  const body: Body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (budget > 0) {
    body.thinking = { type: "enabled", budget_tokens: budget };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 500) || res.statusText}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("")
      .trim();
    if (!text) throw new Error("Anthropic API returned no text content");
    return text;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Anthropic API timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
