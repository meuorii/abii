import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Subject } from "@/models/Subject";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
export const runtime = "nodejs";
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in before deleting your account." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please confirm account deletion." }, { status: 400 }); }
  if (body.confirmation !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  await connectToDatabase();
  // Remove owned records first; every query is scoped to the authenticated session owner.
  await Promise.all([
    ReviewRecord.deleteMany({ userId: user._id }),
    QuizSession.deleteMany({ userId: user._id }),
    Flashcard.deleteMany({ userId: user._id }),
    Subject.deleteMany({ userId: user._id }),
  ]);
  await User.deleteOne({ _id: user._id });
  await destroySession();
  return NextResponse.json({ message: "Account deleted.", redirectTo: "/" });
}
