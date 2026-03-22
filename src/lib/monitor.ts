import type { PortfolioPosition, AlertConfig, AlertEvent, DEFAULT_ALERT_CONFIG } from "@/types/portfolio";
import type { DefiLlamaPool } from "@/types/pool";
import type { HackEntry } from "@/lib/defillama";

export function runMonitorScan(
  positions: PortfolioPosition[],
  currentPools: DefiLlamaPool[],
  hacks: HackEntry[],
  config: AlertConfig
): AlertEvent[] {
  const alerts: AlertEvent[] = [];
  const poolMap = new Map<string, DefiLlamaPool>();
  for (const pool of currentPools) {
    poolMap.set(pool.pool, pool);
  }

  for (const pos of positions) {
    const currentPool = poolMap.get(pos.poolId);

    // APY drop check
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

    // TVL drain check
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

    // Exploit check
    if (config.exploitAlerts) {
      const protocolHacks = hacks.filter((h) => {
        const target = (h.target || h.name || "").toLowerCase();
        return target.includes(pos.protocol.toLowerCase());
      });

      const entryTimestamp = new Date(pos.entryDate).getTime() / 1000;
      const recentHacks = protocolHacks.filter((h) => h.date > entryTimestamp);

      for (const hack of recentHacks) {
        alerts.push({
          id: `exploit-${pos.id}-${hack.id || hack.date}`,
          type: "exploit",
          severity: "critical",
          positionId: pos.id,
          protocol: pos.protocol,
          symbol: pos.symbol,
          chain: pos.chain,
          message: `Protocol was exploited for $${(hack.amount / 1e6).toFixed(2)}M`,
          detail: `Method: ${hack.technique || "Unknown"}. Date: ${new Date(hack.date * 1000).toLocaleDateString()}`,
          timestamp: new Date().toISOString(),
          currentValue: hack.amount,
        });
      }
    }

    // Pool not found
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

  // Sort by severity: critical first
  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
