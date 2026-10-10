import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth/session";
import { validateLogin } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Please check your email and password." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Please check your email and password." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (typeof data.email !== "string" || typeof data.password !== "string") return NextResponse.json({ message: "Please enter your email and password." }, { status: 400 });
  const { errors, values } = validateLogin({ email: data.email, password: data.password });
  if (Object.keys(errors).length) return NextResponse.json({ message: "Please check your email and password.", errors }, { status: 400 });

  try {
    await connectToDatabase();
    const user = await User.findOne({ email: values.email }).select("+passwordHash");
    const matches = user ? await bcrypt.compare(values.password, user.passwordHash) : false;
    if (!user || !matches) return NextResponse.json({ message: "Email or password is incorrect. Please try again." }, { status: 401 });
    await createSession(user.id);
    return NextResponse.json({ message: "Signed in." });
  } catch {
    return NextResponse.json({ message: "We couldn't sign you in right now. Please try again." }, { status: 500 });
  }
}
