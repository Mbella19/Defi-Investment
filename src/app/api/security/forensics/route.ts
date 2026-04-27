import { analyzeDeployer } from "@/lib/security/deployer-forensics";
import { CHAIN_NAME_TO_ID } from "@/lib/security/etherscan";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 180;

function parseChain(input: string | null): number | null {
  if (!input) return null;
  const asNum = Number(input);
  if (Number.isFinite(asNum) && asNum > 0) return asNum;
  const match = Object.entries(CHAIN_NAME_TO_ID).find(
    ([name]) => name.toLowerCase() === input.toLowerCase()
  );
  return match ? match[1] : null;
}

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "forensics", { max: 20, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  try {
    const body = await request.json();
    const { address, chain } = body as { address?: string; chain?: string | number };

    if (!address || typeof address !== "string" || !isValidAddress(address)) {
      return Response.json(
        { error: "Invalid contract address. Expected 0x-prefixed 40-hex-char string." },
        { status: 400 }
      );
    }

    const chainId = typeof chain === "number" ? chain : parseChain(chain ?? "1");
    if (!chainId) {
      return Response.json(
        { error: `Unsupported chain: ${chain}. Try: Ethereum, Base, Arbitrum, Optimism, Polygon, BSC.` },
        { status: 400 }
      );
    }

    const report = await analyzeDeployer(chainId, address);
    return Response.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forensics failed";
    const status = message.includes("ETHERSCAN_API_KEY") ? 500 : 502;
    return Response.json({ error: message }, { status });
  }
}
