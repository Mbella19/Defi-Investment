import type { DefiLlamaProtocol } from "@/types/pool";
import type { GroundTruthChecks } from "@/types/analysis";
import { getDb } from "@/lib/db";
import { CHAIN_NAME_TO_ID } from "./etherscan";
import { peekCachedAudit } from "./source-audit";
import { peekCachedForensics } from "./deployer-forensics";

const AUDIT_LINK_TIMEOUT_MS = 8_000;
const EXPLOIT_LOOKBACK_DAYS = 30;
const TVL_CRASH_1D_PCT = -40;
const TVL_CRASH_7D_PCT = -55;

/**
 * HEAD-request each audit link concurrently to verify it actually resolves.
 * A protocol claiming "3 audits" with all dead links is a meaningful signal
 * that no AI ensemble can reliably catch from text alone.
 */
async function verifyAuditLinks(
  links: string[]
): Promise<GroundTruthChecks["auditLinks"]> {
  const claimed = links.length;
  if (claimed === 0) {
    return { claimed: 0, verified: 0, broken: 0, details: [] };
  }

  const checks = await Promise.all(
    links.slice(0, 8).map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AUDIT_LINK_TIMEOUT_MS);
      try {
        // Many static audit hosts (PDF on S3, GitHub raw, etc.) reject HEAD with 405.
        // Use HEAD first and fall back to a ranged GET so we don't false-flag good links.
        let res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
        });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(url, {
            method: "GET",
            redirect: "follow",
            headers: { Range: "bytes=0-0" },
            signal: controller.signal,
          });
        }
        return {
          url,
          ok: res.ok || res.status === 206,
          status: res.status,
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { url, ok: false, error: error.slice(0, 120) };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const verified = checks.filter((c) => c.ok).length;
  const broken = checks.length - verified;
  return { claimed, verified, broken, details: checks };
}

/**
 * Query the local exploit_alerts DB for recent alerts naming this protocol.
 * Free, instant, deterministic. If the protocol was exploited last week, this
 * MUST surface — overrides any AI optimism.
 */
function queryRecentExploits(
  protocolName: string,
  protocolSlug: string
): GroundTruthChecks["recentExploitAlerts"] {
  const cutoff = Math.floor(Date.now() / 1000) - EXPLOIT_LOOKBACK_DAYS * 86400;
  try {
    const db = getDb();
    // Match either the canonical protocol name or slug, case-insensitive.
    const rows = db
      .prepare(
        `SELECT name, severity, detected_at, protocol
         FROM exploit_alerts
         WHERE detected_at >= ?
           AND (LOWER(protocol) = LOWER(?) OR LOWER(protocol) = LOWER(?))
         ORDER BY detected_at DESC
         LIMIT 10`
      )
      .all(cutoff, protocolName, protocolSlug) as Array<{
      name: string;
      severity: string;
      detected_at: number;
      protocol: string;
    }>;

    return {
      count: rows.length,
      lookbackDays: EXPLOIT_LOOKBACK_DAYS,
      alerts: rows.map((r) => ({
        name: r.name,
        severity: r.severity,
        detectedAt: r.detected_at,
      })),
    };
  } catch {
    // DB might not be initialized yet — exploit_alerts table is created on first
    // monitor run. Treat as "no alerts" rather than failing the analysis.
    return { count: 0, lookbackDays: EXPLOIT_LOOKBACK_DAYS, alerts: [] };
  }
}

function detectTvlCrash(protocol: DefiLlamaProtocol): GroundTruthChecks["tvlCrash"] {
  const change1d = typeof protocol.change_1d === "number" ? protocol.change_1d : null;
  const change7d = typeof protocol.change_7d === "number" ? protocol.change_7d : null;
  const crashed =
    (change1d !== null && change1d <= TVL_CRASH_1D_PCT) ||
    (change7d !== null && change7d <= TVL_CRASH_7D_PCT);
  return { change1d, change7d, crashed };
}

