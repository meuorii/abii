import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { AdminAccessError, recordAdminActivity } from "@/lib/auth/admin-session-state";
import { privateJson, trustedAdminOrigin } from "@/lib/auth/admin-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return privateJson({ message: "Not found." }, 404);
  if (!trustedAdminOrigin(request)) return privateJson({ message: "Invalid request origin." }, 403);
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return privateJson({ message: "Administrator session expired." }, 401);
  try {
    await recordAdminActivity(token);
    return privateJson({ ok: true });
  } catch (error) {
    const status = error instanceof AdminAccessError ? error.status : 503;
    return privateJson({ message: status === 401 ? "Administrator session expired." : "Session verification is temporarily unavailable." }, status);
  }
}
