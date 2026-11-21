import { cookies } from "next/headers";
import { recordAdminDenial } from "@/lib/auth/admin-audit";
import { AdminFactorRateLimitError, cancelAdminChallenge, startAdminChallenge } from "@/lib/auth/admin-factor";
import { ADMIN_COOKIE, CHALLENGE_COOKIE } from "@/lib/auth/admin-session";
import { revokeAdminSession } from "@/lib/auth/admin-session-state";
import { privateJson, trustedAdminOrigin } from "@/lib/auth/admin-http";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/constants";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSession, destroySession } from "@/lib/auth/session";
import { validateLogin } from "@/lib/auth/validation";
import { clearPendingIdentity, setPendingIdentity } from "@/lib/auth/tickets";
import { deliverChallenge } from "@/lib/auth/challenges";
import { sendVerificationEmail } from "@/lib/email/brevo";
import { rateAllowed, rateAllowedByTrustedIp, validOrigin } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validOrigin(request)) return privateJson({ message: "Invalid request origin." }, 403);
  let body: unknown;
  try { body = await request.json(); } catch { return privateJson({ message: "Please check your email and password." }, 400); }
  if (!body || typeof body !== "object") return privateJson({ message: "Please check your email and password." }, 400);
  const data = body as Record<string, unknown>;
  if (typeof data.email !== "string" || typeof data.password !== "string") return privateJson({ message: "Please enter your email and password." }, 400);
  const { errors, values } = validateLogin({ email: data.email, password: data.password });
  if (Object.keys(errors).length) return privateJson({ message: "Please check your email and password.", errors }, 400);
  try {
    if (!(await rateAllowed("login", values.email, 10, 60 * 60_000))) return privateJson({ message: "Too many attempts. Please wait and try again." }, 429);
    if (!(await rateAllowedByTrustedIp(request, "login-ip", 30, 60 * 60_000))) return privateJson({ message: "Too many attempts. Please wait and try again." }, 429);

    await connectToDatabase();
    const user = await User.findOne({ email: values.email }).select("+passwordHash");
    const matches = user ? await bcrypt.compare(values.password, user.passwordHash) : false;
    if (!user || !matches || user.suspendedAt) {
      if (user?.role === "admin") await recordAdminDenial("login-denied", user.id);
      return privateJson({ message: "Email or password is incorrect. Please try again." }, 401);
    }
    const jar = await cookies();
    const priorAdmin = jar.get(ADMIN_COOKIE)?.value;
    const priorChallenge = jar.get(CHALLENGE_COOKIE)?.value;
    let version = user.sessionVersion ?? 0;
    if ((user.role === "admin" || priorAdmin || priorChallenge) && !trustedAdminOrigin(request)) return privateJson({ message: "Invalid request origin." }, 403);
    if (priorChallenge) {
      await cancelAdminChallenge(priorChallenge);
      jar.set(CHALLENGE_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    }
    if (priorAdmin) {
      const revoked = await revokeAdminSession(priorAdmin);
      jar.set(ADMIN_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
      if (revoked && revoked.userId === user.id && revoked.version === version) version += 1;
    }
    if (user.role === "admin") {
      if (!(user.emailVerifiedAt instanceof Date)) return privateJson({ message: "Sign-in unavailable." }, 403);
      const challenge = await startAdminChallenge(user.id, version);
      if (!challenge) return privateJson({ message: "Sign-in unavailable." }, 403);
      await destroySession();
      await clearPendingIdentity();
      jar.set(CHALLENGE_COOKIE, challenge, { ...SESSION_COOKIE_OPTIONS, maxAge: 300 });
      return privateJson({ code: "ADMIN_MFA_REQUIRED" }, 202);
    }
    if (!(user.emailVerifiedAt instanceof Date)) {
      // A legacy cookie must not survive a successful password check for an
      // unverified account. The pending ticket below is deliberately not a session.
      await destroySession();
      try {
        await clearPendingIdentity();
        await setPendingIdentity(user.id);
      } catch {
        return privateJson({ code: "VERIFICATION_FLOW_UNAVAILABLE", message: "We couldn't start email verification. Please try again shortly." }, 503);
      }
      // Delivery may fail independently (provider outage, configuration, timeout).
      // Keep the authenticated pending flow usable so the verification page can
      // show the existing cooldown or let the user retry from its resend action.
      let delivered = false;
      try {
        delivered = await deliverChallenge(user.id, "email_verification", code => sendVerificationEmail(user.email, user.name, code, "existing_account"));
      } catch {
        delivered = false;
      }
      return privateJson({
        code: "EMAIL_VERIFICATION_REQUIRED",
        redirectTo: "/verify-email",
        deliveryStatus: delivered ? "sent" : "unavailable",
      }, 202);
    }
    await createSession(user.id, user.sessionVersion ?? 0);
    return privateJson({ code: "AUTHENTICATED", redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AdminFactorRateLimitError) return privateJson({ message: "Too many attempts. Please wait and try again." }, 429);
    return privateJson({ message: "We couldn't sign you in right now. Please try again." }, 503);
  }
}
