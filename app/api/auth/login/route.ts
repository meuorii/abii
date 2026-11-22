import { cookies } from "next/headers";
import { recordAdminDenial } from "@/lib/auth/admin-audit";
import { ADMIN_CHALLENGE_LIFETIME, AdminFactorRateLimitError, revokeAdminChallenge, startAdminChallenge } from "@/lib/auth/admin-factor";
import { AdminIntegrityError, adminEmailReserved, readActiveAdmin } from "@/lib/auth/admin-identity";
import { ADMIN_COOKIE, CHALLENGE_COOKIE } from "@/lib/auth/admin-session";
import { revokeAdminSession } from "@/lib/auth/admin-session-state";
import { privateJson, trustedAdminOrigin } from "@/lib/auth/admin-http";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/constants";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { activeOrdinaryAccount, User } from "@/models/User";
import { ADMIN_SUBJECT } from "@/models/Admin";
import { createSession, destroySession } from "@/lib/auth/session";
import { validateLogin } from "@/lib/auth/validation";
import { clearPendingIdentity, setPendingIdentity } from "@/lib/auth/tickets";
import { deliverChallenge } from "@/lib/auth/challenges";
import { sendVerificationEmail } from "@/lib/email/brevo";
import { rateAllowed, rateAllowedByTrustedIp, validOrigin } from "@/lib/auth/http";

export const runtime = "nodejs";
const dummyPasswordHash = "$2b$12$HUdxSbGT.hyi71fJSD2hr.uO9XngNUp.lzcO4cJUDKgl/Zzw8KCVu";

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
    const reserved = await adminEmailReserved(values.email);
    const admin = reserved ? await readActiveAdmin().catch(error => {
      if (error instanceof AdminIntegrityError) return null;
      throw error;
    }) : null;
    const user = reserved ? null : await User.findOne({ email: values.email, ...activeOrdinaryAccount }).read("primary").select("+passwordHash");
    const matches = await bcrypt.compare(values.password, admin?.passwordHash ?? user?.passwordHash ?? dummyPasswordHash);
    const adminMatches = admin?.email === values.email && matches &&
      Buffer.byteLength(values.password, "utf8") <= 72 && !values.password.includes("\0");
    if (!adminMatches && (!user || !matches)) {
      if (reserved) await recordAdminDenial("login-denied", ADMIN_SUBJECT);
      return privateJson({ message: "Email or password is incorrect. Please try again." }, 401);
    }
    const jar = await cookies();
    const priorAdmin = jar.get(ADMIN_COOKIE)?.value;
    const priorChallenge = jar.get(CHALLENGE_COOKIE)?.value;
    if ((adminMatches || priorAdmin || priorChallenge) && !trustedAdminOrigin(request)) return privateJson({ message: "Invalid request origin." }, 403);
    if (priorChallenge) {
      await revokeAdminChallenge(priorChallenge);
      jar.set(CHALLENGE_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    }
    if (priorAdmin) {
      await revokeAdminSession(priorAdmin);
      jar.set(ADMIN_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    }
    if (admin && adminMatches) {
      // Re-read after revocation but require the same verified password and active identity.
      const current = await readActiveAdmin();
      const challenge = current?.passwordHash === admin.passwordHash
        ? await startAdminChallenge(current.sessionVersion) : null;
      if (!challenge) return privateJson({ message: "Sign-in unavailable." }, 403);
      await destroySession();
      await clearPendingIdentity();
      jar.set(CHALLENGE_COOKIE, challenge, { ...SESSION_COOKIE_OPTIONS, maxAge: ADMIN_CHALLENGE_LIFETIME });
      return privateJson({ code: "ADMIN_MFA_REQUIRED" }, 202);
    }
    if (!user) return privateJson({ message: "Email or password is incorrect. Please try again." }, 401);
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
