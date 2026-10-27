import { NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { parseEnumeration } from "@/lib/quiz/normalize";
import { isFlashcardType } from "@/lib/quiz/types";
import { ENUM_MAX_ITEMS, ENUM_MIN_ITEMS, MAX_ENUM_ANSWER_LENGTH } from "@/lib/quiz/config";
import { recordAchievementEvent } from "@/lib/badges/repository";

export const runtime = "nodejs";
class TopicAssignmentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type RouteContext = { params: Promise<{ subjectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to add a flashcard." }, { status: 401 });
  const { subjectId } = await params;
  if (!isValidObjectId(subjectId)) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });

  let body: { question?: unknown; answer?: unknown; hint?: unknown; flashcardType?: unknown; topicId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const flashcardType = body.flashcardType === undefined ? "standard" : body.flashcardType;
  if (!isFlashcardType(flashcardType)) return NextResponse.json({ error: "Choose Standard or Enumeration." }, { status: 400 });
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const hint = typeof body.hint === "string" ? body.hint.trim() : "";
  if (typeof body.topicId !== "string" || !isValidObjectId(body.topicId)) return NextResponse.json({ error: "Choose a valid topic for this flashcard." }, { status: 400 });
  if (!question || !answer) return NextResponse.json({ error: "Add both a question and an answer." }, { status: 400 });
  if (flashcardType === "items") {
    const items = parseEnumeration(answer);
    if (answer.length > MAX_ENUM_ANSWER_LENGTH || items.length < ENUM_MIN_ITEMS || items.length > ENUM_MAX_ITEMS || items.length !== answer.split(/[\n\r;,]+/).map((item) => item.trim()).filter(Boolean).length) return NextResponse.json({ error: `Enumeration answers need ${ENUM_MIN_ITEMS} to ${ENUM_MAX_ITEMS} unique items, separated by commas, semicolons, or new lines (${MAX_ENUM_ANSWER_LENGTH} characters maximum).` }, { status: 400 });
  }
  if (question.length > 2000 || answer.length > 5000 || (flashcardType === "items" && answer.length > 400) || hint.length > 1000) return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    let createdCard: ReturnType<typeof Flashcard.hydrate> | null = null;
    let createdTopicName: string | null = null;
    try {
      await session.withTransaction(async () => {
        const subject = await Subject.updateOne({ _id: subjectId, userId: user._id }, { $inc: { topicRevision: 1 } }, { session, timestamps: false });
        if (!subject.matchedCount) throw new TopicAssignmentError(404, "This subject could not be found.");
        const topic = await Topic.findOne({ _id: body.topicId, userId: user._id, subjectId }).select("_id name").session(session).lean();
        if (!topic) throw new TopicAssignmentError(404, "This topic could not be found in this subject.");
        const [card] = await Flashcard.create([{ userId: user._id, subjectId, topicId: topic._id, flashcardType, question, answer, ...(hint ? { hint } : {}) }], { session });
        await recordAchievementEvent(String(user._id), { idempotencyKey: `flashcard-created:${String(card._id)}`, kind: "flashcard-created", occurredAt: card.createdAt ?? new Date(), subjectId: String(subjectId) }, session);
        createdCard = card;
        createdTopicName = topic.name;
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && (error.code === 20 || error.code === 303)) return NextResponse.json({ error: "Topic-assigned flashcards require a MongoDB deployment with transactions." }, { status: 503 });
      if (error instanceof TopicAssignmentError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    } finally { await session.endSession(); }
    return NextResponse.json({ card: { id: String(createdCard!._id), topicId: String(createdCard!.topicId), topicName: createdTopicName, flashcardType: createdCard!.flashcardType ?? "standard", question: createdCard!.question, answer: createdCard!.answer, hint: createdCard!.hint ?? "", reviewed: false } }, { status: 201 });
  } catch (error) {
    console.error("Unable to create flashcard.", error);
    return NextResponse.json({ error: "We couldn’t save that flashcard. Please try again." }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to view flashcards." }, { status: 401 });
  const { subjectId } = await params;
  if (!isValidObjectId(subjectId)) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
  await connectToDatabase();
  const subject = await Subject.findOne({ _id: subjectId, userId: user._id }).select("_id").lean();
  if (!subject) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
  const cards = await Flashcard.find({ userId: user._id, subjectId }).select("_id topicId flashcardType question answer hint createdAt").sort({ createdAt: -1 }).lean();
  const topics = await Topic.find({ userId: user._id, subjectId }).select("_id name").lean();
  const topicNames = new Map(topics.map((topic) => [String(topic._id), topic.name]));
  return NextResponse.json({ cards: cards.map((card) => ({ id: String(card._id), topicId: card.topicId ? String(card.topicId) : null, topicName: card.topicId ? topicNames.get(String(card.topicId)) ?? null : null, flashcardType: card.flashcardType, question: card.question, answer: card.answer, hint: card.hint ?? "" })) });
}
