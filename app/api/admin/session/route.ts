import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { AdminAccessError, getAdminSessionSnapshot } from "@/lib/auth/admin-session-state";
import { privateJson } from "@/lib/auth/admin-http";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return privateJson({ message: "Not found." }, 404);
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return privateJson({ message: "Administrator session expired." }, 401);
  try {
    return privateJson(await getAdminSessionSnapshot(token));
  } catch (error) {
    const status = error instanceof AdminAccessError ? error.status : 503;
    return privateJson({ message: status === 401 ? "Administrator session expired." : status === 403 ? "Administrator access denied." : "Session verification is temporarily unavailable." }, status);
  }
}
