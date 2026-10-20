import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ subjectId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to update this subject." }, { status: 401 });
  const { subjectId } = await params;
  if (!isValidObjectId(subjectId)) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
  let body: { name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) return NextResponse.json({ error: "Enter a subject name between 1 and 100 characters." }, { status: 400 });
  try {
    await connectToDatabase();
    const duplicate = await Subject.findOne({ userId: user._id, _id: { $ne: subjectId }, name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }).select("_id").lean();
    if (duplicate) return NextResponse.json({ error: "You already have a subject with that name." }, { status: 409 });
    const subject = await Subject.findOneAndUpdate({ _id: subjectId, userId: user._id }, { $set: { name } }, { new: true, runValidators: true }).select("name").lean();
    if (!subject) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
    return NextResponse.json({ name: subject.name });
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
    const subject = await Subject.findOne({ _id: subjectId, userId: user._id }).select("_id").lean();
    if (!subject) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
    const cards = await Flashcard.find({ userId: user._id, subjectId: subject._id }).select("_id").lean();
    const cardIds = cards.map((card) => card._id);
    if (cardIds.length) await ReviewRecord.deleteMany({ userId: user._id, flashcardId: { $in: cardIds } });
    await Flashcard.deleteMany({ userId: user._id, subjectId: subject._id });
    await Subject.deleteOne({ _id: subject._id, userId: user._id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete subject.", error);
    return NextResponse.json({ error: "We couldn’t delete this subject. Please try again." }, { status: 500 });
  }
}
