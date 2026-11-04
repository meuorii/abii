import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { AuthChallenge } from "@/models/AuthChallenge";
import { deliverChallenge } from "@/lib/auth/challenges";
import { sendPasswordResetEmail } from "@/lib/email/brevo";
import { normalizeEmail } from "@/lib/auth/validation";
import { limited, rateAllowed, rateAllowedByTrustedIp, validOrigin } from "@/lib/auth/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  let body: { email?: unknown }; try { body = await request.json(); } catch { body = {}; }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!(await rateAllowed("recovery-resend", email || "invalid", 5, 60 * 60_000))) return limited();
  if (!(await rateAllowedByTrustedIp(request, "recovery-resend-ip", 20, 60 * 60_000))) return limited();
  await connectToDatabase(); const user = await User.findOne({ email }).select("name email _id").lean();
  const prior = user && await AuthChallenge.findOne({ userId: user._id, purpose: "password_reset" }).select("resendAvailableAt").lean() as unknown as { resendAvailableAt: Date } | null;
  if (prior && prior.resendAvailableAt > new Date()) return NextResponse.json({ message: "Please wait before requesting another code.", retryAfter: Math.ceil((prior.resendAvailableAt.getTime() - Date.now()) / 1000) }, { status: 429 });
  if (user) await deliverChallenge(String(user._id), "password_reset", code => sendPasswordResetEmail(user.email, user.name, code));
  return NextResponse.json({ message: "If an account exists for this email, we'll send a recovery code." });
}
