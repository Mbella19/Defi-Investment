import { verifySessionCsrf } from "./session";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function configuredAppOrigin(request?: Request): URL {
  const configured = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_HOST;
  if (configured) {
    const withProtocol = configured.includes("://") ? configured : `https://${configured}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname))) {
      throw new Error("APP_ORIGIN must use HTTPS except on localhost");
    }
    if (
      parsed.username ||
      parsed.password ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("APP_ORIGIN must be a canonical origin without credentials, path, query, or hash");
    }
    return parsed;
  }
  if (process.env.NODE_ENV !== "production" && request) {
    const parsed = new URL(request.url);
    if (LOCAL_HOSTS.has(parsed.hostname)) return new URL(parsed.origin);
  }
  throw new Error("APP_ORIGIN is required");
}

export function expectedSiweOrigin(request?: Request): string {
  return configuredAppOrigin(request).origin;
}

export function validateRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === configuredAppOrigin(request).origin;
  } catch {
    return false;
  }
}

export function requireMutationProtection(request: Request): Response | null {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return null;
  if (!validateRequestOrigin(request)) {
    return Response.json(
      { error: "Invalid request origin", code: "INVALID_ORIGIN" },
      { status: 403 },
    );
  }
  if (!verifySessionCsrf(request)) {
    return Response.json(
      { error: "Invalid CSRF token", code: "INVALID_CSRF" },
      { status: 403 },
    );
  }
  return null;
}
