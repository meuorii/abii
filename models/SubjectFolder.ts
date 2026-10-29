import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export function normalizeSubjectFolderName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

const subjectFolderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true, set: (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " "), minlength: 1, maxlength: 100 },
  normalizedName: { type: String, required: true, maxlength: 100 },
  description: { type: String, default: "", maxlength: 500 },
  position: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
}, { timestamps: true, versionKey: false });
subjectFolderSchema.index({ userId: 1, normalizedName: 1 }, { unique: true, name: "subject_folder_unique_name" });
subjectFolderSchema.index({ userId: 1, position: 1 }, { name: "subject_folder_order" });

export type SubjectFolderDocument = InferSchemaType<typeof subjectFolderSchema>;
export const SubjectFolder: Model<SubjectFolderDocument> =
  (mongoose.models.SubjectFolder as Model<SubjectFolderDocument> | undefined) ??
  mongoose.model<SubjectFolderDocument>("SubjectFolder", subjectFolderSchema);
