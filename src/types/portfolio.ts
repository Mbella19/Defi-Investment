export interface PortfolioPosition {
  id: string;
  poolId: string;
  protocol: string;
  chain: string;
  symbol: string;
  investedAmount: number;
  entryApy: number;
  entryTvl: number;
  entryDate: string;
  riskAppetite: "low" | "medium" | "high";
}

export interface AlertConfig {
  apyDropWarning: number;
  apyDropCritical: number;
  tvlDrainWarning: number;
  tvlDrainCritical: number;
}

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "apy_drop"
  | "tvl_drain"
  | "rebalance"
  | "protocol_tvl_crash"
  | "protocol_paused"
  | "exploit_alert";

export interface AlertEvent {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  positionId: string;
  protocol: string;
  symbol: string;
  chain: string;
  message: string;
  detail: string;
  timestamp: string;
  currentValue?: number;
  entryValue?: number;
  changePercent?: number;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  apyDropWarning: 20,
  apyDropCritical: 50,
  tvlDrainWarning: 30,
  tvlDrainCritical: 50,
};
