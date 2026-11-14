import { NextResponse, after } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { AuthChallenge } from "@/models/AuthChallenge";
import { consumeChallenge } from "@/lib/auth/challenges";
import { clearPendingIdentity, readPendingIdentity } from "@/lib/auth/tickets";
import { createSession } from "@/lib/auth/session";
import { rateAllowed, validOrigin, limited } from "@/lib/auth/http";
import { safeNextPath } from "@/lib/auth/redirect";
import { notifyAccountSecurityChange } from "@/lib/notifications/producers";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const userId = await readPendingIdentity();
  if (!userId) return NextResponse.json({ message: "Your verification session expired. Please sign in again." }, { status: 401 });
  let body: { code?: unknown; next?: unknown }; try { body = await request.json(); } catch { body = {}; }
  const code = typeof body.code === "string" ? body.code : "";
  if (!(await rateAllowed("verify", userId, 10, 60 * 60_000))) return limited();
  await connectToDatabase();
  const account = await User.findById(userId).select("emailVerifiedAt");
  if (!account) return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  if (!(account.emailVerifiedAt instanceof Date)) {
    if (!/^\d{6}$/.test(code) || !(await consumeChallenge(userId, "email_verification", code))) return NextResponse.json({ message: "The verification code is incorrect or expired. Request a new one if needed." }, { status: 400 });
    const verified = await User.findOneAndUpdate({ _id: userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } }, { new: true }).select("_id").lean();
    if (verified) after(async () => { await notifyAccountSecurityChange(String(verified._id), "email_verified", "first-verification"); });
  }
  await AuthChallenge.deleteMany({ userId, purpose: "email_verification" });
  await createSession(userId);
  await clearPendingIdentity();
  return NextResponse.json({ message: "Email verified. Welcome to Abii!", redirectTo: safeNextPath(typeof body.next === "string" ? body.next : null) });
}
