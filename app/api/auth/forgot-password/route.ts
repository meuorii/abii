import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { deliverChallenge } from "@/lib/auth/challenges";
import { sendPasswordResetEmail } from "@/lib/email/brevo";
import { limited, rateAllowed, rateAllowedByTrustedIp, validOrigin } from "@/lib/auth/http";
import { normalizeEmail } from "@/lib/auth/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  let body: { email?: unknown }; try { body = await request.json(); } catch { body = {}; }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  if (!(await rateAllowed("recovery", email, 5, 60 * 60_000))) return limited();
  if (!(await rateAllowedByTrustedIp(request, "recovery-ip", 20, 60 * 60_000))) return limited();
  await connectToDatabase();
  const user = await User.findOne({ email }).select("name email").lean();
  if (user) await deliverChallenge(String(user._id), "password_reset", code => sendPasswordResetEmail(user.email, user.name, code));
  return NextResponse.json({ message: "If an account exists for this email, we'll send a recovery code." });
}
