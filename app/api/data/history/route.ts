import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
export const runtime = "nodejs";
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to clear study history." }, { status: 401 });
  await connectToDatabase();
  await Promise.all([
    ReviewRecord.deleteMany({ userId: user._id }),
    QuizSession.deleteMany({ userId: user._id, status: "completed" }),
  ]);
  return NextResponse.json({ message: "Study history cleared." });
}
