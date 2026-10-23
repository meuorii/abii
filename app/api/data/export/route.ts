import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Subject } from "@/models/Subject";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to export your data." }, { status: 401 });
  await connectToDatabase();
  const [account, subjects, flashcards, reviews, sessions] = await Promise.all([
    User.findById(user._id).select("name email createdAt settings").lean(),
    Subject.find({ userId: user._id }).select("name createdAt updatedAt").lean(),
    Flashcard.find({ userId: user._id }).select("subjectId flashcardType question answer hint createdAt updatedAt").lean(),
    ReviewRecord.find({ userId: user._id }).select("flashcardId result questionType reviewedAt nextReviewAt createdAt").lean(),
    QuizSession.find({ userId: user._id, status: "completed" }).select("subjectId subjectName type status questions completedAt createdAt updatedAt").lean(),
  ]);
  const payload = { exportedAt: new Date().toISOString(), account, subjects, flashcards, reviewHistory: reviews, completedStudySessions: sessions };
  return new Response(JSON.stringify(payload, null, 2), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="abii-study-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
}
