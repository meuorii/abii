import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
import { clearAchievementActivity } from "@/lib/badges/persistence";
export const runtime = "nodejs";
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to clear study history." }, { status: 401 });
  await connectToDatabase();
  await Promise.all([
    ReviewRecord.deleteMany({ userId: user._id }),
    QuizSession.deleteMany({ userId: user._id, status: "completed" }),
    clearAchievementActivity(String(user._id)),
  ]);
  return NextResponse.json({ message: "Study history cleared." });
}
