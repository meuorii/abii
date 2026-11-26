import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import { ADMIN_COOKIE, CHALLENGE_COOKIE } from "@/lib/auth/admin-session";
import { finishAdminLogin } from "@/lib/auth/admin-session-state";
import { AdminFactorRateLimitError } from "@/lib/auth/admin-factor";
import { privateJson, trustedAdminOrigin } from "@/lib/auth/admin-http";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/constants";
import { rateAllowedByTrustedIp } from "@/lib/auth/http";
import { safeAdminPath } from "@/lib/auth/redirect";
import { destroySession } from "@/lib/auth/session";
import { clearAuthFlowCookies } from "@/lib/auth/tickets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!trustedAdminOrigin(request)) return privateJson({ message: "Invalid request origin." }, 403);
  const jar = await cookies();
  const pending = jar.get(CHALLENGE_COOKIE)?.value;
  if (!pending) return privateJson({ message: "Your verification request expired. Sign in again." }, 401);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return privateJson({ message: "Invalid request." }, 415);
  let body;
  try { body = await request.json(); } catch { return privateJson({ message: "Invalid request." }, 400); }
  if (!body || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) return privateJson({ message: "Enter a six-digit code." }, 400);
  try {
    if (!await rateAllowedByTrustedIp(request, "admin-mfa-ip", 20, 300_000)) throw new AdminFactorRateLimitError();
    const token = await finishAdminLogin(pending, body.code);
    if (!token) return privateJson({ message: "Check your code. If the request has expired, sign in again." }, 401);
    await destroySession();
    await clearAuthFlowCookies();
    jar.set(CHALLENGE_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    const expiration = decodeJwt(token).exp;
    if (typeof expiration !== "number") return privateJson({ message: "Verification is unavailable. Please retry." }, 503);
    const expires = new Date(expiration * 1000);
    jar.set(ADMIN_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, maxAge: Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)), expires });
    return privateJson({ redirectTo: safeAdminPath(body.next) });
  } catch (error) {
    if (error instanceof AdminFactorRateLimitError) return privateJson({ message: "Too many attempts. Wait a few minutes before signing in again." }, 429);
    return privateJson({ message: "Verification is unavailable. Please retry." }, 503);
  }
}
