export const CSRF_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-sov_csrf" : "sov_csrf";
