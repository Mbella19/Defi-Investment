import { verifySiweMessage } from "@/lib/auth/siwe";
import { appendSessionCookies, createSessionCookies } from "@/lib/auth/session";
import { expectedSiweOrigin, validateRequestOrigin } from "@/lib/auth/request-security";
import { enforceRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "auth.verify", { max: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  if (!validateRequestOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  let parsed: unknown;
  try {
    parsed = await readJsonBody(request);
  } catch (error) {
    return jsonBodyErrorResponse(error);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const body = parsed as { message?: unknown; signature?: unknown };
  if (
    typeof body.message !== "string" ||
    typeof body.signature !== "string" ||
    body.message.length === 0 ||
    body.message.length > 10_000 ||
    body.signature.length === 0 ||
    body.signature.length > 1_000
  ) {
    return Response.json({ error: "message and signature required" }, { status: 400 });
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = expectedSiweOrigin(request);
  } catch (err) {
    log.error("auth", "canonical origin configuration is invalid", { error: err });
    return Response.json({ error: "Authentication is temporarily unavailable" }, { status: 503 });
  }

  const result = await verifySiweMessage({
    message: body.message,
    signature: body.signature,
    expectedOrigin,
  });
  if (!result.ok || !result.address) {
    return Response.json({ error: result.error ?? "verification failed" }, { status: 401 });
  }

  const session = createSessionCookies(result.address);
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  appendSessionCookies(headers, session);
  return new Response(
    JSON.stringify({ address: result.address, expiresAt: new Date(session.expiresAt).toISOString() }),
    { status: 200, headers },
  );
}
