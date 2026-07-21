import {
  appendClearedSessionCookies,
  revokeSession,
  verifySessionCsrf,
} from "@/lib/auth/session";
import { validateRequestOrigin } from "@/lib/auth/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validateRequestOrigin(request) || !verifySessionCsrf(request)) {
    return Response.json({ error: "Invalid logout request" }, { status: 403 });
  }
  revokeSession(request);
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  appendClearedSessionCookies(headers);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
