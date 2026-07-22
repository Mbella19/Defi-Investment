import type { StrategyCriteria } from "@/types/strategy";

export const GENERIC_STRATEGY_FAILURE =
  "Allocation generation failed after automatic retry. Please try again shortly.";

export type StrategyErrorCode =
  | "criteria_too_restrictive"
  | "generation_failed"
  | "job_interrupted";

export class StrategyGenerationError extends Error {
  readonly code: StrategyErrorCode;
  readonly retryable: boolean;
  readonly publicMessage: string;

  constructor(options: {
    code: StrategyErrorCode;
    message: string;
    publicMessage: string;
    retryable: boolean;
  }) {
    super(options.message);
    this.name = "StrategyGenerationError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.publicMessage = options.publicMessage;
  }
}

export interface StrategyFailure {
  code: StrategyErrorCode;
  internalMessage: string;
  publicMessage: string;
  retryable: boolean;
}

export function criteriaTooRestrictiveError(options: {
  criteria: StrategyCriteria;
  eligiblePoolCount: number;
  eligibleProtocolCount: number;
  requiredPoolCount: number;
}): StrategyGenerationError {
  const { criteria, eligiblePoolCount, eligibleProtocolCount, requiredPoolCount } = options;
  const availability = eligiblePoolCount === 0
    ? "No markets passed"
    : `Only ${eligiblePoolCount} market${eligiblePoolCount === 1 ? "" : "s"} passed`;
  const nextStep = criteria.assetType === "stablecoins"
    ? "Widen the APY range or turn off “Stablecoin sleeves only”, then generate again."
    : "Widen the APY range, then generate again.";

  return new StrategyGenerationError({
    code: "criteria_too_restrictive",
    retryable: false,
    message:
      `Strategy criteria produced ${eligiblePoolCount} eligible pools across ` +
      `${eligibleProtocolCount} protocols; at least ${requiredPoolCount} pools are required`,
    publicMessage:
      `${availability} your APY, asset, stability, and safety requirements; ` +
      `at least ${requiredPoolCount} are required for a diversified mandate. ${nextStep}`,
  });
}

export function insufficientReviewedProtocolsError(options: {
  criteria: StrategyCriteria;
  eligibleProtocolCount: number;
  requiredProtocolCount: number;
}): StrategyGenerationError {
  const { criteria, eligibleProtocolCount, requiredProtocolCount } = options;
  const availability = eligibleProtocolCount === 0
    ? "No independently reviewed protocols passed"
    : `Only ${eligibleProtocolCount} independently reviewed protocol${
        eligibleProtocolCount === 1 ? "" : "s"
      } passed`;
  const nextStep = criteria.assetType === "stablecoins"
    ? "Widen the APY range or turn off “Stablecoin sleeves only”, then generate again."
    : "Widen the APY range, then generate again.";

  return new StrategyGenerationError({
    code: "criteria_too_restrictive",
    retryable: false,
    message:
      `Strategy criteria produced ${eligibleProtocolCount} eligible protocols; ` +
      `at least ${requiredProtocolCount} independently reviewed protocols are required`,
    publicMessage:
      `${availability} your APY, asset, stability, and safety requirements; at least ` +
      `${requiredProtocolCount} are required for a diversified mandate. ${nextStep}`,
  });
}

export function describeStrategyFailure(error: unknown): StrategyFailure {
  if (error instanceof StrategyGenerationError) {
    return {
      code: error.code,
      internalMessage: error.message,
      publicMessage: error.publicMessage,
      retryable: error.retryable,
    };
  }

  return {
    code: "generation_failed",
    internalMessage: error instanceof Error ? error.message : String(error),
    publicMessage: GENERIC_STRATEGY_FAILURE,
    retryable: true,
  };
}
