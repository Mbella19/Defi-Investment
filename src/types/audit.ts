// Multi-engine audit pipeline types. Distinct from src/types/security.ts so
// the existing source-audit / forensics paths keep working unchanged.

export type AuditSeverity = "critical" | "high" | "medium" | "low" | "info";

export type AuditCategory =
  | "reentrancy"
  | "access_control"
  | "arithmetic"
  | "unchecked_call"
  | "delegatecall_risk"
  | "selfdestruct_risk"
  | "upgrade_proxy"
  | "oracle_dependency"
  | "flash_loan_exposure"
  | "unlimited_approval"
  | "owner_privilege"
  | "centralization"
  | "missing_events"
  | "uninitialized_state"
  | "tx_origin"
  | "weak_prng"
  | "front_running"
  | "denial_of_service"
  | "timestamp_dependence"
  | "code_quality"
  | "unbounded_loop"
  | "shadowing"
  | "low_level_call"
  | "other";

export type ToolName =
  | "slither"
  | "aderyn"
  | "mythril"
  | "regex_pattern"
  | "ai_explainer"
  | "onchain_interrogator";

export type AuditConfidence = "low" | "medium" | "high" | "confirmed";

export interface ToolFinding {
  id: string;
  tool: ToolName;
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  contract?: string;
  function?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  codeSnippet?: string;
  rawDetectorId?: string;
  confidence: AuditConfidence;
  raw?: unknown;
}

export interface ToolRunResult {
  tool: ToolName;
  available: boolean;
  unavailableReason?: string;
  durationMs: number;
  findings: ToolFinding[];
  rawError?: string;
  rawStdout?: string;
}

/* ==================== ON-CHAIN INTERROGATOR ==================== */

export interface ProxyInfo {
  isProxy: boolean;
  pattern: "eip1967" | "uups" | "transparent" | "beacon" | "minimal" | "unknown" | "none";
  implementationAddress?: string;
  adminAddress?: string;
  beaconAddress?: string;
  /** Reading the implementation slot succeeded. */
  detected: boolean;
}

export interface AdminInfo {
  /** Result of `owner()` call if exposed. */
  ownerAddress?: string;
  /** Whether the owner is a contract (multisig?) or EOA. */
  ownerIsContract?: boolean;
  /** Multisig signer count if owner is a Gnosis Safe. */
  multisigThreshold?: number;
  multisigOwners?: number;
  /** Timelock delay in seconds if owner is an OpenZeppelin / Compound Timelock. */
  timelockDelaySeconds?: number;
  /** True iff ownership has been formally renounced (owner == 0x0). */
  renounced?: boolean;
}

export interface ContractMeta {
  address: string;
  chainId: number;
  chainName: string;
  bytecodeSize: number;
  hasCode: boolean;
  /** From Etherscan / verified source. */
  contractName?: string;
  compilerVersion?: string;
  isVerified: boolean;
  /** Timestamp the contract was created (seconds). */
  deployedAt?: number;
  ageDays?: number;
  deployerAddress?: string;
}

export interface OnChainInterrogation {
  meta: ContractMeta;
  proxy: ProxyInfo;
  admin: AdminInfo;
  /** Findings derived from on-chain state (e.g., "owner is EOA, not multisig"). */
  findings: ToolFinding[];
  /** Did the RPC layer fail? */
  errors: string[];
}

/* ==================== OWASP SCSVS ==================== */

export type ScsvsCategoryId =
  | "V1_architecture"
  | "V2_access_control"
  | "V3_blockchain_data"
  | "V4_communications"
  | "V5_arithmetic"
  | "V6_malicious_input"
  | "V7_gas_dos"
  | "V8_business_logic"
  | "V9_denial_of_service"
  | "V10_token"
  | "V11_code_quality"
  | "V12_test_coverage";

export interface ScsvsCheck {
  id: string;
  category: ScsvsCategoryId;
  description: string;
  status: "pass" | "fail" | "manual_review" | "n/a" | "indeterminate";
  evidence?: string[];
  /** Tool finding ids whose presence/absence drove this check. */
  linkedFindingIds?: string[];
}

export interface ScsvsReport {
  checks: ScsvsCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    manualReview: number;
    notApplicable: number;
    indeterminate: number;
    coveragePercent: number;
  };
  byCategory: Array<{
    category: ScsvsCategoryId;
    passed: number;
    failed: number;
    total: number;
  }>;
}

/* ==================== CONSENSUS ==================== */

export interface ConsensusFinding {
  id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  confidence: AuditConfidence;
  title: string;
  description: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  codeSnippet?: string;
  contract?: string;
  function?: string;
  /** Which tools agreed. */
  toolsAgreed: ToolName[];
  /** Original tool findings that merged into this consensus finding. */
  sourceFindingIds: string[];
  /** AI explanation of this finding (filled in by explainer). */
  aiExplanation?: AiExplanation;
}

export interface AiExplanation {
  whatHappened: string;
  whyItMatters: string;
  exploitScenario?: string;
  recommendedFix: string;
  /** Severity confirmed/escalated by AI synthesis. */
  finalSeverity: AuditSeverity;
  /** Which AIs participated. */
  reviewedBy: Array<"claude" | "codex" | "gemini">;
  /** Did all participating AIs agree this is real? */
  aiConsensus: "all" | "majority" | "split" | "single";
  notes?: string;
}

/* ==================== FINAL REPORT ==================== */

export type AuditStage =
  | "starting"
  | "fetching_source"
  | "fetching_onchain"
  | "running_tools"
  | "ai_explanation"
  | "scsvs_mapping"
  | "consensus"
  | "assembling_report"
  | "done"
  | "error";

export interface AuditJobEvent {
  ts: number;
  stage: AuditStage;
  message: string;
  sub?: { done: number; total: number };
}

export interface AuditReport {
  version: 1;
  contractAddress: string;
  chainId: number;
  chainName: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;

  meta: ContractMeta;
  proxy: ProxyInfo;
  admin: AdminInfo;

  toolResults: ToolRunResult[];
  scsvs: ScsvsReport;
  findings: ConsensusFinding[];

  /** Aggregate. */
  riskScore: number;
  verdict: "clean" | "review" | "dangerous" | "critical";
  executiveSummary: string;
  recommendations: string[];

  warnings: string[];
}
