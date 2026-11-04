import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { validateRegistration } from "@/lib/auth/validation";
import { deliverChallenge } from "@/lib/auth/challenges";
import { sendVerificationEmail } from "@/lib/email/brevo";
import { setPendingIdentity } from "@/lib/auth/tickets";
import { limited, rateAllowed, rateAllowedByTrustedIp, validOrigin } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Please check the form and try again." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Please check the form and try again." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (typeof data.name !== "string" || typeof data.email !== "string" || typeof data.password !== "string") {
    return NextResponse.json({ message: "Please enter your name, email, and password." }, { status: 400 });
  }
  const { errors, values } = validateRegistration({ name: data.name, email: data.email, password: data.password });
  if (Object.keys(errors).length) return NextResponse.json({ message: "Please check the highlighted fields.", errors }, { status: 400 });
  if (!(await rateAllowed("register", values.email, 5, 60 * 60_000))) return limited();
  if (!(await rateAllowedByTrustedIp(request, "register-ip", 20, 60 * 60_000))) return limited();

  let createdUser: { id: string; name: string } | null = null;
  try {
    await connectToDatabase();
    const existing = await User.exists({ email: values.email });
    if (existing) return NextResponse.json({ message: "We couldn't create your account with those details. Try signing in or use another email." }, { status: 409 });
    const passwordHash = await bcrypt.hash(values.password, 12);
    const user = await User.create({
      name: values.name,
      email: values.email,
      passwordHash,
      profileImage: null,
      profileImagePublicId: null,
    });
    createdUser = { id: user.id, name: user.name };
    const delivered = await deliverChallenge(user.id, "email_verification", code => sendVerificationEmail(values.email, user.name, code, "registration"));
    await setPendingIdentity(user.id);
    if (!delivered) return NextResponse.json({ code: "EMAIL_VERIFICATION_REQUIRED", message: "Your account was created. Sign in to request a new verification code." }, { status: 503 });
    return NextResponse.json({ code: "EMAIL_VERIFICATION_REQUIRED", message: "Check your inbox. We've sent your verification code." }, { status: 201 });
  } catch (error) {
    if (createdUser) {
      await setPendingIdentity(createdUser.id).catch(() => undefined);
      return NextResponse.json({ code: "EMAIL_VERIFICATION_REQUIRED", message: "Your account was created, but we couldn't send the code yet. Sign in to request another code." }, { status: 503 });
    }
    // A unique index also handles simultaneous registrations safely.
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ message: "We couldn't create your account with those details. Try signing in or use another email." }, { status: 409 });
    }
    return NextResponse.json({ message: "We couldn't create your account right now. Please try again." }, { status: 500 });
  }
}
