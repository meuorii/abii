import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Subject } from "@/models/Subject";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
import { Topic } from "@/models/Topic";
import { TransactionUnavailableError, withRequiredTransaction } from "@/lib/mongodb-transaction";
export const runtime = "nodejs";
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in before deleting your account." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please confirm account deletion." }, { status: 400 }); }
  if (body.confirmation !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  await connectToDatabase();
  try {
    await withRequiredTransaction(async (session) => {
      await ReviewRecord.deleteMany({ userId: user._id }, { session });
      await QuizSession.deleteMany({ userId: user._id }, { session });
      await Flashcard.deleteMany({ userId: user._id }, { session });
      await Topic.deleteMany({ userId: user._id }, { session });
      await Subject.deleteMany({ userId: user._id }, { session });
      await User.deleteOne({ _id: user._id }, { session });
    });
  } catch (error) {
    console.error("Account data could not be deleted.", error);
    if (error instanceof TransactionUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: "Your account could not be deleted. No changes were saved." }, { status: 500 });
  }
  await destroySession();
  return NextResponse.json({ message: "Account deleted.", redirectTo: "/" });
}
