import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { AuthChallenge } from "@/models/AuthChallenge";
import { readPendingIdentity, setPendingIdentity } from "@/lib/auth/tickets";
import { readSessionUserId } from "@/lib/auth/session";
import { deliverChallenge } from "@/lib/auth/challenges";
import { sendVerificationEmail } from "@/lib/email/brevo";
import { rateAllowed, rateAllowedByTrustedIp, validOrigin, limited } from "@/lib/auth/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  let userId = await readPendingIdentity();
  if (!userId) userId = await readSessionUserId(); // permits a signed pre-rollout JWT to enter the restricted verification flow
  if (!userId) return NextResponse.json({ message: "Please sign in to request verification." }, { status: 401 });
  await connectToDatabase();
  const user = await User.findById(userId).select("name email emailVerifiedAt");
  if (!user) return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  if (user.emailVerifiedAt instanceof Date) return NextResponse.json({ message: "This account is already verified." }, { status: 409 });
  if (!(await rateAllowed("verify-send", user.email, 5, 60 * 60_000))) return limited();
  if (!(await rateAllowedByTrustedIp(request, "verify-ip", 20, 60 * 60_000))) return limited();
  const prior = await AuthChallenge.findOne({ userId, purpose: "email_verification" }).select("resendAvailableAt").lean() as unknown as { resendAvailableAt: Date } | null;
  if (prior && prior.resendAvailableAt > new Date()) return NextResponse.json({ message: "Please wait before requesting another code.", retryAfter: Math.ceil((prior.resendAvailableAt.getTime() - Date.now()) / 1000) }, { status: 429 });
  await setPendingIdentity(userId);
  const ok = await deliverChallenge(userId, "email_verification", code => sendVerificationEmail(user.email, user.name, code, "existing_account"));
  return NextResponse.json({ message: ok ? "A new verification code has been sent." : "We couldn't send your email. Please try again shortly." }, { status: ok ? 200 : 503 });
}
