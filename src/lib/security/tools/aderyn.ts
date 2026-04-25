import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { detectBinary, runProcess, type SourceWorkspace } from "./runtime";
import type {
  AuditCategory,
  AuditConfidence,
  AuditSeverity,
  ToolFinding,
  ToolRunResult,
} from "@/types/audit";

const ADERYN_TIMEOUT_MS = 240_000;

interface AderynReport {
  issues?: {
    high?: AderynIssueGroup[];
    medium?: AderynIssueGroup[];
    low?: AderynIssueGroup[];
    informational?: AderynIssueGroup[];
    nc?: AderynIssueGroup[];
    critical?: AderynIssueGroup[];
  };
}

interface AderynIssueGroup {
  title?: string;
  description?: string;
  detector_name?: string;
  instances?: AderynInstance[];
}

interface AderynInstance {
  contract_path?: string;
  line_no?: number;
  src?: string;
  src_char?: string;
}

const SEVERITY_FROM_BUCKET: Record<string, AuditSeverity> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "info",
  nc: "info",
};

const DETECTOR_CATEGORY: Record<string, AuditCategory> = {
  centralization_risk: "centralization",
  centralization: "centralization",
  reentrancy_state_change: "reentrancy",
  reentrancy: "reentrancy",
  unchecked_send: "unchecked_call",
  unchecked_low_level_call: "unchecked_call",
  unchecked_return: "unchecked_call",
  delegate_call_loop: "delegatecall_risk",
  delegate_call: "delegatecall_risk",
  selfdestruct: "selfdestruct_risk",
  arbitrary_transfer_from: "access_control",
  block_timestamp_deadline: "timestamp_dependence",
  weak_randomness: "weak_prng",
  tx_origin: "tx_origin",
  unsafe_erc20_operations: "unchecked_call",
  unsafe_oz_initialization: "uninitialized_state",
  uninitialized_state_variables: "uninitialized_state",
  uninitialized_local_variable: "uninitialized_state",
  zero_address_check: "uninitialized_state",
  contract_locks_ether: "denial_of_service",
  costly_loop: "denial_of_service",
  void_constructor: "code_quality",
  empty_block: "code_quality",
  large_literal_value: "code_quality",
  literal_instead_of_constant: "code_quality",
  unused_state_variable: "code_quality",
  unused_imports: "code_quality",
  use_of_floating_pragma: "code_quality",
  push_zero_opcode: "code_quality",
  shadowing_local_variables: "shadowing",
  shadowing_state_variables: "shadowing",
  inconsistent_decimals: "code_quality",
  missing_events_arithmetic: "missing_events",
  storage_array_edit_with_memory: "code_quality",
};

export async function detectAderyn() {
  return detectBinary("aderyn", ["--version"]);
}

/**
 * Run Aderyn against the workspace. Aderyn writes its output to a file by
 * default (`report.json`); we point it at the workspace root and read the
 * resulting JSON.
 */
