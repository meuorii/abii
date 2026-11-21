import { cookies } from "next/headers";
import { ADMIN_COOKIE, CHALLENGE_COOKIE } from "@/lib/auth/admin-session";
import { revokeAdminSession } from "@/lib/auth/admin-session-state";
import { revokeAdminChallenge } from "@/lib/auth/admin-factor";
import { privateJson, trustedAdminOrigin } from "@/lib/auth/admin-http";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/constants";
import { destroySession } from "@/lib/auth/session";
import { clearAuthFlowCookies } from "@/lib/auth/tickets";

export async function POST(request: Request) {
  const jar = await cookies();
  const admin = jar.get(ADMIN_COOKIE)?.value;
  const challenge = jar.get(CHALLENGE_COOKIE)?.value;
  if ((admin || challenge) && !trustedAdminOrigin(request)) return privateJson({ message: "Invalid request origin." }, 403);
  try {
    if (challenge) await revokeAdminChallenge(challenge);
    if (admin) await revokeAdminSession(admin);
    for (const name of [ADMIN_COOKIE, CHALLENGE_COOKIE]) jar.set(name, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    await destroySession();
    await clearAuthFlowCookies();
    return privateJson({ message: "Signed out." });
  } catch { return privateJson({ message: "Sign-out could not be confirmed. Please retry." }, 503); }
}
