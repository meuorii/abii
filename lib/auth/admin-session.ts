import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import { getCurrentUser } from "./session";
import { recordAdminDenial } from "./admin-audit";
import { AdminAccessError, validateAdminSession } from "./admin-session-state";
export { AdminAccessError };
export const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-abii_admin" : "abii_admin";
export const CHALLENGE_COOKIE = process.env.NODE_ENV === "production" ? "__Host-abii_admin_pending" : "abii_admin_pending";

export async function adminCookieOrDeny(): Promise<string> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) return token;
  if (jar.get(SESSION_COOKIE)?.value && (process.env.AUTH_SECRET?.length ?? 0) < 32) throw new AdminAccessError(503);
  let ordinary;
  try { ordinary = await getCurrentUser(); } catch { throw new AdminAccessError(503); }
  await recordAdminDenial("access-denied", ordinary ? String(ordinary._id) : undefined);
  throw new AdminAccessError(ordinary ? 403 : 401);
}

export async function requireAdmin(options: { fresh?: boolean } = {}) {
  return validateAdminSession(await adminCookieOrDeny(), options.fresh);
}
