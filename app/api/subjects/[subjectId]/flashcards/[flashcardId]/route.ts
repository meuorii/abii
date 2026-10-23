import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
import { Subject } from "@/models/Subject";
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
  return NextResponse.json({ card: { id: String(card._id), flashcardType: card.flashcardType, question: card.question, answer: card.answer, hint: card.hint ?? "" } });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to update this flashcard." }, { status: 401 });
  const { subjectId, flashcardId } = await params;
  let body: { question?: unknown; answer?: unknown; hint?: unknown; flashcardType?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 }); }
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
  const current = await Flashcard.findOne({ _id: flashcardId, subjectId: subject._id, userId: user._id });
  if (!current) return NextResponse.json({ error: "This flashcard could not be found." }, { status: 404 });
  const materialChanged = normalizeText(current.question) !== normalizeText(question) || normalizeText(current.answer) !== normalizeText(answer) || current.flashcardType !== type;
  current.set({ question, answer, hint: hint || undefined, flashcardType: type });
  await current.save();
  if (materialChanged) {
    await ReviewRecord.deleteMany({ userId: user._id, flashcardId: current._id });
    await QuizSession.deleteMany({ userId: user._id, status: "active", "questions.flashcardId": current._id });
  }
  return NextResponse.json({ card: { id: String(current._id), flashcardType: current.flashcardType, question: current.question, answer: current.answer, hint: current.hint ?? "" }, masteryReset: materialChanged });
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
