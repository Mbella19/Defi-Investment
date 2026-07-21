import dns from "dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { DefiLlamaProtocol } from "@/types/pool";
import type { GroundTruthChecks } from "@/types/analysis";
import type { AuditReport } from "@/types/audit";
import { getDb } from "@/lib/db";
import { CHAIN_NAME_TO_ID } from "./etherscan";

const AUDIT_LINK_TIMEOUT_MS = 8_000;
const EXPLOIT_LOOKBACK_DAYS = 30;
const TVL_CRASH_1D_PCT = -40;
const TVL_CRASH_7D_PCT = -55;
const MAX_REDIRECTS = 3;
const CONTRACT_AUDIT_TTL_MS = 24 * 60 * 60 * 1000;

/* ===================== SSRF GUARD ===================== */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b, c] = parts;
  if (a === 0) return true;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0/24 IETF reserved
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast/reserved/broadcast
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("2001:db8")) return true; // documentation range
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateIPv4(v4);
  }
  return false;
}

/**
 * Reject URLs that resolve to private/loopback/link-local addresses, or use
 * non-http(s) schemes. This is the SSRF guard for the audit-link checker —
 * a malicious DeFiLlama protocol entry could otherwise list
 * http://localhost:6379/ as an "audit link" and probe internal services.
 */
interface ResolvedPublicUrl {
  url: URL;
  address: string;
  family: 4 | 6;
}

async function resolvePublicUrl(url: string): Promise<ResolvedPublicUrl | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && !((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443"))) {
    return null;
  }
  const host = u.hostname;
  // Strip surrounding brackets from IPv6 literal hosts before testing
  const bareHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  // Literal-IP fast path
  if (/^[\d.]+$/.test(bareHost)) {
    return isPrivateIPv4(bareHost) ? null : { url: u, address: bareHost, family: 4 };
  }
  if (bareHost.includes(":")) {
    return isPrivateIPv6(bareHost) ? null : { url: u, address: bareHost, family: 6 };
  }
  // Hostname → DNS resolve and check every A/AAAA record
  try {
    const records = await dns.lookup(bareHost, { all: true });
    if (records.length === 0) return null;
    for (const r of records) {
      if (r.family === 4 && isPrivateIPv4(r.address)) return null;
      if (r.family === 6 && isPrivateIPv6(r.address)) return null;
    }
    const chosen = records[0];
    return {
      url: u,
      address: chosen.address,
      family: chosen.family as 4 | 6,
    };
  } catch {
    return null;
  }
}

interface SafeHttpResult {
  status: number;
  ok: boolean;
}