export async function runAderyn(workspace: SourceWorkspace): Promise<ToolRunResult> {
  const detection = await detectAderyn();
  if (!detection.available) {
    return {
      tool: "aderyn",
      available: false,
      unavailableReason:
        "aderyn binary not found on PATH. Install with: cargo install aderyn (or use the prebuilt binary from github.com/Cyfrin/aderyn).",
      durationMs: 0,
      findings: [],
    };
  }

  const start = Date.now();
  const reportPath = join(workspace.rootDir, "aderyn-report.json");
  const args = [
    workspace.rootDir,
    "--output",
    reportPath,
    "--no-snippets",
  ];

  let result;
  try {
    result = await runProcess("aderyn", args, {
      timeoutMs: ADERYN_TIMEOUT_MS,
      acceptNonZero: true,
      cwd: workspace.rootDir,
    });
  } catch (err) {
    return {
      tool: "aderyn",
      available: true,
      durationMs: Date.now() - start,
      findings: [],
      rawError: err instanceof Error ? err.message : String(err),
    };
  }

  let json: AderynReport;
  try {
    const raw = await readFile(reportPath, "utf-8");
    json = JSON.parse(raw) as AderynReport;
  } catch (err) {
    return {
      tool: "aderyn",
      available: true,
      durationMs: Date.now() - start,
      findings: [],
      rawError: `aderyn JSON not produced: ${err instanceof Error ? err.message : String(err)}. stderr: ${result.stderr.slice(0, 400)}`,
    };
  }

  const findings: ToolFinding[] = [];
  for (const [bucket, groups] of Object.entries(json.issues ?? {})) {
    if (!Array.isArray(groups)) continue;
    const severity = SEVERITY_FROM_BUCKET[bucket] ?? "info";
    for (const group of groups) {
      const detectorId = group.detector_name ?? slugify(group.title ?? "unknown");
      const category = DETECTOR_CATEGORY[detectorId] ?? guessCategory(detectorId);
      const confidence: AuditConfidence = severity === "high" || severity === "critical" ? "medium" : "low";

      const instances = group.instances ?? [];
      if (instances.length === 0) {
        findings.push(makeFinding(detectorId, group, severity, confidence, category, undefined, undefined));
        continue;
      }
      for (const inst of instances) {
        const snippet = await readFileSlice(workspace, inst.contract_path, inst.line_no);
        findings.push(
          makeFinding(detectorId, group, severity, confidence, category, inst, snippet)
        );
      }
    }
  }

  return {
    tool: "aderyn",
    available: true,
    durationMs: Date.now() - start,
    findings,
  };
}

function makeFinding(
  detectorId: string,
  group: AderynIssueGroup,
  severity: AuditSeverity,
  confidence: AuditConfidence,
  category: AuditCategory,
  inst: AderynInstance | undefined,
  snippet: string | undefined
): ToolFinding {
  const file = inst?.contract_path;
  const line = inst?.line_no;
  const id = createHash("sha1")
    .update(`aderyn|${detectorId}|${file ?? ""}|${line ?? 0}`)
    .digest("hex")
    .slice(0, 16);
  return {
    id,
    tool: "aderyn",
    category,
    severity,
    confidence,
    title: group.title ?? humanize(detectorId),
    description: (group.description ?? "").trim().slice(0, 1_500),
    filePath: file,
    startLine: line,
    endLine: line,
    codeSnippet: snippet,
    rawDetectorId: detectorId,
    raw: { group, instance: inst },
  };
}

async function readFileSlice(
  workspace: SourceWorkspace,
  filePath: string | undefined,
  line: number | undefined
): Promise<string | undefined> {
  if (!filePath || !line) return undefined;
  const matchKey = Object.keys(workspace.files).find(
    (k) => k === filePath || k.endsWith(filePath)
  );
  const abs = matchKey ? workspace.files[matchKey] : undefined;
  if (!abs) return undefined;
  try {
    const content = await readFile(abs, "utf-8");
    const lines = content.split(/\r?\n/);
    const lo = Math.max(1, line - 2);
    const hi = Math.min(lines.length, line + 2);
    return lines.slice(lo - 1, hi).join("\n");
  } catch {
    return undefined;
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function humanize(detector: string): string {
  return detector
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function guessCategory(detector: string): AuditCategory {
  const d = detector.toLowerCase();
  if (d.includes("reentr")) return "reentrancy";
  if (d.includes("delegate")) return "delegatecall_risk";
  if (d.includes("selfdestruct") || d.includes("suicidal")) return "selfdestruct_risk";
  if (d.includes("centraliz") || d.includes("admin") || d.includes("owner")) return "centralization";
  if (d.includes("uninit") || d.includes("zero_address")) return "uninitialized_state";
  if (d.includes("origin")) return "tx_origin";
  if (d.includes("event")) return "missing_events";
  if (d.includes("shadow")) return "shadowing";
  if (d.includes("loop") || d.includes("dos")) return "denial_of_service";
  if (d.includes("timestamp") || d.includes("deadline")) return "timestamp_dependence";
  if (d.includes("random") || d.includes("prng")) return "weak_prng";
  if (d.includes("unchecked") || d.includes("transfer") || d.includes("call")) return "unchecked_call";
  return "other";
}
