"use client";

import { CSRF_COOKIE_NAME } from "@/lib/auth/constants";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/** Same-origin API fetch that automatically attaches the session-bound CSRF token. */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return fetch(input, init);
  const target = new URL(
    input instanceof Request ? input.url : String(input),
    window.location.origin,
  );
  if (target.origin !== window.location.origin) {
    return Promise.reject(new Error("Authenticated API requests must remain same-origin"));
  }
  const headers = new Headers(init.headers);
  const csrf = readCookie(CSRF_COOKIE_NAME);
  if (csrf) headers.set("X-Sovereign-CSRF", csrf);
  return fetch(input, { ...init, headers });
}
