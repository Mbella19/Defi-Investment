import { createHash, randomUUID } from "crypto";
import { createPublicClient, http, type PublicClient, isAddress } from "viem";
import {
  mainnet,
  arbitrum,
  optimism,
  polygon,
  base,
  bsc,
  avalanche,
  fantom,
} from "viem/chains";
import { getDb } from "@/lib/db";
import { fetchAllPools, fetchProtocols } from "@/lib/defillama";
import { runMonitorScan } from "@/lib/monitor";
import { sendDiscordAlertBatch, isDiscordWebhookConfigured } from "@/lib/discord-notifier";
import { dispatchAlertBatch } from "@/lib/notifications/dispatcher";
import { getPoolStability, type PoolStability } from "@/lib/pool-stability";
import { mapWithConcurrency } from "@/lib/async-utils";
import { getRpcUrl } from "@/lib/rpc";
import { log } from "@/lib/log";
import {
  refreshExploitFeed,
  type MonitoredStrategy,
} from "@/lib/security/exploit-monitor";
import { DEFAULT_ALERT_CONFIG } from "@/types/portfolio";
import type { AlertEvent } from "@/types/portfolio";
import type { PortfolioPosition } from "@/types/portfolio";
import type { DefiLlamaPool, DefiLlamaProtocol } from "@/types/pool";
import type { InvestmentStrategy, StrategyCriteria, StrategyAllocation } from "@/types/strategy";

const CHAINS = {
  1: mainnet,
  10: optimism,
  56: bsc,
  137: polygon,
  250: fantom,
  8453: base,
  42161: arbitrum,
  43114: avalanche,
} as const;

type SupportedChainId = keyof typeof CHAINS;

const CHAIN_NAME_TO_ID: Record<string, number> = {
  ethereum: 1,
  optimism: 10,
  bsc: 56,
  binance: 56,
  polygon: 137,
  fantom: 250,
  base: 8453,
  arbitrum: 42161,
  avalanche: 43114,
  avax: 43114,
};

const clientCache = new Map<number, PublicClient>();

function getClient(chainId: number): PublicClient | null {
  const chain = CHAINS[chainId as SupportedChainId];
  if (!chain) return null;
  const cached = clientCache.get(chainId);
  if (cached) return cached;
  const client = createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  }) as PublicClient;
  clientCache.set(chainId, client);
  return client;
}

function chainNameToId(name: string | undefined | null): number | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return CHAIN_NAME_TO_ID[key] ?? null;
}

const PAUSED_ABI = [
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

const PROTOCOL_TVL_CRASH_1D_PCT = 40;
const PROTOCOL_TVL_CRASH_7D_PCT = 55;
const EXPLOIT_LOOKBACK_HOURS = 72;
const PAUSE_CHECK_LIMIT_PER_STRATEGY = 10;
const PAUSE_SCAN_INTERVAL_MS = 15 * 60 * 1000;
const PAUSE_CHECK_TIMEOUT_MS = 6_000;
// APY/TVL drops must persist across this many consecutive 15-min scans before
// firing — kills single-snapshot dips that DeFiLlama's spot endpoint catches
// during transient utilization swings.
const REQUIRED_CONFIRMATIONS = 2;

interface PauseCheckResult {
  available: boolean;
  paused: boolean;
}

async function isContractPaused(address: string, chainId: number): Promise<PauseCheckResult> {
  if (!isAddress(address)) return { available: false, paused: false };
  const client = getClient(chainId);
  if (!client) return { available: false, paused: false };
  try {
    const result = await Promise.race([
      client.readContract({
        address: address as `0x${string}`,
        abi: PAUSED_ABI,
        functionName: "paused",
      }),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error("pause check timeout")), PAUSE_CHECK_TIMEOUT_MS),
      ),
    ]);
    return { available: true, paused: result === true };
  } catch {
    return { available: false, paused: false };
  }
}

interface StoredExploitRow {
  source: string;
  protocol: string | null;
  address: string | null;
  chain_id: number | null;
  severity: string;
  name: string;
  description: string;
  tx_hash: string | null;
  detected_at: number;
}

