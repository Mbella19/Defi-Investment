import { getSessionWallet } from "./session";

/**
 * Returns the authenticated wallet for a request, or a 401 Response that the
 * caller should return immediately. Use at the top of every server handler
 * that accesses or mutates wallet-scoped data.
 *
 * If SESSION_SECRET is not set (local dev without auth wired), returns null
 * for the wallet AND null for the response — callers can choose to treat
 * that as anonymous or reject. Production must always set SESSION_SECRET.
 */
export function requireWallet(request: Request): { wallet: string } | { response: Response } {
  if (!process.env.SESSION_SECRET) {
    return {
      response: Response.json(
        { error: "Auth not configured: set SESSION_SECRET" },
        { status: 503 },
      ),
    };
  }
  const wallet = getSessionWallet(request);
  if (!wallet) {
    return {
      response: Response.json({ error: "Unauthenticated" }, { status: 401 }),
    };
  }
  return { wallet };
}
