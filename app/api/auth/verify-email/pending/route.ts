import { NextResponse } from "next/server";
import { readPendingIdentity, setPendingIdentity } from "@/lib/auth/tickets";
import { readSessionUserId } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { AuthChallenge } from "@/models/AuthChallenge";
export const runtime = "nodejs";
export async function GET() {
  let userId = await readPendingIdentity();
  if (!userId) { userId = await readSessionUserId(); if (userId) await setPendingIdentity(userId); }
  if (!userId) return NextResponse.json({ email: null }, { status: 401 });
  await connectToDatabase();
  const user = await User.findById(userId).select("email emailVerifiedAt").lean();
  if (!user) return NextResponse.json({ email: null }, { status: 401 });
  if (user.emailVerifiedAt instanceof Date) return NextResponse.json({ email: user.email, verified: true });
  const [name, domain] = user.email.split("@");
  const challenge = await AuthChallenge.findOne({ userId, purpose: "email_verification", expiresAt: { $gt: new Date() }, consumedAt: null, lockedAt: null }).select("resendAvailableAt").lean() as unknown as { resendAvailableAt: Date } | null;
  const retryAfter = challenge ? Math.max(0, Math.ceil((challenge.resendAvailableAt.getTime() - Date.now()) / 1000)) : 0;
  return NextResponse.json({ email: `${name.slice(0, 1)}${"•".repeat(Math.min(6, Math.max(2, name.length - 1)))}@${domain}`, retryAfter });
}
