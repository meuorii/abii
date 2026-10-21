import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const flashcardSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Flashcard owner is required"],
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Flashcard subject is required"],
    },
    flashcardType: { type: String, enum: ["standard", "items"], default: "standard", required: true },
    question: {
      type: String,
      required: [true, "Question is required"],
      trim: true,
      minlength: [1, "Question cannot be empty"],
      maxlength: [2000, "Question must be 2000 characters or fewer"],
    },
    answer: {
      type: String,
      required: [true, "Answer is required"],
      trim: true,
      minlength: [1, "Answer cannot be empty"],
      maxlength: [5000, "Answer must be 5000 characters or fewer"],
    },
    hint: {
      type: String,
      trim: true,
      maxlength: [1000, "Hint must be 1000 characters or fewer"],
      default: undefined,
    },
    favorite: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

flashcardSchema.index(
  { userId: 1, subjectId: 1 },
  { name: "flashcard_owner_subject" },
);

// Drop a stale dev hot-reload model that predates the flashcardType field.
if (mongoose.models.Flashcard && !mongoose.models.Flashcard.schema.path("flashcardType")) delete mongoose.models.Flashcard;

export type FlashcardDocument = InferSchemaType<typeof flashcardSchema>;
export const Flashcard: Model<FlashcardDocument> =
  (mongoose.models.Flashcard as Model<FlashcardDocument> | undefined) ??
  mongoose.model<FlashcardDocument>("Flashcard", flashcardSchema);
