import { createHash } from "crypto";
import { detectBinary, runProcess, extractSolcSemver, type SourceWorkspace } from "./runtime";
import type {
  AuditCategory,
  AuditConfidence,
  AuditSeverity,
  ToolFinding,
  ToolRunResult,
} from "@/types/audit";

/**
 * Mythril symbolic-execution runner.
 *
 * Mythril is slow (90s-10min depending on contract complexity) but its findings
 * have very high confidence — it constructs concrete inputs that reach the
 * vulnerable state, so a Mythril hit is much closer to a proof-of-exploit than
 * a Slither hit. We give it a hard ceiling and accept that on complex contracts
 * it may bail out partway.
 */

const MYTHRIL_TIMEOUT_MS = 480_000; // 8 minutes
const MYTHRIL_EXEC_TIMEOUT_S = 420; // mythril's own --execution-timeout

interface MythrilJsonReport {
  error?: string | null;
  issues?: MythrilIssue[];
  success?: boolean;
}

interface MythrilIssue {
  title?: string;
  description?: string;
  function?: string;
  address?: number;
  contract?: string;
  filename?: string;
  lineno?: number;
  code?: string;
  swc_id?: string;
  severity?: string; // "High" | "Medium" | "Low"
  type?: string; // "Warning" | etc.
  debug?: string;
}

const SEVERITY_MAP: Record<string, AuditSeverity> = {
  high: "high",
  medium: "medium",
  low: "low",
  informational: "info",
};

// SWC (Smart Contract Weakness Classification) → our category taxonomy.
// See https://swcregistry.io
const SWC_CATEGORY: Record<string, AuditCategory> = {
  "100": "code_quality", // Function default visibility
  "101": "arithmetic", // Integer overflow/underflow
  "102": "code_quality", // Outdated compiler version
  "103": "code_quality", // Floating pragma
  "104": "unchecked_call", // Unchecked call return value
  "105": "access_control", // Unprotected ether withdrawal
  "106": "selfdestruct_risk", // Unprotected selfdestruct
  "107": "reentrancy",
  "108": "code_quality", // State variable default visibility
  "109": "uninitialized_state",
  "110": "code_quality", // Assert violation
  "111": "code_quality", // Use of deprecated functions
  "112": "delegatecall_risk",
  "113": "denial_of_service", // DoS with failed call
  "114": "front_running", // Transaction order dependence
  "115": "tx_origin",
  "116": "timestamp_dependence",
  "117": "code_quality", // Signature malleability
  "118": "code_quality", // Incorrect constructor name
  "119": "code_quality", // Shadowing state variables
  "120": "weak_prng",
  "121": "code_quality", // Missing protection against signature replay
  "122": "code_quality", // Lack of proper signature verification
  "123": "code_quality", // Requirement violation
  "124": "code_quality", // Write to arbitrary storage location
  "125": "code_quality", // Incorrect inheritance order
  "126": "denial_of_service", // Insufficient gas griefing
  "127": "delegatecall_risk", // Arbitrary jump with function type variable
  "128": "denial_of_service", // DoS with block gas limit
  "129": "arithmetic", // Typographical error
  "130": "selfdestruct_risk", // Right-to-left override
  "131": "code_quality", // Presence of unused variables
  "132": "code_quality", // Unexpected ether balance
  "133": "code_quality",
  "134": "denial_of_service", // Message call with hardcoded gas
  "135": "code_quality", // Code with no effects
  "136": "code_quality", // Unencrypted private data on-chain
};

export async function detectMythril() {
  return detectBinary("myth", ["version"]);
}

export async function runMythril(workspace: SourceWorkspace): Promise<ToolRunResult> {
  const detection = await detectMythril();
  if (!detection.available) {
    return {
      tool: "mythril",
      available: false,
      unavailableReason:
        "myth (mythril) binary not found on PATH. Install with: pip install mythril (slow first run; downloads solc).",
      durationMs: 0,
      findings: [],
    };
  }

  const start = Date.now();
  const args: string[] = [
    "analyze",
    workspace.primaryFile,
    "-o",
    "json",
    "--execution-timeout",
    String(MYTHRIL_EXEC_TIMEOUT_S),
    "--max-depth",
    "12",
  ];

  const semver = extractSolcSemver(workspace.compilerVersion);
  if (semver) {
    args.push("--solv", semver);
  }

  let result;
  try {
    result = await runProcess("myth", args, {
      timeoutMs: MYTHRIL_TIMEOUT_MS,
      acceptNonZero: true,
      cwd: workspace.rootDir,
    });
  } catch (err) {
    return {
      tool: "mythril",
      available: true,
      durationMs: Date.now() - start,
      findings: [],
      rawError: err instanceof Error ? err.message : String(err),
    };
  }

  let parsed: MythrilJsonReport;
  try {
    parsed = JSON.parse(result.stdout) as MythrilJsonReport;
  } catch {
    return {
      tool: "mythril",
      available: true,
      durationMs: Date.now() - start,
      findings: [],
      rawError: `mythril produced unparseable JSON. stderr: ${result.stderr.slice(0, 600)}`,
      rawStdout: result.stdout.slice(0, 4_000),
    };
  }

  if (parsed.error) {
    return {
      tool: "mythril",
      available: true,
      durationMs: Date.now() - start,
      findings: [],
      rawError: `mythril error: ${parsed.error}`,
    };
  }

  const issues = parsed.issues ?? [];
  const findings: ToolFinding[] = issues.map((iss) => issueToFinding(iss));

  return {
    tool: "mythril",
    available: true,
    durationMs: Date.now() - start,
    findings,
  };
}

function issueToFinding(iss: MythrilIssue): ToolFinding {
  const swcId = (iss.swc_id ?? "").replace(/^SWC-/, "").trim();
  const category = SWC_CATEGORY[swcId] ?? "other";
  const severity = SEVERITY_MAP[(iss.severity ?? "").toLowerCase()] ?? "medium";
  // Mythril's symbolic execution constructs concrete inputs for each finding,
  // so we treat its hits as high-confidence by default.
  const confidence: AuditConfidence = severity === "high" ? "high" : "medium";

  const id = createHash("sha1")
    .update(`mythril|${swcId || iss.title || "unknown"}|${iss.filename ?? ""}|${iss.lineno ?? 0}`)
    .digest("hex")
    .slice(0, 16);

  return {
    id,
    tool: "mythril",
    category,
    severity,
    confidence,
    title: iss.title ?? `SWC-${swcId}`,
    description: (iss.description ?? "").trim().slice(0, 1_500),
    contract: iss.contract,
    function: iss.function,
    filePath: iss.filename,
    startLine: iss.lineno,
    endLine: iss.lineno,
    codeSnippet: iss.code,
    rawDetectorId: swcId ? `SWC-${swcId}` : iss.title,
    raw: iss,
  };
}
