import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { detectBinary, runProcess, extractSolcSemver, type SourceWorkspace } from "./runtime";
import type {
  AuditCategory,
  AuditConfidence,
  AuditSeverity,
  ToolFinding,
  ToolRunResult,
} from "@/types/audit";

const SLITHER_TIMEOUT_MS = 240_000;

interface SlitherJsonReport {
  success: boolean;
  results?: {
    detectors?: SlitherDetector[];
  };
  error?: string;
}

interface SlitherDetector {
  check?: string;
  impact?: string;
  confidence?: string;
  description?: string;
  markdown?: string;
  first_markdown_element?: string;
  elements?: SlitherElement[];
}

interface SlitherElement {
  type?: string;
  name?: string;
  source_mapping?: {
    filename_relative?: string;
    filename_absolute?: string;
    filename_short?: string;
    lines?: number[];
    starting_column?: number;
    ending_column?: number;
  };
  type_specific_fields?: {
    parent?: { name?: string };
  };
}

const SEVERITY_MAP: Record<string, AuditSeverity> = {
  high: "high",
  medium: "medium",
  low: "low",
  informational: "info",
  optimization: "info",
};

const CONFIDENCE_MAP: Record<string, AuditConfidence> = {
  high: "high",
  medium: "medium",
  low: "low",
};

/** Slither check_id → our AuditCategory taxonomy. */
const DETECTOR_CATEGORY: Record<string, AuditCategory> = {
  "reentrancy-eth": "reentrancy",
  "reentrancy-no-eth": "reentrancy",
  "reentrancy-benign": "reentrancy",
  "reentrancy-events": "reentrancy",
  "reentrancy-unlimited-gas": "reentrancy",
  "controlled-delegatecall": "delegatecall_risk",
  "delegatecall-loop": "delegatecall_risk",
  suicidal: "selfdestruct_risk",
  "controlled-array-length": "arithmetic",
  "arbitrary-send": "access_control",
  "arbitrary-send-erc20": "access_control",
  "arbitrary-send-eth": "access_control",
  "tx-origin": "tx_origin",
  "uninitialized-state": "uninitialized_state",
  "uninitialized-storage": "uninitialized_state",
  "uninitialized-local": "uninitialized_state",
  "unchecked-transfer": "unchecked_call",
  "unchecked-send": "unchecked_call",
  "unchecked-lowlevel": "unchecked_call",
  "low-level-calls": "low_level_call",
  "incorrect-equality": "arithmetic",
  "weak-prng": "weak_prng",
  "events-access": "missing_events",
  "events-maths": "missing_events",
  "missing-zero-check": "uninitialized_state",
  "shadowing-state": "shadowing",
  "shadowing-local": "shadowing",
  "shadowing-builtin": "shadowing",
  "shadowing-abstract": "shadowing",
  "constant-function-asm": "code_quality",
  "constant-function-state": "code_quality",
  "calls-loop": "denial_of_service",
  "costly-loop": "denial_of_service",
  "incorrect-modifier": "access_control",
  "msgvalue-inside-loop": "denial_of_service",
  "uninitialized-fptr-cst": "uninitialized_state",
  "controlled-receivables": "access_control",
  timestamp: "timestamp_dependence",
  "encode-packed-collision": "arithmetic",
  "divide-before-multiply": "arithmetic",
  "boolean-cst": "code_quality",
  "incorrect-unary": "arithmetic",
  "uninitialized-storage-pointer": "uninitialized_state",
  "void-cst": "code_quality",
  "function-init-state-variables": "uninitialized_state",
  "deprecated-standards": "code_quality",
  "erc20-indexed": "code_quality",
  "erc20-interface": "code_quality",
  "erc721-interface": "code_quality",
  "incorrect-shift": "arithmetic",
  "multiple-constructors": "code_quality",
  "name-reused": "code_quality",
  "public-mappings-nested": "code_quality",
  "redundant-statements": "code_quality",
  "rtlo": "code_quality",
  "unimplemented-functions": "code_quality",
  "unused-return": "unchecked_call",
  "unused-state": "code_quality",
  "variable-scope": "code_quality",
  "void-function": "code_quality",
  "external-function": "code_quality",
  "naming-convention": "code_quality",
  "pragma": "code_quality",
  "solc-version": "code_quality",
};

export async function detectSlither() {
  return detectBinary("slither", ["--version"]);
}

/**
 * Run Slither against a materialized workspace. Returns a normalized
 * ToolRunResult — never throws on non-zero exit (Slither exits 1 when
 * findings exist).
 */
