import type { PortfolioPosition, AlertConfig, AlertEvent } from "@/types/portfolio";
import type { DefiLlamaPool } from "@/types/pool";
import type { PoolStability } from "@/lib/pool-stability";

// Pools that started below this entry TVL produce too much noise — small
// LPs naturally swing 30–50% on routine flow. We still alert on their APY
// drops (yield collapse is meaningful at any size), just not on TVL movement.
const MIN_ENTRY_TVL_FOR_DRAIN_ALERT = 1_000_000;
// DeFiLlama occasionally drops a pool from its index temporarily (re-indexing,
// chain reorg, schema change). For freshly opened positions the lookup race
// is the most likely cause of a "missing" result, not a real depreciation.
const MIN_POSITION_AGE_DAYS_FOR_MISSING_ALERT = 7;
// A pool whose APY has zero variance still shouldn't fire on sub-percentage-
// point dips — those are rounding, not signal.
const MIN_ABSOLUTE_DROP_PP = 1.0;

export function runMonitorScan(
  positions: PortfolioPosition[],
  currentPools: DefiLlamaPool[],
  config: AlertConfig,
  stabilityByPool?: Map<string, PoolStability | null>,
): AlertEvent[] {
  const alerts: AlertEvent[] = [];
  const poolMap = new Map<string, DefiLlamaPool>();
  for (const pool of currentPools) {
    poolMap.set(pool.pool, pool);
  }

  for (const pos of positions) {
    const currentPool = poolMap.get(pos.poolId);

    if (currentPool && pos.entryApy > 0) {
      const currentApy = currentPool.apy || 0;
      const dropPp = pos.entryApy - currentApy;
      const dropPercent = (dropPp / pos.entryApy) * 100;

      // Volatility floor: require the absolute drop to clear ~k σ of the
      // pool's historical daily APY noise. Pools without enough history fall
      // back to the bare MIN_ABSOLUTE_DROP_PP so a single utilization dip on
      // a stable pool can't fire a critical alert.
      const stability = stabilityByPool?.get(pos.poolId);
      const stdDev = stability?.apyStdDev6m ?? 0;
      const volatilityFloor = Math.max(
        MIN_ABSOLUTE_DROP_PP,
        config.apyVolatilityFloorMultiplier * stdDev,
      );
      const passesFloor = dropPp >= volatilityFloor;

      if (passesFloor && dropPercent >= config.apyDropCritical) {
        alerts.push({
          id: `apy-crit-${pos.id}`,
          type: "apy_drop",
          severity: "critical",
          positionId: pos.id,
          protocol: pos.protocol,
          symbol: pos.symbol,
          chain: pos.chain,
          message: `APY dropped ${dropPercent.toFixed(0)}% since entry`,
          detail: `Entry APY: ${pos.entryApy.toFixed(2)}% → Current: ${currentApy.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
          currentValue: currentApy,
          entryValue: pos.entryApy,
          changePercent: -dropPercent,
        });
      } else if (passesFloor && dropPercent >= config.apyDropWarning) {
        alerts.push({
          id: `apy-warn-${pos.id}`,
          type: "apy_drop",
          severity: "warning",
          positionId: pos.id,
          protocol: pos.protocol,
          symbol: pos.symbol,
          chain: pos.chain,
          message: `APY dropped ${dropPercent.toFixed(0)}% since entry`,
          detail: `Entry APY: ${pos.entryApy.toFixed(2)}% → Current: ${currentApy.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
          currentValue: currentApy,
          entryValue: pos.entryApy,
          changePercent: -dropPercent,
        });
      }
    }

    if (currentPool && pos.entryTvl >= MIN_ENTRY_TVL_FOR_DRAIN_ALERT) {
      const currentTvl = currentPool.tvlUsd || 0;
      const drainPercent = ((pos.entryTvl - currentTvl) / pos.entryTvl) * 100;

      if (drainPercent >= config.tvlDrainCritical) {
        alerts.push({
          id: `tvl-crit-${pos.id}`,
          type: "tvl_drain",
          severity: "critical",
          positionId: pos.id,
          protocol: pos.protocol,
          symbol: pos.symbol,
          chain: pos.chain,
          message: `TVL drained ${drainPercent.toFixed(0)}% — possible rug pull`,
          detail: `Entry TVL: $${(pos.entryTvl / 1e6).toFixed(2)}M → Current: $${(currentTvl / 1e6).toFixed(2)}M`,
          timestamp: new Date().toISOString(),
          currentValue: currentTvl,
          entryValue: pos.entryTvl,
          changePercent: -drainPercent,
        });
      } else if (drainPercent >= config.tvlDrainWarning) {
        alerts.push({
          id: `tvl-warn-${pos.id}`,
          type: "tvl_drain",
          severity: "warning",
          positionId: pos.id,
          protocol: pos.protocol,
          symbol: pos.symbol,
          chain: pos.chain,
          message: `TVL dropped ${drainPercent.toFixed(0)}% since entry`,
          detail: `Entry TVL: $${(pos.entryTvl / 1e6).toFixed(2)}M → Current: $${(currentTvl / 1e6).toFixed(2)}M`,
          timestamp: new Date().toISOString(),
          currentValue: currentTvl,
          entryValue: pos.entryTvl,
          changePercent: -drainPercent,
        });
      }
    }

    if (!currentPool) {
      const ageDays = pos.entryDate
        ? (Date.now() - new Date(pos.entryDate).getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;
      if (ageDays >= MIN_POSITION_AGE_DAYS_FOR_MISSING_ALERT) {
        alerts.push({
          id: `missing-${pos.id}`,
          type: "tvl_drain",
          severity: "warning",
          positionId: pos.id,
          protocol: pos.protocol,
          symbol: pos.symbol,
          chain: pos.chain,
          message: "Pool no longer found in the live yield feed",
          detail: "This pool may have been removed or deprecated",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
