export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type DeployerRiskLevel = "safe" | "caution" | "high_risk" | "avoid";

export interface DeployerTrace {
  contractAddress: string;
  chainId: number;
  chainName: string;
  creatorAddress: string;
  creationTxHash: string;
  creationBlockTimestamp: number | null;
  creatorFirstSeen: number | null;
  creatorAgeDays: number | null;
  creatorTxCount: number | null;
  fundingSources: FundingSource[];
  otherDeployments: OtherDeployment[];
  priorExploits: PriorExploit[];
  flags: DeployerFlag[];
}

export interface FundingSource {
  address: string;
  label: string | null;
  firstFundingTxHash: string;
  firstFundingValueEth: number;
  firstFundingTimestamp: number;
  riskCategory: "cex" | "tornado" | "mixer" | "bridge" | "contract" | "eoa" | "unknown";
}

export interface OtherDeployment {
  address: string;
  creationTxHash: string;
  creationTimestamp: number;
  label: string | null;
}

export interface PriorExploit {
  date: number;
  name: string;
  amount: number;
  technique: string;
  matchedContract: string;
}

export interface DeployerFlag {
  severity: Severity;
  code: string;
  message: string;
}

export interface DeployerForensicsReport {
  trace: DeployerTrace;
  riskLevel: DeployerRiskLevel;
  score: number;
  summary: string;
  reasoning: string[];
  recommendations: string[];
  analyzedAt: string;
  dualAi?: {
    claudeOk: boolean;
    codexOk: boolean;
    claudeSummary?: string;
    codexSummary?: string;
    errors: { source: "claude" | "codex"; error: string }[];
  };
}

export type VulnerabilityCategory =
  | "access_control"
  | "reentrancy"
  | "unbounded_mint"
  | "unchecked_call"
  | "delegatecall_risk"
  | "selfdestruct_risk"
  | "upgrade_proxy"
  | "oracle_dependency"
  | "flash_loan_exposure"
  | "unlimited_approval"
  | "owner_privilege";

export interface CandidateSnippet {
  id: string;
  category: VulnerabilityCategory;
  startLine: number;
  endLine: number;
  code: string;
  reason: string;
}

export type AiSource = "claude" | "codex";
export type Consensus = "both" | "claude-only" | "codex-only";

export interface AuditFinding {
  id: string;
  category: VulnerabilityCategory;
  severity: Severity;
  title: string;
  description: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  confidence: number;
  verified: boolean;
  recommendation: string;
  consensus?: Consensus;
  claudeConfidence?: number;
  codexConfidence?: number;
}

export interface DualAiMeta {
  claudeOk: boolean;
  codexOk: boolean;
  bothConfirmed: number;
  claudeOnly: number;
  codexOnly: number;
  errors: { source: AiSource; error: string }[];
}

export interface SourceAuditReport {
  contractAddress: string;
  chainId: number;
  chainName: string;
  contractName: string;
  compilerVersion: string;
  isVerified: boolean;
  linesOfCode: number;
  candidatesScanned: number;
  findings: AuditFinding[];
  overallScore: number;
  overallVerdict: "clean" | "review" | "dangerous";
  analyzedAt: string;
  rejectedFindings: number;
  dualAi?: DualAiMeta;
}

export type ExploitAlertSeverity = "critical" | "high" | "medium" | "low";

export interface ExploitAlert {
  id: string;
  source: "heuristic";
  alertId: string;
  protocol: string | null;
  address: string | null;
  chainId: number | null;
  severity: ExploitAlertSeverity;
  name: string;
  description: string;
  txHash: string | null;
  detectedAt: number;
  raw: Record<string, unknown>;
}

export interface RelevantAlert extends ExploitAlert {
  affectedStrategyIds: string[];
  relevanceScore: number;
  actionItems: string[];
  aiInterpretation: string;
  dualAi?: {
    claudeOk: boolean;
    codexOk: boolean;
    claudeRelevance?: number;
    codexRelevance?: number;
    claudeInterpretation?: string;
    codexInterpretation?: string;
  };
}
