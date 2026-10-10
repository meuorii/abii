import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth/session";
import { validateRegistration } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Please check the form and try again." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Please check the form and try again." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (typeof data.name !== "string" || typeof data.email !== "string" || typeof data.password !== "string") {
    return NextResponse.json({ message: "Please enter your name, email, and password." }, { status: 400 });
  }
  const { errors, values } = validateRegistration({ name: data.name, email: data.email, password: data.password });
  if (Object.keys(errors).length) return NextResponse.json({ message: "Please check the highlighted fields.", errors }, { status: 400 });

  try {
    await connectToDatabase();
    const existing = await User.exists({ email: values.email });
    if (existing) return NextResponse.json({ message: "We couldn't create your account with those details. Try signing in or use another email." }, { status: 409 });
    const passwordHash = await bcrypt.hash(values.password, 12);
    const user = await User.create({ name: values.name, email: values.email, passwordHash });
    await createSession(user.id);
    return NextResponse.json({ message: "Account created." }, { status: 201 });
  } catch (error) {
    // A unique index also handles simultaneous registrations safely.
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ message: "We couldn't create your account with those details. Try signing in or use another email." }, { status: 409 });
    }
    return NextResponse.json({ message: "We couldn't create your account right now. Please try again." }, { status: 500 });
  }
}
