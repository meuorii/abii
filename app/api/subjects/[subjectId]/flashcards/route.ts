import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ subjectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to add a flashcard." }, { status: 401 });
  const { subjectId } = await params;
  if (!isValidObjectId(subjectId)) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });

  let body: { question?: unknown; answer?: unknown; hint?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 }); }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const hint = typeof body.hint === "string" ? body.hint.trim() : "";
  if (!question || !answer) return NextResponse.json({ error: "Add both a question and an answer." }, { status: 400 });
  if (question.length > 2000 || answer.length > 5000 || hint.length > 1000) return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });

  try {
    await connectToDatabase();
    const subject = await Subject.findOne({ _id: subjectId, userId: user._id }).select("_id").lean();
    if (!subject) return NextResponse.json({ error: "This subject could not be found." }, { status: 404 });
    const card = await Flashcard.create({ userId: user._id, subjectId: subject._id, question, answer, ...(hint ? { hint } : {}) });
    return NextResponse.json({ card: { id: String(card._id), question: card.question, answer: card.answer, hint: card.hint ?? "", favorite: Boolean(card.favorite), reviewed: false } }, { status: 201 });
  } catch (error) {
    console.error("Unable to create flashcard.", error);
    return NextResponse.json({ error: "We couldn’t save that flashcard. Please try again." }, { status: 500 });
  }
}
