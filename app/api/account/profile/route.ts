import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to update your profile." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check your details and try again." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name || name.length > 80) return NextResponse.json({ error: "Enter a name between 1 and 80 characters." }, { status: 400 });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  await connectToDatabase();
  const duplicate = await User.findOne({ email, _id: { $ne: user._id } }).select("_id").lean();
  if (duplicate) return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
  try {
    await User.updateOne({ _id: user._id }, { $set: { name, email } }, { runValidators: true });
    return NextResponse.json({ message: "Account details updated.", user: { name, email } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
    return NextResponse.json({ error: "We couldn’t update your details. Please try again." }, { status: 500 });
  }
}
