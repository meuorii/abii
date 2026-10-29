import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";
import { QuizSession } from "@/models/QuizSession";
import { Topic } from "@/models/Topic";
import { Folder } from "@/models/Folder";
import { SubjectFolder } from "@/models/SubjectFolder";
import { TransactionUnavailableError, withRequiredTransaction } from "@/lib/mongodb-transaction";
import { clearAchievementActivity } from "@/lib/badges/persistence";
export const runtime = "nodejs";
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to delete study materials." }, { status: 401 });
  await connectToDatabase();
  try {
    await withRequiredTransaction(async (session) => {
      await clearAchievementActivity(String(user._id), session);
      await ReviewRecord.deleteMany({ userId: user._id }, { session });
      await QuizSession.deleteMany({ userId: user._id }, { session });
      await Flashcard.deleteMany({ userId: user._id }, { session });
      await Topic.deleteMany({ userId: user._id }, { session });
      await Folder.deleteMany({ userId: user._id }, { session });
      await SubjectFolder.deleteMany({ userId: user._id }, { session });
      await Subject.deleteMany({ userId: user._id }, { session });
    });
  } catch (error) {
    console.error("Study materials could not be deleted.", error);
    if (error instanceof TransactionUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: "Study materials could not be deleted. No changes were saved." }, { status: 500 });
  }
  return NextResponse.json({ message: "Your study materials have been deleted." });
}
