const APP_ORIGIN = "https://abii.invalid";
const adminPaths = new Set(["/admin", "/admin/users", "/admin/analytics", "/admin/performance", "/admin/security", "/admin/announcements", "/admin/support", "/admin/settings"]);

export function safeAdminPath(candidate: unknown): string {
  return typeof candidate === "string" && adminPaths.has(candidate) ? candidate : "/admin";
}

/** A learning session may resume a local page, never an auth or administrative entry point. */
export function safeNextPath(candidate: string | null | undefined, fallback = "/dashboard"): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || (candidate.includes("\\") || [...candidate].some(char => char.charCodeAt(0) <= 32))) return fallback;
  try {
    const destination = new URL(candidate, APP_ORIGIN);
    const pathname = decodeURIComponent(destination.pathname).replace(/\/+$/, "") || "/";
    if (pathname.startsWith("//") || [...pathname].some(char => char.charCodeAt(0) < 32) || destination.origin !== APP_ORIGIN || /%(?:2f|5c|25)/i.test(destination.pathname) ||
        /^\/(?:login|register|verify-email|forgot-password|reset-password|admin|api)(?:\/|$)/i.test(pathname)) return fallback;
    return destination.pathname + destination.search + destination.hash;
  } catch { return fallback; }
}
