import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Subject } from "@/models/Subject";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to create a subject." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please enter a valid subject name." }, { status: 400 });
  }

  const rawName = typeof body === "object" && body !== null && "name" in body
    ? (body as { name?: unknown }).name
    : undefined;
  if (typeof rawName !== "string") {
    return NextResponse.json({ error: "Subject name is required." }, { status: 400 });
  }

  const name = rawName.trim();
  if (!name) return NextResponse.json({ error: "Enter a subject name." }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "Use 100 characters or fewer." }, { status: 400 });

  try {
    await connectToDatabase();
    const userId = user._id;
    const existing = await Subject.findOne({ userId, name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } }).select("_id").lean();
    if (existing) return NextResponse.json({ error: "You already have a subject with that name." }, { status: 409 });

    const subject = await Subject.create({ userId, name });
    return NextResponse.json({ subject: { id: String(subject._id), name: subject.name, flashcardCount: 0, progress: 0 } }, { status: 201 });
  } catch (error) {
    console.error("Subject creation failed.", error);
    return NextResponse.json({ error: "We couldn’t save that subject right now. Please try again." }, { status: 500 });
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
