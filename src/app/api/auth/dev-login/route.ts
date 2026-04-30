import "server-only";
import { isOwnerWallet } from "@/lib/plans/access";
import { sessionCookieHeader } from "@/lib/auth/session";

/**
 * Localhost-only owner sign-in bypass. Skips SIWE / hardware-wallet signing
 * so the project owner can test paid features without a hardware-signing
 * round-trip every page load.
 *
 * Hard guarantees:
 *  - Refuses on Vercel (VERCEL=1) — production deployments must use real SIWE.
 *  - Refuses unless ENABLE_DEV_LOGIN=true is explicitly set in env.
 *  - Refuses unless SESSION_SECRET is set (otherwise sessionCookieHeader throws).
 *  - Wallet must be in OWNER_WALLETS — randoms can't grant themselves Ultra.
 *
 * In other words: even with the route deployed, an attacker would need to
 * compromise both the env config AND already be on the owner list. There is
 * no path from "external user" to "Ultra session" via this endpoint.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEnabled(): boolean {
  if (process.env.VERCEL === "1") return false;
  if (process.env.ENABLE_DEV_LOGIN !== "true") return false;
  return true;
}

export async function POST(request: Request) {
  if (!isEnabled()) {
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

  let body: { wallet?: string };
  try {
    body = (await request.json()) as { wallet?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const wallet = body.wallet?.trim().toLowerCase();
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

  return new Response(JSON.stringify({ ok: true, wallet }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookieHeader(wallet),
    },
  });
}

export async function GET() {
  // Surface the OWNER_WALLETS list to the client so the dev-login UI can
  // auto-fill the first one. Only useful when dev-login is enabled.
  const ownersRaw = process.env.OWNER_WALLETS ?? "";
  const owners = ownersRaw
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^0x[0-9a-f]{40}$/.test(w));
  return Response.json({
    enabled: isEnabled(),
    owners: isEnabled() ? owners : [],
  });
}
