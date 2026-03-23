import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { DefiLlamaPool, DefiLlamaProtocol } from "@/types/pool";
import type { ProtocolAnalysis } from "@/types/analysis";
import { formatCurrency, formatDate } from "./formatters";
import { getProtocolSentiment, formatSentimentForPrompt } from "./sentiment";
import { fetchHacks, fetchRaises } from "./defillama";
import { fetchTokenDetail, toTokenMarketData, formatMarketDataForPrompt } from "./coingecko";
import { fetchTokenSecurity, resolveChainId, formatSecurityForPrompt } from "./goplus";
import type { TokenMarketData } from "@/types/coingecko";
import type { GoPlusTokenSecurity } from "@/types/goplus";

// In-memory cache with 1-hour TTL
const analysisCache = new Map<string, { data: ProtocolAnalysis; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are a DeFi protocol security analyst. Return ONLY a JSON object (no other text) with this structure:
{"legitimacyScore":<0-100>,"overallVerdict":"<high_confidence|moderate_confidence|low_confidence|caution>","summary":"<2-3 sentences>","sections":{"auditHistory":{"title":"Audit History","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"teamReputation":{"title":"Team & Reputation","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"tvlAnalysis":{"title":"TVL Analysis","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"smartContractRisk":{"title":"Smart Contract Risk","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"protocolMaturity":{"title":"Protocol Maturity","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]},"communityGovernance":{"title":"Community & Governance","score":<0-100>,"assessment":"<paragraph>","keyFindings":["...",".."]}},"redFlags":["..."],"positiveSignals":["..."],"investmentConsiderations":["..."]}
IMPORTANT: If CoinGecko market data is provided, factor market cap size into team reputation and protocol maturity scores. If GoPlus contract security data is provided, use it directly in the smartContractRisk section — honeypot detection or high sell tax should be an automatic red flag. High developer activity is a positive signal for smart contract risk.
Be conservative. Use publicly verifiable info. Always include at least one red flag. Return ONLY valid JSON.`;

function buildPrompt(
  protocol: DefiLlamaProtocol,
  pools: DefiLlamaPool[],
  sentimentText?: string,
  marketData?: TokenMarketData | null,
  securityData?: GoPlusTokenSecurity | null,
): string {
  const totalPoolTvl = pools.reduce((sum, p) => sum + (p.tvlUsd || 0), 0);
  const apys = pools.filter((p) => p.apy).map((p) => p.apy!);
  const minApy = apys.length > 0 ? Math.min(...apys) : 0;
  const maxApy = apys.length > 0 ? Math.max(...apys) : 0;

  const sentimentBlock = sentimentText ? `\nMARKET SENTIMENT DATA:\n${sentimentText}\n` : "";
  const marketBlock = marketData ? `\nTOKEN MARKET DATA (CoinGecko):\n${formatMarketDataForPrompt(marketData)}\n` : "";
  const securityBlock = securityData ? `\nCONTRACT SECURITY (GoPlus):\n${formatSecurityForPrompt(securityData)}\n` : "";

  return `${SYSTEM_PROMPT}

Analyze the DeFi protocol "${protocol.name}" for investment legitimacy.

PROTOCOL DATA FROM DEFILLAMA:
- Name: ${protocol.name}
- Category: ${protocol.category}
- Website: ${protocol.url}
- Twitter: @${protocol.twitter}
- Description: ${protocol.description}
- Total TVL: ${formatCurrency(protocol.tvl)}
- TVL Change 1d: ${protocol.change_1d !== null ? `${protocol.change_1d}%` : "N/A"}
- TVL Change 7d: ${protocol.change_7d !== null ? `${protocol.change_7d}%` : "N/A"}
- Listed on DeFiLlama Since: ${protocol.listedAt ? formatDate(protocol.listedAt) : "Unknown"}
- Audits Count: ${protocol.audits}
- Audit Links: ${protocol.audit_links?.join(", ") || "None listed"}
- Chains Supported: ${protocol.chains.join(", ")}
- Market Cap: ${protocol.mcap ? formatCurrency(protocol.mcap) : "N/A"}
- Number of Active Pools: ${pools.length}
- Total TVL Across Pools: ${formatCurrency(totalPoolTvl)}
- APY Range: ${minApy.toFixed(2)}% - ${maxApy.toFixed(2)}%
- Stablecoin Pools: ${pools.filter((p) => p.stablecoin).length}
${sentimentBlock}${marketBlock}${securityBlock}
Provide your complete analysis as a JSON object. Factor in the exploit history, funding data, and APY trends when scoring. Return ONLY the JSON, no other text.`;
}

function parseAnalysisResponse(text: string, protocol: DefiLlamaProtocol): ProtocolAnalysis {
  let jsonStr = text.trim();

  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Find the outermost JSON object by matching braces
  const startIdx = jsonStr.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < jsonStr.length; i++) {
      if (jsonStr[i] === "{") depth++;
      else if (jsonStr[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
  }

  const parsed = JSON.parse(jsonStr);

  return {
    protocolName: protocol.name,
    slug: protocol.slug,
    legitimacyScore: parsed.legitimacyScore,
    overallVerdict: parsed.overallVerdict,
    summary: parsed.summary,
    sections: parsed.sections,
    redFlags: parsed.redFlags || [],
    positiveSignals: parsed.positiveSignals || [],
    investmentConsiderations: parsed.investmentConsiderations || [],
    analyzedAt: new Date().toISOString(),
  };
}

export async function analyzeProtocol(
  protocol: DefiLlamaProtocol,
  pools: DefiLlamaPool[]
): Promise<ProtocolAnalysis> {
  // Check cache first
  const cached = analysisCache.get(protocol.slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Fetch all enrichment data in parallel (all optional, graceful degradation)
  let sentimentText = "";
  let marketData: TokenMarketData | null = null;
  let securityData: GoPlusTokenSecurity | null = null;

  try {
    const [hacks, raises, geckoDetail, goplusSec] = await Promise.all([
      fetchHacks(),
      fetchRaises(),
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
    ]);

    const sentiment = getProtocolSentiment(protocol.name, protocol.slug, hacks, raises, pools);
    sentimentText = formatSentimentForPrompt(sentiment);

    if (geckoDetail) marketData = toTokenMarketData(geckoDetail);
    if (goplusSec) securityData = goplusSec;
  } catch {
    // Enrichment data is optional, continue without it
  }

  const prompt = buildPrompt(protocol, pools, sentimentText, marketData, securityData);

  // Write prompt to a temp file, then pipe it to claude CLI
  const tmpFile = join(tmpdir(), `sovereign-${Date.now()}.txt`);
  await writeFile(tmpFile, prompt, "utf-8");

  const stdout = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    const proc = spawn("claude", ["-p", "--output-format", "text", "--model", "claude-opus-4-6", "--effort", "high"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("close", (code) => {
      unlink(tmpFile).catch(() => {});
      const output = Buffer.concat(chunks).toString("utf-8");
      if (code === 0 && output.trim()) {
        resolve(output);
      } else {
        const stderr = Buffer.concat(errChunks).toString("utf-8");
        reject(new Error(`claude CLI exited with code ${code}: ${stderr || "no output"}`));
      }
    });

    proc.on("error", (err) => {
      unlink(tmpFile).catch(() => {});
      reject(err);
    });

    // Feed prompt via stdin and close it
    proc.stdin.write(prompt);
    proc.stdin.end();

    // 5 minute timeout
    setTimeout(() => {
      proc.kill();
      unlink(tmpFile).catch(() => {});
      reject(new Error("claude CLI timed out after 5 minutes"));
    }, 300_000);
  });

  const analysis = parseAnalysisResponse(stdout, protocol);

  // Cache the result
  analysisCache.set(protocol.slug, {
    data: analysis,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return analysis;
}
