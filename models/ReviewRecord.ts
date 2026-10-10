import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const QUESTION_TYPES = [
  "identification",
  "multiple-choice",
  "true-false",
  "fill-in-the-blank",
] as const;

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
  },
  { timestamps: true, versionKey: false },
);

reviewRecordSchema.index(
  { userId: 1, flashcardId: 1, nextReviewAt: 1 },
  { name: "review_owner_card_next_review" },
);

export type ReviewRecordDocument = InferSchemaType<typeof reviewRecordSchema>;
export const ReviewRecord: Model<ReviewRecordDocument> =
  (mongoose.models.ReviewRecord as Model<ReviewRecordDocument> | undefined) ??
  mongoose.model<ReviewRecordDocument>("ReviewRecord", reviewRecordSchema);
