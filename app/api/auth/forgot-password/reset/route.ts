import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { PasswordResetGrant } from "@/models/PasswordResetGrant";
import { hashGrant } from "@/lib/auth/challenges";
import { readResetGrantCookie, clearResetGrantCookie } from "@/lib/auth/tickets";
import { rateAllowed, rateAllowedByTrustedIp, validOrigin, limited } from "@/lib/auth/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const grantId = await readResetGrantCookie(); if (!grantId) return NextResponse.json({ message: "Your reset session expired. Request a new code." }, { status: 401 });
  if (!(await rateAllowed("password-reset", grantId, 5, 60 * 60_000))) return limited();
  if (!(await rateAllowedByTrustedIp(request, "password-reset-ip", 20, 60 * 60_000))) return limited();
  let body: { password?: unknown; confirmPassword?: unknown }; try { body = await request.json(); } catch { body = {}; }
  const password = typeof body.password === "string" ? body.password : "", confirm = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  if (password.length < 8 || password.length > 128) return NextResponse.json({ message: "Use a password between 8 and 128 characters." }, { status: 400 });
  if (password !== confirm) return NextResponse.json({ message: "The passwords do not match." }, { status: 400 });
  await connectToDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  const session = await mongoose.startSession();
  let updated = false;
  try {
    await session.withTransaction(async () => {
      updated = false;
      const grant = await PasswordResetGrant.findOneAndUpdate({ tokenHash: hashGrant(grantId), expiresAt: { $gt: new Date() }, consumedAt: null }, { $set: { consumedAt: new Date() } }, { new: true, session }).lean() as unknown as { _id: unknown; userId: string } | null;
      if (!grant) return;
      const result = await User.updateOne({ _id: grant.userId }, { $set: { passwordHash }, $inc: { sessionVersion: 1 } }, { session });
      if (result.matchedCount !== 1) throw new Error("Reset account no longer exists.");
      await PasswordResetGrant.deleteMany({ userId: grant.userId, _id: { $ne: grant._id } }, { session });
      updated = true;
    });
  } finally { await session.endSession(); }
  if (!updated) return NextResponse.json({ message: "Your reset session expired. Request a new code." }, { status: 401 });
  await clearResetGrantCookie();
  return NextResponse.json({ message: "Password updated successfully. Please sign in again.", redirectTo: "/login" });
}
