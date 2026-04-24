import type { PortfolioPosition, AlertConfig, AlertEvent } from "@/types/portfolio";
import type { DefiLlamaPool } from "@/types/pool";

export function runMonitorScan(
  positions: PortfolioPosition[],
  currentPools: DefiLlamaPool[],
  config: AlertConfig
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
      const dropPercent = ((pos.entryApy - currentApy) / pos.entryApy) * 100;

      if (dropPercent >= config.apyDropCritical) {
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
      } else if (dropPercent >= config.apyDropWarning) {
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

    if (currentPool && pos.entryTvl > 0) {
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
      alerts.push({
        id: `missing-${pos.id}`,
        type: "tvl_drain",
        severity: "warning",
        positionId: pos.id,
        protocol: pos.protocol,
        symbol: pos.symbol,
        chain: pos.chain,
        message: "Pool no longer found on DeFiLlama",
        detail: "This pool may have been removed or deprecated",
        timestamp: new Date().toISOString(),
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