export async function runSlither(workspace: SourceWorkspace): Promise<ToolRunResult> {
  const detection = await detectSlither();
  if (!detection.available) {
    return {
      tool: "slither",
      available: false,
      unavailableReason:
        "slither binary not found on PATH. Install with: pip install slither-analyzer (and solc-select for solc switching).",
      durationMs: 0,
      findings: [],
    };
  }

  const start = Date.now();
  const args: string[] = [
    workspace.primaryFile,
    "--json",
    "-",
    "--disable-color",
  ];

  // Pin solc version if we can extract it from the verified compiler version.
  const semver = extractSolcSemver(workspace.compilerVersion);
  if (semver) {
    args.push("--solc-solcs-select", semver);
  }

  let result;
  try {
    result = await runProcess("slither", args, {
      timeoutMs: SLITHER_TIMEOUT_MS,
      acceptNonZero: true,
      cwd: workspace.rootDir,
    });
  } catch (err) {
    return {
      tool: "slither",
      available: true,
      durationMs: Date.now() - start,
      findings: [],
      rawError: err instanceof Error ? err.message : String(err),
    };
  }

  let parsed: SlitherJsonReport;
  try {
    parsed = JSON.parse(result.stdout) as SlitherJsonReport;
  } catch {
    return {
      tool: "slither",
      available: true,
      durationMs: Date.now() - start,
      findings: [],
      rawError: `slither produced unparseable JSON. stderr: ${result.stderr.slice(0, 600)}`,
      rawStdout: result.stdout.slice(0, 4_000),
    };
  }

  const detectors = parsed.results?.detectors ?? [];
  const findings = await Promise.all(
    detectors.map((d) => detectorToFinding(d, workspace))
  );

  return {
    tool: "slither",
    available: true,
    durationMs: Date.now() - start,
    findings: findings.filter((f): f is ToolFinding => f !== null),
  };
}

async function detectorToFinding(
  d: SlitherDetector,
  workspace: SourceWorkspace
): Promise<ToolFinding | null> {
  if (!d.check) return null;
  const severity = SEVERITY_MAP[(d.impact ?? "").toLowerCase()] ?? "info";
  const confidence = CONFIDENCE_MAP[(d.confidence ?? "").toLowerCase()] ?? "low";
  const category = DETECTOR_CATEGORY[d.check] ?? guessCategory(d.check);

  const elem = d.elements?.find((e) => e.source_mapping?.lines?.length);
  const lines = elem?.source_mapping?.lines ?? [];
  const startLine = lines.length ? Math.min(...lines) : undefined;
  const endLine = lines.length ? Math.max(...lines) : undefined;
  const filePath =
    elem?.source_mapping?.filename_relative ??
    elem?.source_mapping?.filename_short ??
    elem?.source_mapping?.filename_absolute;

  let snippet: string | undefined;
  if (filePath && startLine && endLine) {
    snippet = await readFileSlice(workspace, filePath, startLine, endLine);
  }

  const id = makeId("slither", d.check, filePath, startLine);
  return {
    id,
    tool: "slither",
    category,
    severity,
    confidence,
    title: humanizeCheck(d.check),
    description: (d.description ?? d.markdown ?? "").trim().slice(0, 1_500),
    contract: elem?.type_specific_fields?.parent?.name,
    function: elem?.type === "function" ? elem.name : undefined,
    filePath,
    startLine,
    endLine,
    codeSnippet: snippet,
    rawDetectorId: d.check,
    raw: d,
  };
}

async function readFileSlice(
  workspace: SourceWorkspace,
  filePath: string,
  startLine: number,
  endLine: number
): Promise<string | undefined> {
  // Try absolute first, then look up by relative match
  let abs: string | undefined;
  if (filePath.startsWith("/")) abs = filePath;
  else {
    const matchKey = Object.keys(workspace.files).find(
      (k) => k === filePath || k.endsWith(filePath)
    );
    abs = matchKey ? workspace.files[matchKey] : undefined;
  }
  if (!abs) return undefined;
  try {
    const content = await readFile(abs, "utf-8");
    const lines = content.split(/\r?\n/);
    const lo = Math.max(1, startLine - 2);
    const hi = Math.min(lines.length, endLine + 2);
    return lines.slice(lo - 1, hi).join("\n");
  } catch {
    return undefined;
  }
}

function humanizeCheck(check: string): string {
  return check
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function guessCategory(check: string): AuditCategory {
  const c = check.toLowerCase();
  if (c.includes("reentr")) return "reentrancy";
  if (c.includes("delegatecall")) return "delegatecall_risk";
  if (c.includes("selfdestruct") || c.includes("suicidal")) return "selfdestruct_risk";
  if (c.includes("uninit")) return "uninitialized_state";
  if (c.includes("tx-origin")) return "tx_origin";
  if (c.includes("send") || c.includes("call")) return "unchecked_call";
  if (c.includes("shadow")) return "shadowing";
  if (c.includes("event")) return "missing_events";
  if (c.includes("loop") || c.includes("dos")) return "denial_of_service";
  if (c.includes("timestamp")) return "timestamp_dependence";
  if (c.includes("prng") || c.includes("random")) return "weak_prng";
  if (c.includes("arith") || c.includes("overflow") || c.includes("underflow")) return "arithmetic";
  return "other";
}

function makeId(tool: string, check: string, file?: string, line?: number): string {
  const key = `${tool}|${check}|${file ?? ""}|${line ?? 0}`;
  return createHash("sha1").update(key).digest("hex").slice(0, 16);
}
