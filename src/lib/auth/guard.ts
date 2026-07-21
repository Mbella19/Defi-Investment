import { getSessionWallet } from "./session";
import { requireMutationProtection } from "./request-security";

/**
 * Returns the authenticated wallet for a request, or a 401 Response that the
 * caller should return immediately. Use at the top of every server handler
 * that accesses or mutates wallet-scoped data.
 *
 * If SESSION_SECRET is not set, fail closed with a 503 response. Production
 * and any local flow that exercises authenticated routes must configure it.
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
  const mutationError = requireMutationProtection(request);
  if (mutationError) return { response: mutationError };
  return { wallet };
}
