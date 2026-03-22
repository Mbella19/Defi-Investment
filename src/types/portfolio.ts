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
  apyDropWarning: number;   // % drop threshold for warning (default 20)
  apyDropCritical: number;  // % drop threshold for critical (default 50)
  tvlDrainWarning: number;  // % drain threshold for warning (default 30)
  tvlDrainCritical: number; // % drain threshold for critical (default 50)
  exploitAlerts: boolean;   // monitor for exploits (default true)
}

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType = "apy_drop" | "tvl_drain" | "exploit" | "rebalance";

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
  exploitAlerts: true,
};
