export interface AnalysisSection {
  title: string;
  score: number;
  assessment: string;
  keyFindings: string[];
}

export type AnalysisAiSource = "claude" | "codex" | "gemini";
export type ProtocolVerdict =
  | "high_confidence"
  | "moderate_confidence"
  | "low_confidence"
  | "caution";

/** Per-AI raw scoring before synthesis. */
export interface PerAiScore {
  source: AnalysisAiSource;
  legitimacyScore: number;
  verdict: ProtocolVerdict;
  summary: string;
  redFlags: string[];
}

/** A specific point of disagreement between the AIs that the synthesizer reconciled. */
export interface AnalysisDisagreement {
  topic: string;
  positions: Array<{ source: AnalysisAiSource; position: string }>;
  resolution: string;
}

/** Output of a fact-grounded ground-truth check. Attached to the analysis so reviewers see what was actually verified. */
export interface GroundTruthChecks {
  auditLinks: {
    claimed: number;
    verified: number;
    broken: number;
    details: Array<{ url: string; ok: boolean; status?: number; error?: string }>;
  };
  recentExploitAlerts: {
    count: number;
    lookbackDays: number;
    alerts: Array<{ name: string; severity: string; detectedAt: number }>;
  };
  tvlCrash: {
    change1d: number | null;
    change7d: number | null;
    crashed: boolean;
  };
  onChain: {
    deployerForensicsAvailable: boolean;
    deployerRiskLevel?: "safe" | "caution" | "high_risk" | "avoid";
    deployerScore?: number;
    sourceAuditAvailable: boolean;
    sourceAuditVerdict?: "clean" | "review" | "dangerous";
    sourceAuditScore?: number;
  };
}

/** Heuristic veto: overrides the AI verdict when ground-truth signals demand it. */
export interface AppliedVeto {
  rule: string;
  forcedVerdict: ProtocolVerdict;
  forcedScoreCeiling?: number;
  reason: string;
}

export interface TripleAiMeta {
  perAi: PerAiScore[];
  /** Which AIs returned valid output. */
  okSources: AnalysisAiSource[];
  /** Which AIs failed and why. */
  errors: Array<{ source: AnalysisAiSource; error: string }>;
  /** True when max-min legitimacyScore spread > 25 across available AIs. */
  disputed: boolean;
  /** Spread between highest and lowest legitimacyScore. */
  scoreSpread: number;
  /** Disagreements the synthesizer reconciled explicitly. */
  disagreements: AnalysisDisagreement[];
  /** Did the synthesis stage (Claude) succeed? */
  synthesisOk: boolean;
  synthesisError?: string;
}

export interface ProtocolAnalysis {
  protocolName: string;
  slug: string;
  legitimacyScore: number;
  overallVerdict: ProtocolVerdict;
  summary: string;
  sections: {
    auditHistory: AnalysisSection;
    teamReputation: AnalysisSection;
    tvlAnalysis: AnalysisSection;
    smartContractRisk: AnalysisSection;
    protocolMaturity: AnalysisSection;
    communityGovernance: AnalysisSection;
  };
  redFlags: string[];
  positiveSignals: string[];
  investmentConsiderations: string[];
  analyzedAt: string;
  /** Triple-AI ensemble metadata. Absent if old single-AI cache. */
  tripleAi?: TripleAiMeta;
  /** Hard ground-truth checks (link verification, exploit DB, TVL crash, on-chain cache). */
  groundTruth?: GroundTruthChecks;
  /** Heuristic vetoes that overrode the AI verdict. Empty if AI verdict held. */
  vetoes?: AppliedVeto[];
}
