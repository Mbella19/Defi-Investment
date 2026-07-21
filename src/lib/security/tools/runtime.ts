import { spawn, type SpawnOptions } from "child_process";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import path, { dirname, resolve, sep } from "path";
import type { ContractSource } from "../etherscan";
import { normalizeSourceCode } from "../etherscan";
import { childProcessEnv } from "../child-process-env";

const TOOL_DETECT_TIMEOUT_MS = 5_000;
const detectionCache = new Map<string, { available: boolean; version?: string; checkedAt: number }>();
const DETECTION_TTL_MS = 60_000;

export interface ToolDetection {
  available: boolean;
  version?: string;
  hint?: string;
}

/**
 * Returns whether `binary --version` (or another probe) succeeds. Cached per
 * minute so repeated audits don't re-shell out.
 */
export async function detectBinary(
  binary: string,
  versionArgs: string[] = ["--version"]
): Promise<ToolDetection> {
  const cached = detectionCache.get(binary);
  const now = Date.now();
  if (cached && now - cached.checkedAt < DETECTION_TTL_MS) {
    return { available: cached.available, version: cached.version };
  }
  try {
    const out = await runProcess(binary, versionArgs, { timeoutMs: TOOL_DETECT_TIMEOUT_MS });
    const version = (out.stdout || out.stderr || "").trim().split(/\r?\n/)[0]?.slice(0, 120);
    detectionCache.set(binary, { available: true, version, checkedAt: now });
    return { available: true, version };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    detectionCache.set(binary, { available: false, checkedAt: now });
    return { available: false, hint: reason };
  }
}

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RunProcessOptions extends SpawnOptions {
  timeoutMs?: number;
  /** Treat non-zero exit codes as success (some tools exit 1 on findings). */
  acceptNonZero?: boolean;
  stdin?: string;
  /** Cap captured output (in bytes) to keep memory bounded. */
  maxBufferBytes?: number;
}

export async function runProcess(
  command: string,
  args: string[],
  opts: RunProcessOptions = {}
): Promise<ProcessResult> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const maxBuffer = opts.maxBufferBytes ?? 8 * 1024 * 1024;
  const start = Date.now();

  return new Promise<ProcessResult>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let capturedBytes = 0;

    const proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: childProcessEnv(opts.env),
      cwd: opts.cwd,
      // Static analyzers invoke compiler/tool children. A detached process
      // group lets timeout/output guards terminate the whole tree on POSIX.
      detached: process.platform !== "win32",
    });

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const killTree = (signal: NodeJS.Signals) => {
      if (proc.pid === undefined) return;
      if (process.platform !== "win32") {
        try {
          process.kill(-proc.pid, signal);
          return;
        } catch {
          // Fall back to the direct child if group signaling races with exit.
        }
      }
      try { proc.kill(signal); } catch { /* already gone */ }
    };
    const terminateTree = () => {
      killTree("SIGTERM");
      setTimeout(() => killTree("SIGKILL"), 2_000).unref();
    };
    const rejectOnce = (error: Error) => settle(() => reject(error));

    const timer = setTimeout(() => {
      terminateTree();
      rejectOnce(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const capture = (target: Buffer[], chunk: Buffer) => {
      if (settled) return;
      if (capturedBytes + chunk.length > maxBuffer) {
        terminateTree();
        rejectOnce(new Error(`${command} exceeded the ${maxBuffer}-byte output limit`));
        return;
      }
      target.push(chunk);
      capturedBytes += chunk.length;
    };

    proc.stdout?.on("data", (chunk: Buffer) => {
      capture(stdoutChunks, chunk);
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      capture(stderrChunks, chunk);
    });

    proc.on("error", (err) => {
      rejectOnce(err);
    });

    proc.on("close", (code) => {
      if (settled) return;
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");
      const durationMs = Date.now() - start;
      if (code === 0 || opts.acceptNonZero) {
        settle(() => resolve({ exitCode: code, stdout, stderr, durationMs }));
      } else {
        rejectOnce(
          new Error(
            `${command} exited ${code}: ${stderr.slice(0, 500) || stdout.slice(0, 500) || "no output"}`
          )
        );
      }
    });

    if (opts.stdin) {
      proc.stdin?.end(opts.stdin);
    } else {
      proc.stdin?.end();
    }
  });
}

/* ==================== WORKSPACE ==================== */

export interface SourceWorkspace {
  /** Absolute path to the temp directory containing the contract source files. */
  rootDir: string;
  /** Map of relative-path -> absolute path. */
  files: Record<string, string>;
  /** The "primary" .sol file path (best guess at the main contract). */
  primaryFile: string;
  contractName: string;
  compilerVersion: string;
  /** Cleanup the workspace. Always call once you're done. */
  cleanup: () => Promise<void>;
}

/**
 * Materialize a verified ContractSource into a temp directory on disk so that
 * Slither/Aderyn/Mythril can be pointed at real files. Sanitizes file paths.
 */
export async function materializeSource(source: ContractSource): Promise<SourceWorkspace> {
  const root = await mkdtemp(
    path.join(/*turbopackIgnore: true*/ tmpdir(), "sov-audit-"),
  );
  try {
    const { files: parsedFiles } = normalizeSourceCode(source.SourceCode);

    const written: Record<string, string> = {};
    let primary: string | null = null;
    const rootBoundary = resolve(root) + sep;
    for (const [relRaw, content] of Object.entries(parsedFiles)) {
      const rel = sanitizeRelPath(relRaw) || "main.sol";
      const abs = resolve(root, rel);
      // Boundary check: even though sanitizeRelPath strips `..` segments, an
      // absolute path or a path that resolves outside the root would escape.
      // Defense-in-depth in case of a future-mode where paths come from a
      // less-trusted source than the current Etherscan-only flow.
      if (!abs.startsWith(rootBoundary)) {
        throw new Error(`Refusing to write file outside workspace: ${relRaw}`);
      }
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf-8");
      written[rel] = abs;
      if (
        !primary &&
        (rel.endsWith(`${source.ContractName}.sol`) || rel === `${source.ContractName}.sol`)
      ) {
        primary = abs;
      }
    }

    // Fallback: pick the first .sol file
    if (!primary) {
      const sol = Object.entries(written).find(([rel]) => rel.endsWith(".sol"));
      primary = sol ? sol[1] : Object.values(written)[0] ?? path.join(root, "main.sol");
    }

    return {
      rootDir: root,
      files: written,
      primaryFile: primary,
      contractName: source.ContractName,
      compilerVersion: source.CompilerVersion,
      cleanup: async () => {
        try {
          await rm(root, { recursive: true, force: true });
        } catch {
          /* best effort */
        }
      },
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function sanitizeRelPath(rel: string): string {
  // Strip leading slashes and any `..` segments. Keep nested directories.
  const parts = rel
    .replace(/^\/+/, "")
    .split("/")
    .filter((p) => p && p !== "." && p !== "..");
  return parts.join("/");
}

/** Extract the bare semver from a Solidity compiler version string like `v0.8.20+commit.abcdef`. */
export function extractSolcSemver(compilerVersion: string): string | null {
  const m = compilerVersion.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3]}`;
}
