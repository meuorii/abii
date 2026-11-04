import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE_OPTIONS } from "./constants";

export const PENDING_COOKIE = "abii_pending_verification";
export const RESET_COOKIE = "abii_password_reset";
const key = () => {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
};
async function issue(subject: string, purpose: string, seconds: number) {
  return new SignJWT({ purpose }).setProtectedHeader({ alg: "HS256" }).setSubject(subject).setIssuedAt().setExpirationTime(`${seconds}s`).setIssuer("abii").setAudience("abii-auth-flow").sign(key());
}
async function read(token: string | undefined, purpose: string): Promise<string | null> {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer: "abii", audience: "abii-auth-flow" }); return payload.purpose === purpose && typeof payload.sub === "string" ? payload.sub : null; } catch { return null; }
}
export async function setPendingIdentity(userId: string) {
  (await cookies()).set(PENDING_COOKIE, await issue(userId, "email_verification", 20 * 60), { ...SESSION_COOKIE_OPTIONS, maxAge: 20 * 60 });
}
export async function readPendingIdentity() { return read((await cookies()).get(PENDING_COOKIE)?.value, "email_verification"); }
export async function clearPendingIdentity() { (await cookies()).set(PENDING_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) }); }
export async function clearAuthFlowCookies() { await clearPendingIdentity(); await clearResetGrantCookie(); }
export async function setResetGrantCookie(grantId: string) { (await cookies()).set(RESET_COOKIE, await issue(grantId, "password_reset", 5 * 60), { ...SESSION_COOKIE_OPTIONS, maxAge: 5 * 60, path: "/api/auth/forgot-password" }); }
export async function readResetGrantCookie() { return read((await cookies()).get(RESET_COOKIE)?.value, "password_reset"); }
export async function clearResetGrantCookie() { (await cookies()).set(RESET_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0), path: "/api/auth/forgot-password" }); }
