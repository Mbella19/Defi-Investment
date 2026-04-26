import type { DefiLlamaPool, DefiLlamaProtocol } from "@/types/pool";
import type {
  AnalysisAiSource,
  AnalysisDisagreement,
  AnalysisSection,
  AppliedVeto,
  GroundTruthChecks,
  PerAiScore,
  ProtocolAnalysis,
  ProtocolVerdict,
  TripleAiMeta,
} from "@/types/analysis";
import { formatCurrency, formatDate } from "./formatters";
import { getProtocolSentiment, formatSentimentForPrompt } from "./sentiment";
import { fetchTokenDetail, toTokenMarketData, formatMarketDataForPrompt } from "./coingecko";
import { fetchTokenSecurity, resolveChainId, formatSecurityForPrompt } from "./goplus";
import type { TokenMarketData } from "@/types/coingecko";
import type { GoPlusTokenSecurity } from "@/types/goplus";
import { tripleInvoke, tripleExtractJson } from "./security/dual-llm";
import { invokeClaude, extractJson } from "./security/claude-client";
import { gatherGroundTruth, formatGroundTruthForPrompt } from "./security/ground-truth";

const analysisCache = new Map<string, { data: ProtocolAnalysis; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

const SCORING_TIMEOUT_MS = 360_000;
const SYNTHESIS_TIMEOUT_MS = 360_000;

const VERDICT_RANK: Record<ProtocolVerdict, number> = {
  caution: 4,
  low_confidence: 3,
  moderate_confidence: 2,
  high_confidence: 1,
};

function mostConservativeVerdict(verdicts: ProtocolVerdict[]): ProtocolVerdict {
  if (verdicts.length === 0) return "caution";
  return verdicts.reduce((worst, v) =>
    VERDICT_RANK[v] > VERDICT_RANK[worst] ? v : worst
  );
}

const SCORING_SYSTEM = `You are a DeFi protocol security analyst. Return ONLY a JSON object (no other text) with this structure:
{"legitimacyScore":<0-100>,"overallVerdict":"<high_confidence|moderate_confidence|low_confidence|caution>","summary":"<2-3 sentences>","sections":{"auditHistory":{"title":"Audit History","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"teamReputation":{"title":"Team & Reputation","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"tvlAnalysis":{"title":"TVL Analysis","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"smartContractRisk":{"title":"Smart Contract Risk","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"protocolMaturity":{"title":"Protocol Maturity","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"communityGovernance":{"title":"Community & Governance","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]}},"redFlags":["..."],"positiveSignals":["..."],"investmentConsiderations":["..."]}

HARD RULES:
- The GROUND-TRUTH FACTS block lists verified facts. You MUST engage with them — do not ignore broken audit links, recent exploit alerts, or TVL crashes.
- If a recent exploit alert names this protocol, that is a critical red flag. Do not score above 50.
- If audit links are claimed but broken, treat the audit count as unverified.
- Be conservative. Use only publicly verifiable info.
- Always include at least one red flag.
- Return ONLY valid JSON.`;

function buildScoringPrompt(
  protocol: DefiLlamaProtocol,
  pools: DefiLlamaPool[],
  groundTruth: GroundTruthChecks,
  sentimentText?: string,
  marketData?: TokenMarketData | null,
  securityData?: GoPlusTokenSecurity | null,
): string {
  const totalPoolTvl = pools.reduce((sum, p) => sum + (p.tvlUsd || 0), 0);
  const apys = pools.filter((p) => p.apy).map((p) => p.apy!);
  const minApy = apys.length > 0 ? Math.min(...apys) : 0;
  const maxApy = apys.length > 0 ? Math.max(...apys) : 0;

  const sentimentBlock = sentimentText ? `\nMARKET SENTIMENT DATA:\n${sentimentText}\n` : "";
  const marketBlock = marketData ? `\nTOKEN MARKET DATA:\n${formatMarketDataForPrompt(marketData)}\n` : "";
  const securityBlock = securityData ? `\nCONTRACT SECURITY:\n${formatSecurityForPrompt(securityData)}\n` : "";
  const groundTruthBlock = `\n${formatGroundTruthForPrompt(groundTruth)}\n`;

  return `${SCORING_SYSTEM}

Analyze the DeFi protocol "${protocol.name}" for investment legitimacy.

PROTOCOL DATA:
- Name: ${protocol.name}
- Category: ${protocol.category}
- Website: ${protocol.url}
- Twitter: @${protocol.twitter}
- Description: ${protocol.description}
- Total TVL: ${formatCurrency(protocol.tvl)}
- TVL Change 1d: ${protocol.change_1d !== null ? `${protocol.change_1d}%` : "N/A"}
- TVL Change 7d: ${protocol.change_7d !== null ? `${protocol.change_7d}%` : "N/A"}
- Listed Since: ${protocol.listedAt ? formatDate(protocol.listedAt) : "Unknown"}
- Audits Count (claimed): ${protocol.audits}
- Audit Links: ${protocol.audit_links?.join(", ") || "None listed"}
- Chains Supported: ${protocol.chains.join(", ")}
- Market Cap: ${protocol.mcap ? formatCurrency(protocol.mcap) : "N/A"}
- Number of Active Pools: ${pools.length}
- Total TVL Across Pools: ${formatCurrency(totalPoolTvl)}
- APY Range: ${minApy.toFixed(2)}% - ${maxApy.toFixed(2)}%
- Stablecoin Pools: ${pools.filter((p) => p.stablecoin).length}
${sentimentBlock}${marketBlock}${securityBlock}${groundTruthBlock}
Provide your complete analysis as a JSON object. Factor exploit history, audit verification, and TVL trends into your scoring. Return ONLY the JSON, no other text.`;
}

interface RawScoreResponse {
  legitimacyScore: number;
  overallVerdict: ProtocolVerdict;
  summary: string;
  sections?: ProtocolAnalysis["sections"];
  redFlags?: string[];
  positiveSignals?: string[];
  investmentConsiderations?: string[];
}

const ALL_SOURCES: AnalysisAiSource[] = ["claude", "codex", "gemini"];

function isValidVerdict(v: unknown): v is ProtocolVerdict {
  return (
    v === "high_confidence" ||
    v === "moderate_confidence" ||
    v === "low_confidence" ||
    v === "caution"
  );
}

function clampScore(n: unknown): number {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 50;
  return Math.max(0, Math.min(100, Math.round(x)));
}

/* ==================== STAGE 2 — SYNTHESIS ==================== */

const SYNTHESIS_SYSTEM = `You are reconciling three independent AI security analyses of a DeFi protocol into ONE final analysis. The three AIs (Claude, Codex GPT-5.5, Gemini 3.1 Pro) each scored the protocol from the same facts. Your job:

1. Take the MINIMUM legitimacyScore across the three AIs as your starting score (capital-safety bias). You may apply small adjustments (±5) only with explicit reasoning grounded in ground-truth facts.
2. Take the MOST CONSERVATIVE overallVerdict across the three AIs (caution > low_confidence > moderate_confidence > high_confidence).
3. UNION the redFlags across all three AIs, dedup by meaning. Keep the longest phrasing.
4. UNION positiveSignals, dedup. (No consensus filter — facts are facts.)
5. For each section, average the three scores; pick the longest assessment; union keyFindings.
6. Identify points of DISAGREEMENT — places where the three AIs diverge meaningfully (different scores, different red flags, contradictory verdicts) and resolve each one with explicit reasoning.
7. Engage with the GROUND-TRUTH FACTS — if any AI ignored them, your synthesis must correct that.

Return ONLY a JSON object:
{
  "legitimacyScore": <0-100>,
  "overallVerdict": "<verdict>",
  "summary": "<2-3 sentences, must mention what the AIs agreed and disagreed on>",
  "sections": {
    "auditHistory": {"title":"Audit History","score":<0-100>,"assessment":"<paragraph>","keyFindings":["..."]},
    "teamReputation": {"title":"Team & Reputation","score":<0-100>,"assessment":"<paragraph>","keyFindings":["..."]},
    "tvlAnalysis": {"title":"TVL Analysis","score":<0-100>,"assessment":"<paragraph>","keyFindings":["..."]},
    "smartContractRisk": {"title":"Smart Contract Risk","score":<0-100>,"assessment":"<paragraph>","keyFindings":["..."]},
    "protocolMaturity": {"title":"Protocol Maturity","score":<0-100>,"assessment":"<paragraph>","keyFindings":["..."]},
    "communityGovernance": {"title":"Community & Governance","score":<0-100>,"assessment":"<paragraph>","keyFindings":["..."]}
  },
  "redFlags": ["..."],
  "positiveSignals": ["..."],
  "investmentConsiderations": ["..."],
  "disagreements": [
    {
      "topic": "<short description, e.g., 'Audit history score'>",
      "positions": [
        {"source": "claude", "position": "<what claude said>"},
        {"source": "codex", "position": "<what codex said>"},
        {"source": "gemini", "position": "<what gemini said>"}
      ],
      "resolution": "<your reasoning for what the final answer is and why>"
    }
  ]
}`;

function buildSynthesisPrompt(
  protocol: DefiLlamaProtocol,
  groundTruth: GroundTruthChecks,
  perAi: Array<{ source: AnalysisAiSource; raw: RawScoreResponse }>
): string {
  const rawBlocks = perAi
    .map(
      (p) =>
        `--- ${p.source.toUpperCase()} ANALYSIS ---\n${JSON.stringify(p.raw, null, 2)}`
    )
    .join("\n\n");

  return `${SYNTHESIS_SYSTEM}

Protocol: ${protocol.name} (${protocol.slug})

${formatGroundTruthForPrompt(groundTruth)}

THE THREE INDIVIDUAL AI ANALYSES:
${rawBlocks}

Reconcile into ONE final analysis. Return ONLY the JSON object.`;
}

interface SynthesisOutput extends RawScoreResponse {
  disagreements?: Array<{
    topic: string;
    positions: Array<{ source: string; position: string }>;
    resolution: string;
  }>;
}

/* ==================== STAGE 3 — HEURISTIC VETO ==================== */

const RECENT_EXPLOIT_SCORE_CEILING = 35;
const TVL_CRASH_SCORE_CEILING = 55;
const DEPLOYER_AVOID_SCORE_CEILING = 30;
const SOURCE_AUDIT_DANGEROUS_CEILING = 30;
const BROKEN_AUDIT_LINKS_FLOOR_CONFIDENCE: ProtocolVerdict = "low_confidence";

function applyHeuristicVetoes(
  base: { legitimacyScore: number; overallVerdict: ProtocolVerdict },
  groundTruth: GroundTruthChecks
): { legitimacyScore: number; overallVerdict: ProtocolVerdict; vetoes: AppliedVeto[] } {
  const vetoes: AppliedVeto[] = [];
  let score = base.legitimacyScore;
  let verdict = base.overallVerdict;

  const tighten = (
    rule: string,
    forcedVerdict: ProtocolVerdict,
    ceiling: number | undefined,
    reason: string
  ) => {
    const newVerdict =
      VERDICT_RANK[forcedVerdict] > VERDICT_RANK[verdict] ? forcedVerdict : verdict;
    const newScore = ceiling !== undefined ? Math.min(score, ceiling) : score;
    if (newVerdict !== verdict || newScore !== score) {
      vetoes.push({ rule, forcedVerdict, forcedScoreCeiling: ceiling, reason });
      verdict = newVerdict;
      score = newScore;
    }
  };

  if (groundTruth.recentExploitAlerts.count > 0) {
    const recent = groundTruth.recentExploitAlerts.alerts[0];
    tighten(
      "RECENT_EXPLOIT_ALERT",
      "caution",
      RECENT_EXPLOIT_SCORE_CEILING,
      `${groundTruth.recentExploitAlerts.count} alert(s) in last ${groundTruth.recentExploitAlerts.lookbackDays}d, most recent: ${recent.name} (${recent.severity})`
    );
  }

  if (groundTruth.tvlCrash.crashed) {
    const c1 = groundTruth.tvlCrash.change1d;
    const c7 = groundTruth.tvlCrash.change7d;
    tighten(
      "TVL_CRASH",
      "low_confidence",
      TVL_CRASH_SCORE_CEILING,
      `TVL change 1d=${c1?.toFixed(1)}% 7d=${c7?.toFixed(1)}% — crash signal`
    );
  }

  if (
    groundTruth.onChain.deployerForensicsAvailable &&
    groundTruth.onChain.deployerRiskLevel === "avoid"
  ) {
    tighten(
      "DEPLOYER_AVOID",
      "caution",
      DEPLOYER_AVOID_SCORE_CEILING,
      `On-chain deployer forensics flagged this contract as 'avoid' (score ${groundTruth.onChain.deployerScore}/100)`
    );
  }

  if (
    groundTruth.onChain.sourceAuditAvailable &&
    groundTruth.onChain.sourceAuditVerdict === "dangerous"
  ) {
    tighten(
      "SOURCE_AUDIT_DANGEROUS",
      "caution",
      SOURCE_AUDIT_DANGEROUS_CEILING,
      `Cached source audit verdict 'dangerous' (score ${groundTruth.onChain.sourceAuditScore}/100)`
    );
  }

  // Broken audit links: only veto when the protocol claimed audits and ALL of them are broken.
  if (
    groundTruth.auditLinks.claimed >= 2 &&
    groundTruth.auditLinks.verified === 0
  ) {
    tighten(
      "AUDIT_LINKS_ALL_BROKEN",
      BROKEN_AUDIT_LINKS_FLOOR_CONFIDENCE,
      undefined,
      `${groundTruth.auditLinks.claimed} audit links claimed but all unreachable — audit count unverified`
    );
  }

  return { legitimacyScore: score, overallVerdict: verdict, vetoes };
}

/* ==================== ENTRY POINT ==================== */

function emptySection(title: string): AnalysisSection {
  return { title, score: 50, assessment: "Analysis unavailable.", keyFindings: [] };
}

function defaultSections(): ProtocolAnalysis["sections"] {
  return {
    auditHistory: emptySection("Audit History"),
    teamReputation: emptySection("Team & Reputation"),
    tvlAnalysis: emptySection("TVL Analysis"),
    smartContractRisk: emptySection("Smart Contract Risk"),
    protocolMaturity: emptySection("Protocol Maturity"),
    communityGovernance: emptySection("Community & Governance"),
  };
}

/**
 * Mechanical fallback when the synthesis call fails: reconcile the per-AI
 * outputs deterministically (min score, most conservative verdict, union flags).
 * Less specific than Claude-synthesized output but never blocks on AI outage.
 */
function mechanicalReconcile(
  perAi: Array<{ source: AnalysisAiSource; raw: RawScoreResponse }>
): RawScoreResponse {
  if (perAi.length === 0) {
    return {
      legitimacyScore: 50,
      overallVerdict: "low_confidence",
      summary: "No AI analyses available — using neutral defaults.",
      sections: defaultSections(),
      redFlags: ["No AI analysis available"],
      positiveSignals: [],
      investmentConsiderations: ["Re-run analysis when AI services are available"],
    };
  }
  const minScore = Math.min(...perAi.map((p) => clampScore(p.raw.legitimacyScore)));
  const verdict = mostConservativeVerdict(
    perAi.map((p) => (isValidVerdict(p.raw.overallVerdict) ? p.raw.overallVerdict : "low_confidence"))
  );
  const dedup = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
  const redFlags = dedup(perAi.flatMap((p) => p.raw.redFlags ?? []));
  const positiveSignals = dedup(perAi.flatMap((p) => p.raw.positiveSignals ?? []));
  const considerations = dedup(perAi.flatMap((p) => p.raw.investmentConsiderations ?? []));
  // Pick the longest summary (tends to be the most specific)
  const summary = perAi.reduce((best, p) => {
    const s = (p.raw.summary || "").trim();
    return s.length > best.length ? s : best;
  }, "");
  // Average each section score; longest assessment; union keyFindings.
  const sectionKeys = [
    "auditHistory",
    "teamReputation",
    "tvlAnalysis",
    "smartContractRisk",
    "protocolMaturity",
    "communityGovernance",
  ] as const;
  const sections = defaultSections();
  for (const key of sectionKeys) {
    const present = perAi
      .map((p) => p.raw.sections?.[key])
      .filter((s): s is AnalysisSection => !!s);
    if (present.length === 0) continue;
    const avg = Math.round(
      present.reduce((acc, s) => acc + clampScore(s.score), 0) / present.length
    );
    const longest = present.reduce(
      (best, s) => ((s.assessment || "").length > best.length ? s.assessment : best),
      ""
    );
    const allFindings = dedup(present.flatMap((s) => s.keyFindings ?? []));
    sections[key] = {
      title: present[0].title,
      score: avg,
      assessment: longest,
      keyFindings: allFindings,
    };
  }
  return {
    legitimacyScore: minScore,
    overallVerdict: verdict,
    summary: summary || "Reconciled analysis from multiple AIs (synthesis stage failed).",
    sections,
    redFlags: redFlags.length > 0 ? redFlags : ["No specific red flags surfaced"],
    positiveSignals,
    investmentConsiderations: considerations,
  };
}

export async function analyzeProtocol(
  protocol: DefiLlamaProtocol,
  pools: DefiLlamaPool[]
): Promise<ProtocolAnalysis> {
  const cached = analysisCache.get(protocol.slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Fetch all enrichment data + ground truth in parallel.
  let sentimentText = "";
  let marketData: TokenMarketData | null = null;
  let securityData: GoPlusTokenSecurity | null = null;
  let groundTruth: GroundTruthChecks;

  try {
    const [geckoDetail, goplusSec, gt] = await Promise.all([
      protocol.gecko_id ? fetchTokenDetail(protocol.gecko_id) : Promise.resolve(null),
      protocol.address
        ? (async () => {
            const chainId = resolveChainId(protocol.chain || "Ethereum");
            if (chainId) {
              const result = await fetchTokenSecurity(chainId, protocol.address!);
              if (result) return result;
            }
            if (protocol.chain !== "Ethereum") {
              return fetchTokenSecurity(1, protocol.address!);
            }
            return null;
          })()
        : Promise.resolve(null),
      gatherGroundTruth(protocol),
    ]);
    if (geckoDetail) marketData = toTokenMarketData(geckoDetail);
    if (goplusSec) securityData = goplusSec;
    groundTruth = gt;
    const sentiment = getProtocolSentiment(protocol.name, pools, marketData);
    sentimentText = formatSentimentForPrompt(sentiment);
  } catch {
    // Enrichment is optional. Ground truth shouldn't fail (its internals already
    // swallow errors), but if it does, fall back to a stub.
    groundTruth = await gatherGroundTruth(protocol).catch(
      () =>
        ({
          auditLinks: { claimed: 0, verified: 0, broken: 0, details: [] },
          recentExploitAlerts: { count: 0, lookbackDays: 30, alerts: [] },
          tvlCrash: { change1d: null, change7d: null, crashed: false },
          onChain: { deployerForensicsAvailable: false, sourceAuditAvailable: false },
        }) as GroundTruthChecks
    );
  }

  const scoringPrompt = buildScoringPrompt(
    protocol,
    pools,
    groundTruth,
    sentimentText,
    marketData,
    securityData
  );

  // ===== STAGE 1 — three AIs score independently in parallel =====
  const raw = await tripleInvoke(scoringPrompt, { timeoutMs: SCORING_TIMEOUT_MS });
  const parsed = tripleExtractJson<RawScoreResponse>(raw);
  const errors: TripleAiMeta["errors"] = parsed.errors.map((e) => ({
    source: e.source as AnalysisAiSource,
    error: e.error,
  }));
  const perAi: Array<{ source: AnalysisAiSource; raw: RawScoreResponse }> = [];
  const okSources: AnalysisAiSource[] = [];
  for (const source of ALL_SOURCES) {
    const p = parsed[source];
    if (p) {
      perAi.push({ source, raw: p });
      okSources.push(source);
    }
  }

  if (perAi.length === 0) {
    const detail = errors.map((e) => `${e.source}: ${e.error}`).join(" | ");
    throw new Error(`All three AI analyses failed: ${detail || "no model output"}`);
  }

  const perAiScores: PerAiScore[] = perAi.map((p) => ({
    source: p.source,
    legitimacyScore: clampScore(p.raw.legitimacyScore),
    verdict: isValidVerdict(p.raw.overallVerdict) ? p.raw.overallVerdict : "low_confidence",
    summary: String(p.raw.summary ?? "").slice(0, 600),
    redFlags: Array.isArray(p.raw.redFlags) ? p.raw.redFlags.map(String).slice(0, 12) : [],
  }));

  const scores = perAiScores.map((p) => p.legitimacyScore);
  const scoreSpread = scores.length > 0 ? Math.max(...scores) - Math.min(...scores) : 0;
  const disputed = scoreSpread > 25;

  // ===== STAGE 2 — Claude synthesizes the three analyses =====
  let synthesized: SynthesisOutput | null = null;
  let synthesisError: string | undefined;

  if (perAi.length === 1) {
    // Only one AI succeeded — no synthesis needed, use its output directly.
    synthesized = perAi[0].raw;
  } else {
    const synthesisPrompt = buildSynthesisPrompt(protocol, groundTruth, perAi);
    try {
      const synthRaw = await invokeClaude(synthesisPrompt, {
        effort: "max",
        timeoutMs: SYNTHESIS_TIMEOUT_MS,
      });
      synthesized = extractJson<SynthesisOutput>(synthRaw);
    } catch (err) {
      synthesisError = err instanceof Error ? err.message : String(err);
      // Synthesis failed — fall back to mechanical reconciliation so the
      // analysis still ships with min-score / most-conservative verdict.
      synthesized = mechanicalReconcile(perAi);
    }
  }

  const reconciled = synthesized ?? mechanicalReconcile(perAi);

  // ===== STAGE 3 — heuristic veto layer =====
  const baseScore = clampScore(reconciled.legitimacyScore);
  const baseVerdict = isValidVerdict(reconciled.overallVerdict)
    ? reconciled.overallVerdict
    : "low_confidence";

  const vetoed = applyHeuristicVetoes(
    { legitimacyScore: baseScore, overallVerdict: baseVerdict },
    groundTruth
  );

  const disagreements: AnalysisDisagreement[] = Array.isArray(synthesized?.disagreements)
    ? synthesized!.disagreements!.flatMap((d) => {
        const positions = Array.isArray(d.positions)
          ? d.positions
              .map((p) => ({
                source: (ALL_SOURCES.includes(p.source as AnalysisAiSource)
                  ? p.source
                  : "claude") as AnalysisAiSource,
                position: String(p.position ?? "").slice(0, 400),
              }))
              .filter((p) => p.position.length > 0)
          : [];
        if (!d.topic || positions.length === 0) return [];
        return [
          {
            topic: String(d.topic).slice(0, 200),
            positions,
            resolution: String(d.resolution ?? "").slice(0, 600),
          },
        ];
      })
    : [];

  // If synthesis didn't surface explicit disagreements but scores are disputed,
  // synthesize a stub disagreement entry so the user still sees the spread.
  if (disagreements.length === 0 && disputed && perAiScores.length > 1) {
    disagreements.push({
      topic: "Legitimacy score",
      positions: perAiScores.map((p) => ({
        source: p.source,
        position: `${p.legitimacyScore}/100 (${p.verdict})`,
      })),
      resolution: `AIs disagreed by ${scoreSpread} points; using min-of-three (${Math.min(...scores)}) per safety bias.`,
    });
  }

  const tripleAi: TripleAiMeta = {
    perAi: perAiScores,
    okSources,
    errors,
    disputed,
    scoreSpread,
    disagreements,
    synthesisOk: synthesized !== null && !synthesisError,
    synthesisError,
  };

  const finalAnalysis: ProtocolAnalysis = {
    protocolName: protocol.name,
    slug: protocol.slug,
    legitimacyScore: vetoed.legitimacyScore,
    overallVerdict: vetoed.overallVerdict,
    summary: String(reconciled.summary || "").slice(0, 800),
    sections: reconciled.sections ?? defaultSections(),
    redFlags: Array.isArray(reconciled.redFlags) ? reconciled.redFlags.map(String) : [],
    positiveSignals: Array.isArray(reconciled.positiveSignals)
      ? reconciled.positiveSignals.map(String)
      : [],
    investmentConsiderations: Array.isArray(reconciled.investmentConsiderations)
      ? reconciled.investmentConsiderations.map(String)
      : [],
    analyzedAt: new Date().toISOString(),
    tripleAi,
    groundTruth,
    vetoes: vetoed.vetoes,
  };

  // If a veto applied, prepend its reason to redFlags so it surfaces in the strategy prompt
  if (vetoed.vetoes.length > 0) {
    const vetoFlags = vetoed.vetoes.map((v) => `[VETO ${v.rule}] ${v.reason}`);
    finalAnalysis.redFlags = [...vetoFlags, ...finalAnalysis.redFlags];
  }

  analysisCache.set(protocol.slug, {
    data: finalAnalysis,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return finalAnalysis;
}
