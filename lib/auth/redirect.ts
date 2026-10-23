const APP_ORIGIN = "https://abii.invalid";

/** Accepts only same-origin app paths, preventing external and auth-page redirect loops. */
export function safeNextPath(candidate: string | null | undefined, fallback = "/dashboard"): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;

  try {
    const destination = new URL(candidate, APP_ORIGIN);
    if (destination.origin !== APP_ORIGIN) return fallback;
    const pathname = destination.pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/login" || pathname === "/register") return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
