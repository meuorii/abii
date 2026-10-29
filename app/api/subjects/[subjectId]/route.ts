import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { Folder } from "@/models/Folder";
import { SubjectFolder } from "@/models/SubjectFolder";
import { TransactionUnavailableError, withRequiredTransaction } from "@/lib/mongodb-transaction";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ subjectId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to update this subject." }, { status: 401 });
  const { subjectId } = await params;
  if (!isValidObjectId(subjectId)) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
  let body: { name?: unknown; subjectFolderId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length) return NextResponse.json({ error: "Provide subject fields to update." }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) return NextResponse.json({ error: "Enter a subject name between 1 and 100 characters." }, { status: 400 });
  if (Object.keys(body).some(key => !["name", "subjectFolderId"].includes(key))) return NextResponse.json({ error: "Unsupported subject fields." }, { status: 400 });
  if ("subjectFolderId" in body && body.subjectFolderId !== null && (typeof body.subjectFolderId !== "string" || !isValidObjectId(body.subjectFolderId))) return NextResponse.json({ error: "Provide a valid subject folder ID." }, { status: 400 });
  try {
    await connectToDatabase();
    if (body.subjectFolderId && !await SubjectFolder.exists({ _id: body.subjectFolderId, userId: user._id })) return NextResponse.json({ error: "This subject folder could not be found." }, { status: 404 });
    const duplicate = await Subject.findOne({ userId: user._id, _id: { $ne: subjectId }, name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }).select("_id").lean();
    if (duplicate) return NextResponse.json({ error: "You already have a subject with that name." }, { status: 409 });
    const update: { name: string; subjectFolderId?: unknown } = { name };
    if ("subjectFolderId" in body) update.subjectFolderId = body.subjectFolderId;
    const subject = await Subject.findOneAndUpdate({ _id: subjectId, userId: user._id }, { $set: update }, { new: true, runValidators: true }).select("name subjectFolderId").lean();
    if (!subject) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
    return NextResponse.json({ name: subject.name, subjectFolderId: subject.subjectFolderId ? String(subject.subjectFolderId) : null });
  } catch (error) {
    console.error("Unable to update subject.", error);
    return NextResponse.json({ error: "We couldn’t update this subject. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to delete this subject." }, { status: 401 });
  const { subjectId } = await params;
  if (!isValidObjectId(subjectId)) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
  try {
    await connectToDatabase();
    const deleted = await withRequiredTransaction(async (session) => {
      const subject = await Subject.findOne({ _id: subjectId, userId: user._id }).select("_id").session(session).lean();
      if (!subject) return false;
      const cards = await Flashcard.find({ userId: user._id, subjectId: subject._id }).select("_id").session(session).lean();
      const cardIds = cards.map((card) => card._id);
      await ReviewRecord.deleteMany({ userId: user._id, flashcardId: { $in: cardIds } }, { session });
      await QuizSession.deleteMany({
        userId: user._id,
        status: "active",
        $or: [{ subjectId: subject._id }, ...(cardIds.length ? [{ "questions.flashcardId": { $in: cardIds } }] : [])],
      }, { session });
      await Flashcard.deleteMany({ userId: user._id, subjectId: subject._id }, { session });
      await Topic.deleteMany({ subjectId: subject._id, userId: user._id }, { session });
      await Folder.deleteMany({ subjectId: subject._id, userId: user._id }, { session });
      await Subject.deleteOne({ _id: subject._id, userId: user._id }, { session });
      return true;
    });
    if (!deleted) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete subject.", error);
    if (error instanceof TransactionUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: "We couldn’t delete this subject. Please try again." }, { status: 500 });
  }
}
