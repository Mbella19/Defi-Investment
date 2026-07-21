import "server-only";
import { timingSafeEqual } from "crypto";
import { isOwnerWallet } from "@/lib/plans/access";
import { appendSessionCookies, createSessionCookies } from "@/lib/auth/session";
import { validateRequestOrigin } from "@/lib/auth/request-security";
import { enforceRateLimit } from "@/lib/rate-limit";
import { jsonBodyErrorResponse, readJsonBody } from "@/lib/request-body";

/**
 * Localhost-only owner sign-in bypass. Skips SIWE / hardware-wallet signing
 * so the project owner can test paid features without a hardware-signing
 * round-trip every page load.
 *
 * Hard guarantees:
 *  - Refuses in production builds and on Vercel — deployed apps must use real SIWE.
 *  - Refuses unless the request is served from localhost / loopback.
 *  - Refuses unless ENABLE_DEV_LOGIN=true and a strong DEV_LOGIN_SECRET are set.
 *  - Refuses unless SESSION_SECRET is set (otherwise sessionCookieHeader throws).
 *  - Wallet must be in OWNER_WALLETS — randoms can't grant themselves Ultra.
 *
 * In other words: even with the route deployed, an attacker would need to
 * compromise both the env config AND already be on the owner list. There is
 * no path from "external user" to "Ultra session" via this endpoint.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isEnabled(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL === "1") return false;
  if (process.env.ENABLE_DEV_LOGIN !== "true") return false;
  if ((process.env.DEV_LOGIN_SECRET?.length ?? 0) < 32) return false;
  return isLocalRequest(request);
}

function validDevSecret(input: unknown): boolean {
  const expected = process.env.DEV_LOGIN_SECRET ?? "";
  if (typeof input !== "string" || expected.length < 32) return false;
  const supplied = Buffer.from(input);
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

export async function POST(request: Request) {
  if (!isEnabled(request)) {
    // Return 404 (not 401) so the route is invisible when disabled — a real
    // production deployment shouldn't even hint that this exists.
    return new Response("Not Found", { status: 404 });
  }
  if (!process.env.SESSION_SECRET) {
    return Response.json(
      { error: "SESSION_SECRET is not set on the server." },
      { status: 503 },
    );
  }
  if (!validateRequestOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const limited = enforceRateLimit(request, "auth.dev-login", { max: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  let parsed: unknown;
  try {
    parsed = await readJsonBody(request);
  } catch (error) {
    return jsonBodyErrorResponse(error);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const body = parsed as { wallet?: unknown; secret?: unknown };
  if (!validDevSecret(body.secret)) {
    return Response.json({ error: "Invalid development login credentials" }, { status: 403 });
  }
  const wallet = typeof body.wallet === "string" ? body.wallet.trim().toLowerCase() : "";
  if (!wallet || !/^0x[0-9a-f]{40}$/.test(wallet)) {
    return Response.json(
      { error: "Provide a 0x-prefixed 40-hex-char wallet address." },
      { status: 400 },
    );
  }
  if (!isOwnerWallet(wallet)) {
    return Response.json(
      {
        error:
          "Wallet is not in OWNER_WALLETS. Add it to .env.local before using the dev sign-in.",
      },
      { status: 403 },
    );
  }

  const session = createSessionCookies(wallet, "dev");
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  appendSessionCookies(headers, session);
  return new Response(JSON.stringify({ ok: true, wallet }), { status: 200, headers });
}

export async function GET(request: Request) {
  // Do not disclose privileged wallet identifiers from a public GET.
  return Response.json({ enabled: isEnabled(request) });
}