function loadRecentExploits(): StoredExploitRow[] {
  const db = getDb();
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='exploit_alerts'")
    .get() as { name: string } | undefined;
  if (!tableExists) return [];

  const cutoff = Math.floor(Date.now() / 1000) - EXPLOIT_LOOKBACK_HOURS * 3600;
  return db
    .prepare(
      `SELECT source, protocol, address, chain_id, severity, name, description, tx_hash, detected_at
       FROM exploit_alerts
       WHERE detected_at >= ?
       ORDER BY detected_at DESC`,
    )
    .all(cutoff) as StoredExploitRow[];
}

function normalizeName(s: string | undefined | null): string {
  return (s || "").toLowerCase().replace(/[\s_-]+/g, "");
}

function matchExploit(
  exploit: StoredExploitRow,
  alloc: StrategyAllocation,
): boolean {
  const allocationChainId = chainNameToId(alloc.auditChain || alloc.chain);
  // A chain-scoped exploit must never match an allocation whose chain is
  // unknown: protocol names are reused across deployments and a permissive
  // match would generate cross-chain false positives.
  if (exploit.chain_id !== null && allocationChainId !== exploit.chain_id) {
    return false;
  }
  const ePro = normalizeName(exploit.protocol);
  const aPro = normalizeName(alloc.protocol);
  if (ePro && aPro && (ePro === aPro || ePro.includes(aPro) || aPro.includes(ePro))) {
    return true;
  }
  const eAddr = (exploit.address || "").toLowerCase();
  const aAddr = (alloc.contractAddress || "").toLowerCase();
  if (eAddr && aAddr && eAddr === aAddr) return true;
  return false;
}

function buildProtocolIndex(protocols: DefiLlamaProtocol[]): Map<string, DefiLlamaProtocol> {
  const idx = new Map<string, DefiLlamaProtocol>();
  for (const p of protocols) {
    if (p.slug) idx.set(normalizeName(p.slug), p);
    if (p.name) idx.set(normalizeName(p.name), p);
  }
  return idx;
}

function findProtocol(
  alloc: StrategyAllocation,
  index: Map<string, DefiLlamaProtocol>,
): DefiLlamaProtocol | null {
  return index.get(normalizeName(alloc.protocol)) ?? null;
}

export interface StrategyMonitorAlert {
  id: string;
  strategyId: string;
  type: string;
  severity: string;
  poolId: string | null;
  protocol: string;
  symbol: string;
  chain: string;
  message: string;
  detail: string;
  createdAt: string;
  /** Owner of the strategy that produced this alert. Used for per-user dispatch. */
  walletAddress?: string;
}

export interface MonitorScanResult {
  scanned: number;
  newAlerts: StrategyMonitorAlert[];
}