function readOnChainCaches(
  protocol: DefiLlamaProtocol
): GroundTruthChecks["onChain"] {
  const result: GroundTruthChecks["onChain"] = {
    deployerForensicsAvailable: false,
    sourceAuditAvailable: false,
  };

  if (!protocol.address) return result;

  // protocol.chain is a string like "Ethereum"; resolve to chainId for cache lookup.
  const chain = protocol.chain || (protocol.chains?.[0] ?? "Ethereum");
  const matchKey = Object.keys(CHAIN_NAME_TO_ID).find(
    (k) => k.toLowerCase() === chain.toLowerCase()
  );
  const chainId = matchKey ? CHAIN_NAME_TO_ID[matchKey] : null;
  if (chainId === null) return result;

  const forensics = peekCachedForensics(chainId, protocol.address);
  if (forensics) {
    result.deployerForensicsAvailable = true;
    result.deployerRiskLevel = forensics.riskLevel;
    result.deployerScore = forensics.score;
  }

  const audit = peekCachedAudit(chainId, protocol.address);
  if (audit) {
    result.sourceAuditAvailable = true;
    result.sourceAuditVerdict = audit.overallVerdict;
    result.sourceAuditScore = audit.overallScore;
  }

  return result;
}

/**
 * Gather all ground-truth checks for a protocol in parallel. None of these
 * call AI — they're verifiable facts (HTTP HEAD, SQL, cache reads, arithmetic).
 * Designed to ground the AI ensemble in reality and back the heuristic veto.
 */
export async function gatherGroundTruth(
  protocol: DefiLlamaProtocol
): Promise<GroundTruthChecks> {
  const auditLinks = protocol.audit_links || [];
  const [linkCheck] = await Promise.all([verifyAuditLinks(auditLinks)]);
  const recentExploitAlerts = queryRecentExploits(protocol.name, protocol.slug);
  const tvlCrash = detectTvlCrash(protocol);
  const onChain = readOnChainCaches(protocol);

  return {
    auditLinks: linkCheck,
    recentExploitAlerts,
    tvlCrash,
    onChain,
  };
}

/**
 * Format ground-truth facts for inclusion in an AI prompt. The block lists
 * verifiable facts the AI must engage with rather than hallucinate around.
 */
export function formatGroundTruthForPrompt(gt: GroundTruthChecks): string {
  const lines: string[] = ["GROUND-TRUTH FACTS (verified, non-AI):"];

  if (gt.auditLinks.claimed > 0) {
    lines.push(
      `- Audit links: ${gt.auditLinks.claimed} claimed, ${gt.auditLinks.verified} resolve, ${gt.auditLinks.broken} BROKEN`
    );
    if (gt.auditLinks.broken > 0) {
      const brokenUrls = gt.auditLinks.details
        .filter((d) => !d.ok)
        .map((d) => `${d.url} (${d.status ?? d.error ?? "unreachable"})`)
        .slice(0, 3);
      lines.push(`  Broken: ${brokenUrls.join(" | ")}`);
    }
  } else {
    lines.push("- Audit links: 0 claimed");
  }

  if (gt.recentExploitAlerts.count > 0) {
    lines.push(
      `- RECENT EXPLOIT ALERTS (${gt.recentExploitAlerts.lookbackDays}d): ${gt.recentExploitAlerts.count} alert(s) naming this protocol`
    );
    for (const a of gt.recentExploitAlerts.alerts.slice(0, 5)) {
      const when = new Date(a.detectedAt * 1000).toISOString().slice(0, 10);
      lines.push(`  · [${a.severity}] ${a.name} on ${when}`);
    }
  } else {
    lines.push(`- Recent exploit alerts (${gt.recentExploitAlerts.lookbackDays}d): none`);
  }

  if (gt.tvlCrash.change1d !== null || gt.tvlCrash.change7d !== null) {
    const c1 = gt.tvlCrash.change1d !== null ? `${gt.tvlCrash.change1d.toFixed(1)}%` : "N/A";
    const c7 = gt.tvlCrash.change7d !== null ? `${gt.tvlCrash.change7d.toFixed(1)}%` : "N/A";
    lines.push(`- TVL change: 1d=${c1} | 7d=${c7}${gt.tvlCrash.crashed ? " ← CRASH SIGNAL" : ""}`);
  }

  if (gt.onChain.deployerForensicsAvailable) {
    lines.push(
      `- Deployer forensics (cached): risk=${gt.onChain.deployerRiskLevel} score=${gt.onChain.deployerScore}/100`
    );
  }
  if (gt.onChain.sourceAuditAvailable) {
    lines.push(
      `- On-chain source audit (cached): verdict=${gt.onChain.sourceAuditVerdict} score=${gt.onChain.sourceAuditScore}/100`
    );
  }
  if (!gt.onChain.deployerForensicsAvailable && !gt.onChain.sourceAuditAvailable) {
    lines.push("- On-chain checks: no cached deployer/audit data");
  }

  return lines.join("\n");
}
