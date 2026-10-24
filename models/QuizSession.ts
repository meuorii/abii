import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const MODES = ["multiple-choice", "identification", "true-false", "random"];
const TYPES = ["multiple-choice", "identification", "true-false", "enumeration-identification", "enumeration-multiple-choice"];

const quizQuestionSchema = new Schema(
  {
    // The individual question type (in Mixed / Random mode it varies per question).
    type: { type: String, enum: TYPES, default: undefined },
    flashcardId: { type: Schema.Types.ObjectId, ref: "Flashcard", required: true },
    prompt: { type: String, required: true },
    hint: { type: String, default: undefined },
    // Multiple Choice: shuffled options and the server-side correct position.
    options: { type: [String], default: [] },
    correctIndex: { type: Number, default: -1 },
    // True/False: the statement shown and its server-side truth value.
    statement: { type: String, default: undefined },
    truth: { type: Boolean, default: undefined },
    // Enumeration types: the full expected list (server-side only).
    expectedItems: { type: [String], default: undefined },
    expectedAnswer: { type: String, required: true },
    // Retry rounds: round 1 is the first pass; origin is the round-1 position of the card.
    round: { type: Number, default: 1 },
    origin: { type: Number, default: undefined },
    // Answer state (written once, atomically).
    answered: { type: Boolean, default: false },
    correct: { type: Boolean, default: undefined },
    selectedIndex: { type: Number, default: undefined },
    userAnswer: { type: String, default: undefined },
    userAnswers: { type: [String], default: undefined },
    answeredAt: { type: Date, default: undefined },
  },
  { _id: false },
);

const quizSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    subjectName: { type: String, required: true, trim: true },
    scope: { type: String, enum: ["all", "subject", "topic"], default: undefined },
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", default: undefined },
    topicName: { type: String, trim: true, default: undefined },
    type: { type: String, enum: MODES, required: true },
    status: { type: String, enum: ["active", "completed"], default: "active", required: true },
    questions: { type: [quizQuestionSchema], default: [] },
    completedAt: { type: Date, default: undefined },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

quizSessionSchema.index({ userId: 1, createdAt: -1 }, { name: "quiz_session_owner" });
quizSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "quiz_session_ttl" });

// In dev, hot reload can keep an older cached model whose schema lacks newer fields
// (they would be silently dropped). Drop a stale cached model so the current schema is used.
{
  const cached = mongoose.models.QuizSession;
  const questionSchema = (cached?.schema.path("questions") as unknown as { schema?: { path: (p: string) => unknown } } | undefined)?.schema;
  if (cached && (!questionSchema?.path("expectedItems") || !cached.schema.path("scope"))) delete mongoose.models.QuizSession;
}

export type QuizSessionDocument = InferSchemaType<typeof quizSessionSchema>;
export const QuizSession: Model<QuizSessionDocument> =
  (mongoose.models.QuizSession as Model<QuizSessionDocument> | undefined) ??
  mongoose.model<QuizSessionDocument>("QuizSession", quizSessionSchema);

