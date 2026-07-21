import { generateNonce } from "@/lib/auth/session";
import { rememberNonce } from "@/lib/auth/nonce-store";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "auth.nonce", { max: 20, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  const nonce = generateNonce();
  rememberNonce(nonce);
  return Response.json({ nonce }, { headers: { "Cache-Control": "no-store" } });
}
