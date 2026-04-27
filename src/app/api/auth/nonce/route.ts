import { generateNonce } from "@/lib/auth/session";
import { rememberNonce } from "@/lib/auth/nonce-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const nonce = generateNonce();
  rememberNonce(nonce);
  return Response.json({ nonce });
}
