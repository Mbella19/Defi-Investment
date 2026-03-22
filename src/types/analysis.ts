export interface AnalysisSection {
  title: string;
  score: number;
  assessment: string;
  keyFindings: string[];
}

export interface ProtocolAnalysis {
  protocolName: string;
  slug: string;
  legitimacyScore: number;
  overallVerdict:
    | "high_confidence"
    | "moderate_confidence"
    | "low_confidence"
    | "caution";
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
}
