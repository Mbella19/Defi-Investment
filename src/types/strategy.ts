export interface StrategyCriteria {
  budget: number;
  riskAppetite: "low" | "medium" | "high";
  targetApyMin: number;
  targetApyMax: number;
  assetType?: "stablecoins" | "all";
}

export interface StrategyAllocation {
  protocol: string;
  chain: string;
  symbol: string;
  poolId: string;
  apy: number;
  tvl: number;
  stablecoin: boolean;
  allocationAmount: number;
  allocationPercent: number;
  reasoning: string;
  legitimacyScore: number;
  verdict: "high_confidence" | "moderate_confidence" | "low_confidence" | "caution";
  redFlags: string[];
}

export type CritiqueCategory =
  | "concentration"
  | "safety"
  | "risk_mismatch"
  | "allocation"
  | "diversification"
  | "reasoning"
  | "missing_data"
  | "other";

export type CritiqueSeverity = "high" | "medium" | "low";

export interface CritiquePoint {
  category: CritiqueCategory;
  severity: CritiqueSeverity;
  issue: string;
  suggestion: string;
  addressed?: boolean;
}

export interface CollaborationTrail {
  /** Did both Claude (proposer/reviser) and Codex (reviewer) succeed? */
  bothAisAvailable: boolean;
  /** Concerns Codex raised about Claude's initial proposal. */
  critiquePoints: CritiquePoint[];
  /** APY of the initial Claude proposal, before Codex review and Claude revision. */
  initialProjectedApy: number;
  /** APY of the final revised strategy. */
  finalProjectedApy: number;
  /** Pool IDs Claude initially proposed but were dropped/replaced after critique. */
  droppedPoolIds: string[];
  /** Pool IDs introduced in the revision that weren't in the initial. */
  addedPoolIds: string[];
  /** Codex's overall verdict on the initial proposal. */
  codexVerdict: "approve" | "revise" | "reject" | "unavailable";
  /** Plain-language note about what changed and why. */
  revisionNotes: string;
}

export interface InvestmentStrategy {
  summary: string;
  projectedApy: number;
  projectedYearlyReturn: number;
  riskAssessment: string;
  allocations: StrategyAllocation[];
  diversificationNotes: string;
  warnings: string[];
  steps: string[];
  generatedAt: string;
  collaboration?: CollaborationTrail;
}
