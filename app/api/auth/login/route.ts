import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSession, destroySession } from "@/lib/auth/session";
import { validateLogin } from "@/lib/auth/validation";
import { clearPendingIdentity, setPendingIdentity } from "@/lib/auth/tickets";
import { deliverChallenge } from "@/lib/auth/challenges";
import { sendVerificationEmail } from "@/lib/email/brevo";
import { limited, rateAllowed, rateAllowedByTrustedIp, validOrigin } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Please check your email and password." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Please check your email and password." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (typeof data.email !== "string" || typeof data.password !== "string") return NextResponse.json({ message: "Please enter your email and password." }, { status: 400 });
  const { errors, values } = validateLogin({ email: data.email, password: data.password });
  if (Object.keys(errors).length) return NextResponse.json({ message: "Please check your email and password.", errors }, { status: 400 });
  if (!(await rateAllowed("login", values.email, 10, 60 * 60_000))) return limited();
  if (!(await rateAllowedByTrustedIp(request, "login-ip", 30, 60 * 60_000))) return limited();

  try {
    await connectToDatabase();
    const user = await User.findOne({ email: values.email }).select("+passwordHash");
    const matches = user ? await bcrypt.compare(values.password, user.passwordHash) : false;
    if (!user || !matches) return NextResponse.json({ message: "Email or password is incorrect. Please try again." }, { status: 401 });
    if (!(user.emailVerifiedAt instanceof Date)) {
      // A legacy cookie must not survive a successful password check for an
      // unverified account. The pending ticket below is deliberately not a session.
      await destroySession();
      try {
        await clearPendingIdentity();
        await setPendingIdentity(user.id);
      } catch {
        return NextResponse.json({ code: "VERIFICATION_FLOW_UNAVAILABLE", message: "We couldn't start email verification. Please try again shortly." }, { status: 503 });
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
      return NextResponse.json({
        code: "EMAIL_VERIFICATION_REQUIRED",
        redirectTo: "/verify-email",
        deliveryStatus: delivered ? "sent" : "unavailable",
      }, { status: 202 });
    }
    await createSession(user.id);
    return NextResponse.json({ code: "AUTHENTICATED", redirectTo: "/dashboard" });
  } catch {
    return NextResponse.json({ message: "We couldn't sign you in right now. Please try again." }, { status: 500 });
  }
}
