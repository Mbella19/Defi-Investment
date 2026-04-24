import { auditContract } from "@/lib/security/source-audit";
import { CHAIN_NAME_TO_ID } from "@/lib/security/etherscan";

export const runtime = "nodejs";
export const maxDuration = 300;

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
        { error: `Unsupported chain: ${chain}.` },
        { status: 400 }
      );
    }

    const report = await auditContract(chainId, address);
    return Response.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed";
    const status = message.includes("not verified") ? 422 : 502;
    return Response.json({ error: message }, { status });
  }
}
