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
  const client = createPublicClient({ chain, transport: http() }) as PublicClient;
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
const PAUSE_CHECK_LIMIT_PER_STRATEGY = 5;
const PAUSE_CHECK_TIMEOUT_MS = 6_000;

async function isContractPaused(address: string, chainId: number): Promise<boolean> {
  if (!isAddress(address)) return false;
  const client = getClient(chainId);
  if (!client) return false;
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
    return result === true;
  } catch {
    return false;
  }
}

interface StoredExploitRow {
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
      `SELECT protocol, address, chain_id, severity, name, description, tx_hash, detected_at
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
}

export interface MonitorScanResult {
  scanned: number;
  newAlerts: StrategyMonitorAlert[];
}

export async function monitorActiveStrategies(
  strategyId?: string,
): Promise<MonitorScanResult> {
  const db = getDb();

  const rows = strategyId
    ? db.prepare("SELECT * FROM active_strategies WHERE id = ? AND status = 'active'").all(strategyId)
    : db.prepare("SELECT * FROM active_strategies WHERE status = 'active'").all();

  if ((rows as unknown[]).length === 0) {
    return { scanned: 0, newAlerts: [] };
  }

  const [allPools, allProtocols] = await Promise.all([
    fetchAllPools().catch(() => [] as DefiLlamaPool[]),
    fetchProtocols().catch(() => [] as DefiLlamaProtocol[]),
  ]);
  const recentExploits = loadRecentExploits();
  const protocolIndex = buildProtocolIndex(allProtocols);

  const dedupStmt = db.prepare(
    `SELECT COUNT(*) as count FROM strategy_alerts
     WHERE strategy_id = ? AND type = ? AND COALESCE(pool_id, '') = COALESCE(?, '')
     AND created_at > datetime('now', '-24 hours')`,
  );

  const insertStmt = db.prepare(
    `INSERT INTO strategy_alerts (id, strategy_id, type, severity, pool_id, protocol, symbol, chain, message, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const newAlerts: StrategyMonitorAlert[] = [];

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
  ): void {
    const { count } = dedupStmt.get(sId, type, poolId) as { count: number };
    if (count > 0) return;
    const alertId = crypto.randomUUID();
    insertStmt.run(alertId, sId, type, severity, poolId, protocol, symbol, chain, message, detail);
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
      createdAt: new Date().toISOString(),
    });
  }

  for (const row of rows as Record<string, unknown>[]) {
    const sId = row.id as string;
    const strategy = JSON.parse(row.strategy_json as string) as InvestmentStrategy;
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

    const baseAlerts: AlertEvent[] = runMonitorScan(positions, allPools, DEFAULT_ALERT_CONFIG);
    // Map the synthesized positionId back to the real DeFiLlama pool ID so
    // the alert can be deep-linked to the actual pool page (otherwise we'd
    // store "<strategyId>-<realPoolId>-<index>" as the pool_id and the
    // "Pool data" link would 500).
    const positionToPool = new Map(positions.map((p) => [p.id, p.poolId]));
    for (const alert of baseAlerts) {
      tryInsert(
        sId,
        alert.type,
        alert.severity,
        positionToPool.get(alert.positionId) ?? null,
        alert.protocol,
        alert.symbol,
        alert.chain,
        alert.message,
        alert.detail,
      );
    }

    const seenProtocols = new Set<string>();
    for (const alloc of strategy.allocations) {
      const protoKey = normalizeName(alloc.protocol);
      if (seenProtocols.has(protoKey)) continue;
      seenProtocols.add(protoKey);

      const proto = findProtocol(alloc, protocolIndex);
      if (!proto) continue;

      const change1d = proto.change_1d ?? 0;
      const change7d = proto.change_7d ?? 0;

      if (change1d <= -PROTOCOL_TVL_CRASH_1D_PCT) {
        tryInsert(
          sId,
          "protocol_tvl_crash",
          "critical",
          alloc.poolId,
          alloc.protocol,
          alloc.symbol,
          alloc.chain,
          `${proto.name} TVL crashed ${Math.abs(change1d).toFixed(0)}% in 24h`,
          `Protocol-wide TVL fell from prior day. Current TVL: $${(proto.tvl / 1e6).toFixed(1)}M. Possible exploit, depeg, or coordinated exit — verify before adding funds.`,
        );
      } else if (change7d <= -PROTOCOL_TVL_CRASH_7D_PCT) {
        tryInsert(
          sId,
          "protocol_tvl_crash",
          "warning",
          alloc.poolId,
          alloc.protocol,
          alloc.symbol,
          alloc.chain,
          `${proto.name} TVL down ${Math.abs(change7d).toFixed(0)}% over 7d`,
          `Sustained protocol-wide outflow. Current TVL: $${(proto.tvl / 1e6).toFixed(1)}M. Investigate cause before deploying capital.`,
        );
      }
    }

    const pauseCandidates = strategy.allocations
      .filter((a) => a.contractAddress && isAddress(a.contractAddress))
      .slice(0, PAUSE_CHECK_LIMIT_PER_STRATEGY);

    if (pauseCandidates.length > 0) {
      const pauseResults = await Promise.allSettled(
        pauseCandidates.map(async (alloc) => {
          const chainId = chainNameToId(alloc.auditChain || alloc.chain);
          if (!chainId) return { alloc, paused: false };
          const paused = await isContractPaused(alloc.contractAddress!, chainId);
          return { alloc, paused };
        }),
      );

      for (const r of pauseResults) {
        if (r.status !== "fulfilled") continue;
        if (!r.value.paused) continue;
        const alloc = r.value.alloc;
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
          );
          break;
        }
      }
    }
  }

  if (newAlerts.length > 0 && isDiscordWebhookConfigured()) {
    // Fire-and-forget — webhook failures must not abort the scan.
    void sendDiscordAlertBatch(newAlerts).catch(() => undefined);
  }

  return { scanned: (rows as unknown[]).length, newAlerts };
}