export async function monitorActiveStrategies(
  strategyId?: string,
  walletAddress?: string,
): Promise<MonitorScanResult> {
  const db = getDb();
  const wallet = walletAddress?.toLowerCase();

  const rows = strategyId
    ? wallet
      ? db
          .prepare(
            "SELECT * FROM active_strategies WHERE id = ? AND lower(wallet_address) = ? AND status = 'active'",
          )
          .all(strategyId, wallet)
      : db.prepare("SELECT * FROM active_strategies WHERE id = ? AND status = 'active'").all(strategyId)
    : wallet
      ? db
          .prepare("SELECT * FROM active_strategies WHERE lower(wallet_address) = ? AND status = 'active'")
          .all(wallet)
      : db.prepare("SELECT * FROM active_strategies WHERE status = 'active'").all();

  if ((rows as unknown[]).length === 0) {
    return { scanned: 0, newAlerts: [] };
  }

  const [allPools, allProtocols] = await Promise.all([
    fetchAllPools().catch(() => [] as DefiLlamaPool[]),
    fetchProtocols().catch(() => [] as DefiLlamaProtocol[]),
  ]);
  const protocolIndex = buildProtocolIndex(allProtocols);

  const uniquePoolIds = new Set<string>();
  const exploitTargets: MonitoredStrategy[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    try {
      const strategy = JSON.parse(row.strategy_json as string) as InvestmentStrategy;
      const criteria = JSON.parse(row.criteria_json as string) as StrategyCriteria;
      for (const [index, alloc] of strategy.allocations.entries()) {
        if (alloc.poolId) uniquePoolIds.add(alloc.poolId);
        const address = alloc.contractAddress;
        exploitTargets.push({
          id: `${String(row.id)}:${alloc.poolId}:${index}`,
          protocol: alloc.protocol,
          symbol: alloc.symbol,
          chain: alloc.auditChain || alloc.chain,
          poolId: alloc.poolId,
          addresses: address && isAddress(address) ? [address] : [],
          investedAmount: alloc.allocationAmount,
          riskAppetite: criteria.riskAppetite,
        });
      }
    } catch {
      // malformed strategy json — skip; runMonitorScan will also skip it
    }
  }

  // Keep the persisted exploit feed fresh on the normal scheduler path. This
  // deterministic scan deliberately avoids AI relevance analysis so holdings
  // from different wallets are never combined in an external prompt.
  let exploitRefreshComplete = exploitTargets.length === 0;
  if (exploitTargets.length > 0) {
    try {
      const refresh = await refreshExploitFeed(exploitTargets, allPools);
      exploitRefreshComplete = refresh.succeededTargets === refresh.attemptedTargets;
      if (refresh.succeededTargets < refresh.attemptedTargets) {
        log.warn("strategy-monitor", "exploit feed coverage was partial", {
          attempted: refresh.attemptedTargets,
          succeeded: refresh.succeededTargets,
          totalTargets: refresh.totalTargets,
        });
      }
    } catch (error) {
      log.warn("strategy-monitor", "exploit feed refresh failed", { error });
    }
  }
  const recentExploits = loadRecentExploits();
  // Capped fan-out — getPoolStability resolves null on failure, so no
  // per-item error handling needed here.
  const stabilityResults = await mapWithConcurrency(
    [...uniquePoolIds],
    10,
    async (poolId) => [poolId, await getPoolStability(poolId)] as const,
  );
  const stabilityByPool = new Map<string, PoolStability | null>();
  for (const [poolId, stab] of stabilityResults) {
    stabilityByPool.set(poolId, stab);
  }

  const insertStmt = db.prepare(
    `INSERT INTO strategy_alerts (id, strategy_id, type, severity, pool_id, protocol, symbol, chain, message, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const readIncidentStmt = db.prepare(
    `SELECT state, severity FROM alert_incidents WHERE incident_key = ? AND strategy_id = ?`,
  );
  const findLegacyAlertStmt = db.prepare(
    `SELECT id FROM strategy_alerts
     WHERE strategy_id = ? AND type = ?
       AND COALESCE(pool_id, '') = COALESCE(?, '')
       AND lower(protocol) = lower(?)
       AND created_at > datetime('now', '-24 hours')
       AND created_at <= COALESCE(
         (SELECT applied_at FROM schema_migrations
          WHERE name = 'monitoring_and_notification_integrity_v1'),
         '1970-01-01'
       )
     ORDER BY created_at DESC LIMIT 1`,
  );
  const upsertIncidentStmt = db.prepare(
    `INSERT INTO alert_incidents
       (incident_key, strategy_id, alert_id, state, severity, opened_at, updated_at, incident_type, subject_key)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?)
     ON CONFLICT(incident_key) DO UPDATE SET
       alert_id = excluded.alert_id,
       state = 'open',
       severity = excluded.severity,
       opened_at = excluded.opened_at,
       updated_at = excluded.updated_at,
       incident_type = excluded.incident_type,
       subject_key = excluded.subject_key`,
  );
  const touchIncidentStmt = db.prepare(
    `UPDATE alert_incidents SET updated_at = ?
     WHERE incident_key = ? AND strategy_id = ? AND state = 'open'`,
  );
  const escalateIncidentStmt = db.prepare(
    `UPDATE alert_incidents SET alert_id = ?, severity = ?, updated_at = ?
     WHERE incident_key = ? AND strategy_id = ? AND state = 'open'`,
  );
  const recoverIncidentStmt = db.prepare(
    `UPDATE alert_incidents SET state = 'recovered', updated_at = ?
     WHERE incident_key = ? AND strategy_id = ? AND state = 'open'`,
  );
  const readOpenIncidentsStmt = db.prepare(
    `SELECT incident_key, incident_type FROM alert_incidents
     WHERE strategy_id = ? AND state = 'open'`,
  );

  // Breach-state CRUD — track consecutive scans where a position-level alert
  // condition is met. Reset to zero (delete) the moment the condition clears.
  const readBreachStmt = db.prepare(
    `SELECT pool_id, alert_type, consecutive_breaches FROM strategy_breach_state WHERE strategy_id = ?`,
  );
  const upsertBreachStmt = db.prepare(
    `INSERT INTO strategy_breach_state (strategy_id, pool_id, alert_type, severity, consecutive_breaches)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(strategy_id, pool_id, alert_type) DO UPDATE SET
       consecutive_breaches = consecutive_breaches + 1,
       severity = excluded.severity,
       last_breach_at = datetime('now')`,
  );
  const deleteBreachStmt = db.prepare(
    `DELETE FROM strategy_breach_state WHERE strategy_id = ? AND pool_id = ? AND alert_type = ?`,
  );
  const readSingleBreachStmt = db.prepare(
    `SELECT consecutive_breaches FROM strategy_breach_state WHERE strategy_id = ? AND pool_id = ? AND alert_type = ?`,
  );

  const newAlerts: StrategyMonitorAlert[] = [];

  // strategyId → wallet_address. Built as we iterate the strategy rows so
  // alert dispatch can fan out per-user without an extra DB roundtrip.
  const strategyToWallet = new Map<string, string>();
  const seenIncidentsByStrategy = new Map<string, Set<string>>();

  function incidentKey(sId: string, type: string, subject: string): string {
    return createHash("sha256")
      .update(`${sId}\u0000${type}\u0000${subject.trim().toLowerCase()}`)
      .digest("hex");
  }

  function severityRank(severity: string): number {
    switch (severity.toLowerCase()) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "medium":
      case "warning":
        return 2;
      case "info":
      case "low":
      default:
        return 1;
    }
  }

  function markRecovered(sId: string, type: string, subject: string): void {
    recoverIncidentStmt.run(Date.now(), incidentKey(sId, type, subject), sId);
  }

  function recoverAbsent(sId: string, types: Set<string>): void {
    const seen = seenIncidentsByStrategy.get(sId) ?? new Set<string>();
    const open = readOpenIncidentsStmt.all(sId) as Array<{
      incident_key: string;
      incident_type: string | null;
    }>;
    const now = Date.now();
    for (const incident of open) {
      if (incident.incident_type && types.has(incident.incident_type) && !seen.has(incident.incident_key)) {
        recoverIncidentStmt.run(now, incident.incident_key, sId);
      }
    }
  }

  function tryInsert(
    sId: string,
    type: string,
    severity: string,
    poolId: string | null,
    protocol: string,
    symbol: string,
    chain: string,
    message: string,
    detail: string,
    subjectKey = poolId ?? normalizeName(protocol),
  ): void {
    const key = incidentKey(sId, type, subjectKey);
    const seen = seenIncidentsByStrategy.get(sId) ?? new Set<string>();
    seen.add(key);
    seenIncidentsByStrategy.set(sId, seen);

    const createdAt = new Date().toISOString();
    const alertId = db.transaction((): string | null => {
      const incident = readIncidentStmt.get(key, sId) as
        | { state: string; severity: string }
        | undefined;
      if (incident?.state === "open") {
        const now = Date.now();
        if (severityRank(severity) <= severityRank(incident.severity)) {
          // Preserve the highest observed severity until recovery. A later
          // weaker reading should not silently downgrade an active incident.
          touchIncidentStmt.run(now, key, sId);
          return null;
        }

        // A warning becoming critical is a materially new event and must be
        // delivered even though the underlying incident remains open.
        const id = randomUUID();
        insertStmt.run(id, sId, type, severity, poolId, protocol, symbol, chain, message, detail);
        escalateIncidentStmt.run(id, severity, now, key, sId);
        return id;
      }

      // Seed incident state from a recent pre-migration alert so deployment
      // does not resend an already-visible event once.
      if (!incident) {
        const legacy = findLegacyAlertStmt.get(sId, type, poolId, protocol) as
          | { id: string }
          | undefined;
        if (legacy) {
          const now = Date.now();
          upsertIncidentStmt.run(
            key,
            sId,
            legacy.id,
            severity,
            now,
            now,
            type,
            subjectKey,
          );
          return null;
        }
      }

      const id = randomUUID();
      insertStmt.run(id, sId, type, severity, poolId, protocol, symbol, chain, message, detail);
      const now = Date.now();
      upsertIncidentStmt.run(key, sId, id, severity, now, now, type, subjectKey);
      return id;
    })();
    if (!alertId) return;
    newAlerts.push({
      id: alertId,
      strategyId: sId,
      type,
      severity,
      poolId,
      protocol,
      symbol,
      chain,
      message,
      detail,
      createdAt,
      walletAddress: strategyToWallet.get(sId),
    });
  }

  for (const row of rows as Record<string, unknown>[]) {
    const sId = row.id as string;
    // Everything per-strategy is guarded — one malformed row (bad JSON,
    // missing allocations) must degrade to a skipped strategy, never abort
    // the sweep for every other user.
    try {
    const ownerWallet = (row.wallet_address as string | null | undefined)?.toLowerCase();
    if (ownerWallet) strategyToWallet.set(sId, ownerWallet);
    const strategy = JSON.parse(row.strategy_json as string) as InvestmentStrategy;
    if (!Array.isArray(strategy?.allocations)) {
      throw new Error("strategy_json has no allocations[]");
    }
    const criteria = JSON.parse(row.criteria_json as string) as StrategyCriteria;
    const createdAt = row.created_at as string;

    const positions: PortfolioPosition[] = strategy.allocations.map((alloc, i) => ({
      id: `${sId}-${alloc.poolId}-${i}`,
      poolId: alloc.poolId,
      protocol: alloc.protocol,
      chain: alloc.chain,
      symbol: alloc.symbol,
      investedAmount: alloc.allocationAmount,
      entryApy: alloc.apy,
      entryTvl: alloc.tvl,
      entryDate: createdAt,
      riskAppetite: criteria.riskAppetite,
    }));

    const baseAlerts: AlertEvent[] = runMonitorScan(
      positions,
      allPools,
      DEFAULT_ALERT_CONFIG,
      stabilityByPool,
    );
    // Map the synthesized positionId back to the real DeFiLlama pool ID so
    // the alert can be deep-linked to the actual pool page (otherwise we'd
    // store "<strategyId>-<realPoolId>-<index>" as the pool_id and the
    // "Pool data" link would 500).
    const positionToPool = new Map(positions.map((p) => [p.id, p.poolId]));

    // Skip breach-state mutation entirely if DeFiLlama gave us nothing this
    // tick — otherwise we'd wipe the breach counter on every API outage.
    if (allPools.length > 0) {
      const triggeredKeys = new Set<string>();
      const triggeredAlerts: Array<{ key: string; poolId: string; alert: AlertEvent }> = [];
      for (const alert of baseAlerts) {
        const poolId = positionToPool.get(alert.positionId);
        if (!poolId) continue;
        const key = `${poolId}|${alert.type}`;
        triggeredKeys.add(key);
        triggeredAlerts.push({ key, poolId, alert });
      }

      // Recovered positions: clear any breach rows whose underlying condition
      // is no longer triggering this scan.
      const existingBreaches = readBreachStmt.all(sId) as Array<{
        pool_id: string;
        alert_type: string;
        consecutive_breaches: number;
      }>;
      for (const row of existingBreaches) {
        const k = `${row.pool_id}|${row.alert_type}`;
        if (!triggeredKeys.has(k)) {
          deleteBreachStmt.run(sId, row.pool_id, row.alert_type);
        }
      }

      // For each currently triggered alert: bump the breach counter and only
      // emit once it reaches the confirmation threshold.
      for (const { poolId, alert } of triggeredAlerts) {
        upsertBreachStmt.run(sId, poolId, alert.type, alert.severity);
        const { consecutive_breaches } = readSingleBreachStmt.get(
          sId,
          poolId,
          alert.type,
        ) as { consecutive_breaches: number };
        if (consecutive_breaches < REQUIRED_CONFIRMATIONS) continue;
        tryInsert(
          sId,
          alert.type,
          alert.severity,
          poolId,
          alert.protocol,
          alert.symbol,
          alert.chain,
          alert.message,
          alert.detail,
        );
      }
      recoverAbsent(sId, new Set(["apy_drop", "tvl_drain"]));
    }

    // Group allocations by protocol so a multi-pool exposure surfaces every
    // affected position in the alert detail. Earlier code keyed dedup by
    // protocol but then attached the FIRST pool's id and symbol to the alert,
    // silently dropping every subsequent exposure (auditor #16).
    const allocsByProtocol = new Map<string, StrategyAllocation[]>();
    for (const alloc of strategy.allocations) {
      const protoKey = normalizeName(alloc.protocol);
      if (!protoKey) continue;
      const list = allocsByProtocol.get(protoKey);
      if (list) list.push(alloc);
      else allocsByProtocol.set(protoKey, [alloc]);
    }

    for (const allocs of allocsByProtocol.values()) {
      const sample = allocs[0];
      const proto = findProtocol(sample, protocolIndex);
      if (!proto) continue;

      const change1d = proto.change_1d ?? 0;
      const change7d = proto.change_7d ?? 0;
      if (change1d > -PROTOCOL_TVL_CRASH_1D_PCT && change7d > -PROTOCOL_TVL_CRASH_7D_PCT) continue;

      const totalExposure = allocs.reduce((sum, a) => sum + a.allocationAmount, 0);
      const positions = allocs
        .map((a) => `${a.symbol} on ${a.chain} ($${a.allocationAmount.toLocaleString()})`)
        .join(", ");
      const exposureLine = `Affected positions (${allocs.length}): ${positions}. Total exposure: $${totalExposure.toLocaleString()}.`;

      if (change1d <= -PROTOCOL_TVL_CRASH_1D_PCT) {
        tryInsert(
          sId,
          "protocol_tvl_crash",
          "critical",
          // Protocol-wide event — null pool_id so the deep-link doesn't
          // misleadingly point at one pool when multiple are affected.
          null,
          sample.protocol,
          sample.symbol,
          sample.chain,
          `${proto.name} TVL crashed ${Math.abs(change1d).toFixed(0)}% in 24h`,
          `Protocol-wide TVL fell from prior day. Current TVL: $${(proto.tvl / 1e6).toFixed(1)}M. ${exposureLine} Possible exploit, depeg, or coordinated exit — verify before adding funds.`,
        );
      } else {
        tryInsert(
          sId,
          "protocol_tvl_crash",
          "warning",
          null,
          sample.protocol,
          sample.symbol,
          sample.chain,
          `${proto.name} TVL down ${Math.abs(change7d).toFixed(0)}% over 7d`,
          `Sustained protocol-wide outflow. Current TVL: $${(proto.tvl / 1e6).toFixed(1)}M. ${exposureLine} Investigate cause before deploying capital.`,
        );
      }
    }
    if (allProtocols.length > 0) {
      recoverAbsent(sId, new Set(["protocol_tvl_crash"]));
    }

    const orderedPauseCandidates = strategy.allocations
      .filter((a) => a.contractAddress && isAddress(a.contractAddress))
      .sort((a, b) =>
        `${a.auditChain || a.chain}:${a.contractAddress!.toLowerCase()}`.localeCompare(
          `${b.auditChain || b.chain}:${b.contractAddress!.toLowerCase()}`,
        ),
      );
    const pauseBatchSize = Math.min(
      PAUSE_CHECK_LIMIT_PER_STRATEGY,
      orderedPauseCandidates.length,
    );
    const pauseStart = orderedPauseCandidates.length
      ? (Math.floor(Date.now() / PAUSE_SCAN_INTERVAL_MS) * PAUSE_CHECK_LIMIT_PER_STRATEGY) %
        orderedPauseCandidates.length
      : 0;
    const pauseCandidates = Array.from(
      { length: pauseBatchSize },
      (_, index) => orderedPauseCandidates[(pauseStart + index) % orderedPauseCandidates.length],
    );

    if (pauseCandidates.length > 0) {
      const pauseResults = await Promise.allSettled(
        pauseCandidates.map(async (alloc) => {
          const chainId = chainNameToId(alloc.auditChain || alloc.chain);
          if (!chainId) return { alloc, available: false, paused: false };
          const result = await isContractPaused(alloc.contractAddress!, chainId);
          return { alloc, ...result };
        }),
      );

      for (const r of pauseResults) {
        if (r.status !== "fulfilled") continue;
        const alloc = r.value.alloc;
        if (!r.value.available) continue;
        const subject = alloc.contractAddress!.toLowerCase();
        if (!r.value.paused) {
          markRecovered(sId, "protocol_paused", subject);
          continue;
        }
        tryInsert(
          sId,
          "protocol_paused",
          "critical",
          alloc.poolId,
          alloc.protocol,
          alloc.symbol,
          alloc.chain,
          `${alloc.protocol} contract is paused`,
          `On-chain paused() returned true for ${alloc.contractAddress}. Withdrawals likely suspended — check protocol announcements.`,
          subject,
        );
      }
    }

    if (recentExploits.length > 0) {
      for (const alloc of strategy.allocations) {
        for (const exploit of recentExploits) {
          if (!matchExploit(exploit, alloc)) continue;
          const sev =
            exploit.severity === "critical" || exploit.severity === "high"
              ? "critical"
              : "warning";
          const detectedAgo = Math.round((Date.now() / 1000 - exploit.detected_at) / 3600);
          tryInsert(
            sId,
            "exploit_alert",
            sev,
            alloc.poolId,
            alloc.protocol,
            alloc.symbol,
            alloc.chain,
            `Exploit alert matches ${alloc.protocol}: ${exploit.name}`,
            `${exploit.description.slice(0, 220)} (detected ${detectedAgo}h ago${exploit.tx_hash ? `, tx ${exploit.tx_hash.slice(0, 10)}…` : ""})`,
            exploit.source === "heuristic" && exploit.address
              ? `heuristic:${exploit.chain_id ?? "unknown"}:${exploit.address.toLowerCase()}`
              : `${exploit.source}:${exploit.chain_id ?? "unknown"}:${exploit.tx_hash ?? exploit.detected_at}:${exploit.address ?? exploit.protocol ?? "unknown"}:${exploit.name}`,
          );
        }
      }
    }
    if (exploitRefreshComplete) {
      recoverAbsent(sId, new Set(["exploit_alert"]));
    }
    } catch (err) {
      log.warn("strategy-monitor", "skipping malformed or unscannable strategy", {
        strategyId: sId,
        error: err,
      });
      continue;
    }
  }

  if (newAlerts.length > 0) {
    // Per-user dispatch via the notifications layer. Fans out to every
    // verified+enabled channel each user has configured (email, telegram,
    // slack, discord) and that their tier permits. Delivery is backed by a
    // durable outbox, so a process exit cannot silently discard an alert.
    await dispatchAlertBatch(newAlerts);

    // Server-wide Discord webhook (legacy / ops). If configured, ALL alerts
    // also fan out to a single ops channel for staff visibility. Independent
    // of per-user channels — keep, remove, or hard-disable later.
    if (isDiscordWebhookConfigured()) {
      await sendDiscordAlertBatch(newAlerts).catch(() => undefined);
    }
  }

  return { scanned: (rows as unknown[]).length, newAlerts };
}
