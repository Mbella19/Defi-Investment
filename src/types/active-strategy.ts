import type { InvestmentStrategy, StrategyCriteria } from "./strategy";
import type { AlertSeverity, AlertType } from "./portfolio";

export type StrategyStatus = "active" | "paused" | "archived";

export interface ActiveStrategy {
  id: string;
  walletAddress: string | null;
  strategy: InvestmentStrategy;
  criteria: StrategyCriteria;
  status: StrategyStatus;
  projectedApy: number;
  totalBudget: number;
  createdAt: string;
  updatedAt: string;
  alertCount?: number;
}

export interface StrategyAlert {
  id: string;
  strategyId: string;
  type: AlertType;
  severity: AlertSeverity;
  poolId: string | null;
  protocol: string;
  symbol: string;
  chain: string;
  message: string;
  detail: string;
  suggestion: string | null;
  read: boolean;
  createdAt: string;
}
