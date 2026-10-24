import { NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { isFlashcardType } from "@/lib/quiz/types";
import { normalizeText, parseEnumeration } from "@/lib/quiz/normalize";
import { ENUM_MAX_ITEMS, ENUM_MIN_ITEMS, MAX_ENUM_ANSWER_LENGTH } from "@/lib/quiz/config";

export const runtime = "nodejs";
type Context = { params: Promise<{ subjectId: string; flashcardId: string }> };

async function ownedCard(subjectId: string, flashcardId: string, userId: string) {
  if (!isValidObjectId(subjectId) || !isValidObjectId(flashcardId)) return null;
  await connectToDatabase();
  const subject = await Subject.findOne({ _id: subjectId, userId }).select("_id").lean();
  if (!subject) return null;
  return Flashcard.findOne({ _id: flashcardId, subjectId: subject._id, userId }).lean();
}

export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to view this flashcard." }, { status: 401 });
  const { subjectId, flashcardId } = await params;
  const card = await ownedCard(subjectId, flashcardId, String(user._id));
  if (!card) return NextResponse.json({ error: "This flashcard could not be found." }, { status: 404 });
  const topic = card.topicId ? await Topic.findOne({ _id: card.topicId, userId: user._id, subjectId }).select("name").lean() : null;
  return NextResponse.json({ card: { id: String(card._id), topicId: card.topicId ? String(card.topicId) : null, topicName: topic?.name ?? null, flashcardType: card.flashcardType, question: card.question, answer: card.answer, hint: card.hint ?? "" } });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to update this flashcard." }, { status: 401 });
  const { subjectId, flashcardId } = await params;
  let body: { question?: unknown; answer?: unknown; hint?: unknown; flashcardType?: unknown; topicId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const type = body.flashcardType;
  if (!isFlashcardType(type)) return NextResponse.json({ error: "Choose Standard or Enumeration." }, { status: 400 });
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const hint = typeof body.hint === "string" ? body.hint.trim() : "";
  if (!question || question.length > 2000) return NextResponse.json({ error: "Question is required and must be 2000 characters or fewer." }, { status: 400 });
  if (!answer || answer.length > (type === "items" ? MAX_ENUM_ANSWER_LENGTH : 5000)) return NextResponse.json({ error: "Answer is required or exceeds its character limit." }, { status: 400 });
  if (hint.length > 1000) return NextResponse.json({ error: "Hint must be 1000 characters or fewer." }, { status: 400 });
  if (type === "items") {
    const parts = answer.split(/[\n\r;,]+/).map((item) => item.trim()).filter(Boolean);
    const items = parseEnumeration(answer);
    if (items.length < ENUM_MIN_ITEMS || items.length > ENUM_MAX_ITEMS || items.length !== parts.length) return NextResponse.json({ error: `Use ${ENUM_MIN_ITEMS} to ${ENUM_MAX_ITEMS} unique enumeration items.` }, { status: 400 });
  }
  if (!isValidObjectId(subjectId) || !isValidObjectId(flashcardId)) return NextResponse.json({ error: "This flashcard could not be found." }, { status: 404 });
  await connectToDatabase();
  const subject = await Subject.findOne({ _id: subjectId, userId: user._id }).select("_id").lean();
  if (!subject) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
  if (Object.hasOwn(body, "topicId")) {
    if (typeof body.topicId !== "string" || !isValidObjectId(body.topicId)) return NextResponse.json({ error: "Choose a valid topic for this flashcard." }, { status: 400 });
    const session = await mongoose.startSession();
    let card: InstanceType<typeof Flashcard> | null = null;
    let topicName: string | null = null;
    let materialChanged = false;
    let contentChanged = false;
    try {
      await session.withTransaction(async () => {
        const parent = await Subject.updateOne({ _id: subject._id, userId: user._id }, { $inc: { topicRevision: 1 } }, { session, timestamps: false });
        if (!parent.matchedCount) throw new Error("SUBJECT_NOT_FOUND");
        const current = await Flashcard.findOne({ _id: flashcardId, subjectId: subject._id, userId: user._id }).session(session);
        if (!current) throw new Error("FLASHCARD_NOT_FOUND");
        const topic = await Topic.findOne({ _id: body.topicId, userId: user._id, subjectId: subject._id }).select("_id name").session(session);
        if (!topic) throw new Error("TOPIC_NOT_FOUND");
        materialChanged = normalizeText(current.question) !== normalizeText(question) || normalizeText(current.answer) !== normalizeText(answer) || current.flashcardType !== type;
        contentChanged = current.question !== question || current.answer !== answer || current.hint !== (hint || undefined) || current.flashcardType !== type;
        current.set({ question, answer, hint: hint || undefined, flashcardType: type, topicId: topic._id });
        await current.save({ session, timestamps: contentChanged });
        card = current;
        topicName = topic.name;
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && (error.code === 20 || error.code === 303)) return NextResponse.json({ error: "Topic-assigned flashcard edits require a MongoDB deployment with transactions." }, { status: 503 });
      if (error instanceof Error && error.message === "SUBJECT_NOT_FOUND") return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
      if (error instanceof Error && error.message === "FLASHCARD_NOT_FOUND") return NextResponse.json({ error: "This flashcard could not be found." }, { status: 404 });
      if (error instanceof Error && error.message === "TOPIC_NOT_FOUND") return NextResponse.json({ error: "This topic could not be found in this subject." }, { status: 404 });
      throw error;
    } finally { await session.endSession(); }
    if (!card) return NextResponse.json({ error: "This flashcard could not be found." }, { status: 404 });
    const savedCard = card as unknown as InstanceType<typeof Flashcard>;
    if (materialChanged) {
      await ReviewRecord.deleteMany({ userId: user._id, flashcardId: savedCard._id });
      await QuizSession.deleteMany({ userId: user._id, status: "active", "questions.flashcardId": savedCard._id });
    }
    return NextResponse.json({ card: { id: String(savedCard._id), topicId: String(savedCard.topicId), topicName, flashcardType: savedCard.flashcardType, question: savedCard.question, answer: savedCard.answer, hint: savedCard.hint ?? "" }, masteryReset: materialChanged });
  }
  const current = await Flashcard.findOne({ _id: flashcardId, subjectId: subject._id, userId: user._id });
  if (!current) return NextResponse.json({ error: "This flashcard could not be found." }, { status: 404 });
  const materialChanged = normalizeText(current.question) !== normalizeText(question) || normalizeText(current.answer) !== normalizeText(answer) || current.flashcardType !== type;
  current.set({ question, answer, hint: hint || undefined, flashcardType: type });
  await current.save();
  if (materialChanged) {
    await ReviewRecord.deleteMany({ userId: user._id, flashcardId: current._id });
    await QuizSession.deleteMany({ userId: user._id, status: "active", "questions.flashcardId": current._id });
  }
  const topic = current.topicId ? await Topic.findOne({ _id: current.topicId, userId: user._id, subjectId: subject._id }).select("name").lean() : null;
  return NextResponse.json({ card: { id: String(current._id), topicId: current.topicId ? String(current.topicId) : null, topicName: topic?.name ?? null, flashcardType: current.flashcardType, question: current.question, answer: current.answer, hint: current.hint ?? "" }, masteryReset: materialChanged });
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to delete this flashcard." }, { status: 401 });
  const { subjectId, flashcardId } = await params;
  const card = await ownedCard(subjectId, flashcardId, String(user._id));
  if (!card) return NextResponse.json({ error: "This flashcard could not be found." }, { status: 404 });
  await Promise.all([
    ReviewRecord.deleteMany({ userId: user._id, flashcardId: card._id }),
    QuizSession.deleteMany({ userId: user._id, status: "active", "questions.flashcardId": card._id }),
  ]);
  await Flashcard.deleteOne({ _id: card._id, userId: user._id, subjectId });
  return NextResponse.json({ success: true });
}