function requestPinned(
  target: ResolvedPublicUrl,
  init: { method: "HEAD" | "GET"; headers?: Record<string, string>; signal: AbortSignal },
): Promise<{ status: number; ok: boolean; location: string | null }> {
  return new Promise((resolve, reject) => {
    const transport = target.url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = transport(
      target.url,
      {
        method: init.method,
        headers: init.headers,
        signal: init.signal,
        // Pin the address resolved and vetted above. This closes the DNS
        // rebinding window between a safety lookup and the actual request,
        // while preserving the original hostname for Host/SNI validation.
        lookup: (_hostname, _options, callback) => {
          callback(null, target.address, target.family);
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        // We need only status/redirect headers. Closing immediately also
        // prevents a host that ignores Range from streaming an unbounded body.
        res.destroy();
        resolve({ status, ok: status >= 200 && status < 300, location });
      },
    );
    req.once("error", reject);
    req.end();
  });
}

/**
 * fetch with manual redirect-following so we re-validate every hop against
 * the SSRF guard. A simple `redirect: "follow"` would let an attacker chain
 * a public-looking URL into a 302 → http://169.254.169.254/.
 */
async function safeFetch(
  url: string,
  init: { method: "HEAD" | "GET"; headers?: Record<string, string>; signal: AbortSignal },
): Promise<SafeHttpResult> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const target = await resolvePublicUrl(current);
    if (!target) {
      throw new Error("URL blocked by outbound request policy");
    }
    const res = await requestPinned(target, init);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.location;
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

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
    return { claimed: 0, checked: 0, unchecked: 0, verified: 0, broken: 0, details: [] };
  }

  const checks = await Promise.all(
    links.slice(0, 8).map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AUDIT_LINK_TIMEOUT_MS);
      try {
        // Many static audit hosts (PDF on S3, GitHub raw, etc.) reject HEAD with 405.
        // Use HEAD first and fall back to a ranged GET so we don't false-flag good links.
        // safeFetch enforces SSRF protections at every redirect hop.
        let res = await safeFetch(url, {
          method: "HEAD",
          signal: controller.signal,
        });
        if (res.status === 405 || res.status === 501) {
          res = await safeFetch(url, {
            method: "GET",
            headers: { Range: "bytes=0-0" },
            signal: controller.signal,
          });
        }
        const status = res.status;
        const ok = res.ok || status === 206;
        return {
          url,
          ok,
          status,
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
  return {
    claimed,
    checked: checks.length,
    unchecked: Math.max(0, claimed - checks.length),
    verified,
    broken,
    details: checks,
  };
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

const AUDIT_VERDICTS = new Set<AuditReport["verdict"]>([
  "clean",
  "review",
  "dangerous",
  "critical",
]);

/**
 * Reuse only a recent, completed report from the durable audit pipeline.
 * The old source-audit/deployer caches were process-local and no longer had
 * an entry point, so this ground-truth branch could never become available.
 * Validate the stored JSON before allowing it to influence an AI verdict.
 */
export function readCompletedContractAudit(
  protocol: DefiLlamaProtocol
): GroundTruthChecks["onChain"] {
  const result: GroundTruthChecks["onChain"] = {
    contractAuditAvailable: false,
  };

  if (!protocol.address) return result;

  // protocol.chain is a string like "Ethereum"; resolve to chainId for cache lookup.
  const chain = protocol.chain || (protocol.chains?.[0] ?? "Ethereum");
  const matchKey = Object.keys(CHAIN_NAME_TO_ID).find(
    (k) => k.toLowerCase() === chain.toLowerCase()
  );
  const chainId = matchKey ? CHAIN_NAME_TO_ID[matchKey] : null;
  if (chainId === null) return result;

  try {
    const row = getDb()
      .prepare(
        `SELECT result_json, finished_at
         FROM audit_jobs
         WHERE contract_address = ?
           AND chain_id = ?
           AND status = 'done'
           AND result_json IS NOT NULL
           AND finished_at >= ?
         ORDER BY finished_at DESC
         LIMIT 1`,
      )
      .get(
        protocol.address.toLowerCase(),
        chainId,
        Date.now() - CONTRACT_AUDIT_TTL_MS,
      ) as { result_json: string; finished_at: number } | undefined;

    if (!row) return result;

    const parsed = JSON.parse(row.result_json) as Partial<AuditReport>;
    const score = parsed.riskScore;
    const verdict = parsed.verdict;
    if (
      parsed.version !== 1 ||
      parsed.chainId !== chainId ||
      parsed.contractAddress?.toLowerCase() !== protocol.address.toLowerCase() ||
      typeof verdict !== "string" ||
      !AUDIT_VERDICTS.has(verdict as AuditReport["verdict"]) ||
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !Number.isFinite(row.finished_at)
    ) {
      return result;
    }

    return {
      contractAuditAvailable: true,
      contractAuditVerdict: verdict as AuditReport["verdict"],
      contractAuditRiskScore: score,
      contractAuditCompletedAt: new Date(row.finished_at).toISOString(),
      contractAuditCoverageSufficient:
        parsed.coverage?.sufficientForCleanVerdict === true,
    };
  } catch {
    return result;
  }
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
  const linkCheck = await verifyAuditLinks(auditLinks);
  const recentExploitAlerts = queryRecentExploits(protocol.name, protocol.slug);
  const tvlCrash = detectTvlCrash(protocol);
  const onChain = readCompletedContractAudit(protocol);

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
      `- Audit links: ${gt.auditLinks.claimed} claimed, ${gt.auditLinks.checked} checked, ${gt.auditLinks.verified} resolve, ${gt.auditLinks.broken} BROKEN, ${gt.auditLinks.unchecked} unchecked`
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

  if (gt.onChain.contractAuditAvailable) {
    lines.push(
      `- Recent contract audit: verdict=${gt.onChain.contractAuditVerdict} risk=${gt.onChain.contractAuditRiskScore}/100 completed=${gt.onChain.contractAuditCompletedAt} sufficient-clean-coverage=${gt.onChain.contractAuditCoverageSufficient === true}`
    );
  } else {
    lines.push("- On-chain checks: no recent completed contract audit");
  }

  return lines.join("\n");
}
