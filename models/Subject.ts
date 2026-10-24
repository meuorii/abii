import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const subjectSchema = new Schema(
  {
    // Serializes topic mutations across application instances inside transactions.
    topicRevision: { type: Number, default: 0, select: false },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Subject owner is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
      minlength: [1, "Subject name cannot be empty"],
      maxlength: [100, "Subject name must be 100 characters or fewer"],
    },
  },
  { timestamps: true, versionKey: false },
);

subjectSchema.index({ userId: 1 }, { name: "subject_owner" });

export type SubjectDocument = InferSchemaType<typeof subjectSchema>;
if (mongoose.models.Subject && !mongoose.models.Subject.schema.path("topicRevision")) mongoose.deleteModel("Subject");
export const Subject: Model<SubjectDocument> =
  (mongoose.models.Subject as Model<SubjectDocument> | undefined) ??
  mongoose.model<SubjectDocument>("Subject", subjectSchema);
