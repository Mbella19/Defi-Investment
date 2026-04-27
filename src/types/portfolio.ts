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
  /**
   * Volatility-aware noise floor for APY drops. The relative drop must clear
   * `apyDropWarning|Critical` AND the absolute drop (in percentage points)
   * must exceed `apyVolatilityFloorMultiplier × stdDev6m` for the pool. Pools
   * without history are gated only by the relative threshold.
   */
  apyVolatilityFloorMultiplier: number;
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
  apyDropWarning: 35,
  apyDropCritical: 60,
  tvlDrainWarning: 40,
  tvlDrainCritical: 65,
  apyVolatilityFloorMultiplier: 2.5,
};
