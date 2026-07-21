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
  /**
   * Protocol-level canonical address reported by DeFiLlama. This is a
   * convenient audit starting point, but is not guaranteed to be this pool's
   * vault, market, or strategy contract.
   */
  contractAddress?: string;
  /** Chain on which `contractAddress` is deployed (often differs from `chain` for multi-chain protocols). */
  auditChain?: string;
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

/** Which reviewer raised a critique. */
export type ReviewerSource = "codex" | "gemini";

/** Verdict issued by one reviewer. */
export type ReviewerVerdict = "approve" | "revise" | "reject" | "unavailable";

export interface CritiquePoint {
  category: CritiqueCategory;
  severity: CritiqueSeverity;
  issue: string;
  suggestion: string;
  addressed?: boolean;
  /**
   * Whether this concern is verifiable by the deterministic resolver. True if
   * it cites a specific poolId (we can check drop/cut/rewrite) or is in the
   * "allocation" category (we can check budget sum). False for abstract or
   * stylistic concerns where the resolver can't prove a change happened.
   */
  verifiable?: boolean;
  /**
   * If the lead reviser (Codex) consciously kept the disputed decision in the
   * revision, the rationale it gave for rejecting this concern. Surfaced in
   * the UI so every high-severity concern has a recorded outcome (addressed
   * OR explicitly rejected with a reason).
   */
  leadRejection?: string;
  /** Which AI(s) raised this concern. Multiple if they both flagged the same thing. */
  sources?: ReviewerSource[];
}

export interface CollaborationTrail {
  /** Was the reviewer (Gemini) available alongside the Codex lead + revision? */
  bothAisAvailable: boolean;
  /** Concerns the reviewer raised about the lead's (Codex) initial proposal. */
  critiquePoints: CritiquePoint[];
  /** APY of the initial Codex proposal, before reviewer critique and revision. */
  initialProjectedApy: number;
  /** APY of the final revised strategy. */
  finalProjectedApy: number;
  /** Pool IDs the lead initially proposed but were dropped/replaced after critique. */
  droppedPoolIds: string[];
  /** Pool IDs introduced in the revision that weren't in the initial. */
  addedPoolIds: string[];
  /** @deprecated use reviewerVerdicts.codex — kept for backwards compatibility with older cached strategies. */
  codexVerdict: ReviewerVerdict;
  /** Per-reviewer verdicts. Each reviewer may be unavailable independently. */
  reviewerVerdicts: {
    codex: ReviewerVerdict;
    gemini: ReviewerVerdict;
  };
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
