import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { normalizeTopicName } from "./Topic";

export const normalizeFolderName = normalizeTopicName;

const folderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, immutable: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  normalizedName: { type: String, required: true },
  position: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
}, { timestamps: true, versionKey: false });

folderSchema.pre("validate", function () {
  if (typeof this.name === "string") {
    this.name = this.name.normalize("NFKC").trim().replace(/\s+/gu, " ");
    this.normalizedName = normalizeFolderName(this.name);
  }
});

for (const operation of ["updateOne", "updateMany", "findOneAndUpdate"] as const) {
  folderSchema.pre(operation, function () {
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) throw new Error("Folder pipeline updates are unsupported");
    if (Object.keys(update).some((key) => key.startsWith("$") && key !== "$set" && key !== "$setOnInsert")) throw new Error("Unsupported folder update operator");
    if (update.$set && Object.keys(update).some((key) => !key.startsWith("$"))) throw new Error("Do not mix folder update operators and direct fields");
    const fields = update.$set ?? update;
    for (const target of [fields, update.$setOnInsert]) {
      if (!target) continue;
      if (typeof target.name === "string") {
        target.name = target.name.normalize("NFKC").trim().replace(/\s+/gu, " ");
        target.normalizedName = normalizeFolderName(target.name);
      } else if (target.normalizedName !== undefined) throw new Error("Update the folder name instead of normalizedName");
    }
    if (this.getOptions().upsert && !fields.name && !update.$setOnInsert?.name) throw new Error("Folder upserts require a name");
    this.setOptions({ runValidators: true });
  });
}
for (const operation of ["replaceOne", "findOneAndReplace"] as const) {
  folderSchema.pre(operation, function () { throw new Error("Save a validated Folder document instead of replacing it"); });
}
folderSchema.index({ userId: 1, subjectId: 1, normalizedName: 1 }, { unique: true, name: "folder_owner_subject_name_unique" });
folderSchema.index({ userId: 1, subjectId: 1, position: 1 }, { name: "folder_owner_subject_position" });

export type FolderDocument = InferSchemaType<typeof folderSchema>;
export const Folder: Model<FolderDocument> = (mongoose.models.Folder as Model<FolderDocument> | undefined) ?? mongoose.model<FolderDocument>("Folder", folderSchema);
