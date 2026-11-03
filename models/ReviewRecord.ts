import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const QUESTION_TYPES = ["identification", "multiple-choice", "true-false", "random"] as const;

const reviewRecordSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Review owner is required"],
    },
    flashcardId: {
      type: Schema.Types.ObjectId,
      ref: "Flashcard",
      required: [true, "Flashcard is required"],
    },
    result: {
      type: String,
      enum: {
        values: ["correct", "wrong"],
        message: "Result must be correct or wrong",
      },
      required: [true, "Review result is required"],
    },
    questionType: {
      type: String,
      enum: {
        values: QUESTION_TYPES,
        message: "Unsupported question type",
      },
      required: [true, "Question type is required"],
    },
    reviewedAt: {
      type: Date,
      required: [true, "Review date is required"],
      default: Date.now,
    },
    nextReviewAt: {
      type: Date,
      required: [true, "Next review date is required"],
      validate: {
        validator: (value: Date) => !Number.isNaN(value.getTime()),
        message: "Next review date must be a valid date",
      },
    },
    quizSessionId: { type: Schema.Types.ObjectId, ref: "QuizSession" },
    questionIdentity: { type: String, maxlength: 40 },
    quizQuestionIndex: { type: Number, min: 0 },
    quizRound: { type: Number, min: 1 },
    achievementSubjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    achievementDayKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    enumerationFullyCorrect: { type: Boolean, default: false },
    achievementEventsRecorded: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

reviewRecordSchema.index(
  { userId: 1, flashcardId: 1, nextReviewAt: 1 },
  { name: "review_owner_card_next_review" },
);
reviewRecordSchema.index(
  { userId: 1, quizSessionId: 1, quizQuestionIndex: 1 },
  { unique: true, name: "review_owner_quiz_question_unique", partialFilterExpression: { quizSessionId: { $type: "objectId" } } },
);
reviewRecordSchema.index(
  { userId: 1, achievementEventsRecorded: 1 },
  { name: "review_owner_pending_achievement", partialFilterExpression: { quizSessionId: { $type: "objectId" } } },
);
reviewRecordSchema.index({ userId: 1, reviewedAt: -1 }, { name: "review_owner_reviewed_at" });
reviewRecordSchema.index(
  { userId: 1, questionType: 1, flashcardId: 1, reviewedAt: -1, _id: -1 },
  { name: "review_owner_mode_card_recent" },
);

// Drop a stale cached model (dev hot reload) whose enum lacks the newer question types.
if (mongoose.models.ReviewRecord && (!(mongoose.models.ReviewRecord.schema.path("questionType") as unknown as { enumValues?: string[] }).enumValues?.includes("random") || !mongoose.models.ReviewRecord.schema.path("quizQuestionIndex") || !mongoose.models.ReviewRecord.schema.path("achievementDayKey"))) {
  delete mongoose.models.ReviewRecord;
}

export type ReviewRecordDocument = InferSchemaType<typeof reviewRecordSchema>;
export const ReviewRecord: Model<ReviewRecordDocument> =
  (mongoose.models.ReviewRecord as Model<ReviewRecordDocument> | undefined) ??
  mongoose.model<ReviewRecordDocument>("ReviewRecord", reviewRecordSchema);

