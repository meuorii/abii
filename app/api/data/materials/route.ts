import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";
import { QuizSession } from "@/models/QuizSession";
export const runtime = "nodejs";
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to delete study materials." }, { status: 401 });
  await connectToDatabase();
  await Promise.all([
    ReviewRecord.deleteMany({ userId: user._id }),
    QuizSession.deleteMany({ userId: user._id }),
    Flashcard.deleteMany({ userId: user._id }),
    Subject.deleteMany({ userId: user._id }),
  ]);
  return NextResponse.json({ message: "Your study materials have been deleted." });
}
