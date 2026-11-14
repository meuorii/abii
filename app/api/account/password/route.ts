import { NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { notifyAccountSecurityChange } from "@/lib/notifications/producers";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to change your password." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 }); }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) return NextResponse.json({ error: "Enter your current password and a new password of at least 8 characters." }, { status: 400 });
  if (newPassword !== confirmPassword) return NextResponse.json({ error: "The new passwords do not match." }, { status: 400 });
  await connectToDatabase();
  const account = await User.findById(user._id).select("+passwordHash");
  if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
  const updated = await User.findOneAndUpdate({ _id: account._id }, { $set: { passwordHash: await bcrypt.hash(newPassword, 12) }, $inc: { sessionVersion: 1 } }, { new: true }).select("sessionVersion").lean();
  if (!updated) return NextResponse.json({ error: "We could not update your password. Please try again." }, { status: 500 });
  after(async () => { await notifyAccountSecurityChange(String(account._id), "password_changed", `version-${updated.sessionVersion}`); });
  await destroySession();
  return NextResponse.json({ message: "Password changed. Please log in again.", redirectTo: "/login" });
}
