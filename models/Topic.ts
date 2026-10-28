import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Locale-independent normalization shared by document and query writes. */
export function normalizeTopicName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function isDuplicateTopicError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

const topicSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  normalizedName: { type: String, required: true },
  description: { type: String, maxlength: 500, default: undefined },
  position: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
}, { timestamps: true, versionKey: false });

topicSchema.pre("validate", function () {
  if (typeof this.name === "string") this.normalizedName = normalizeTopicName(this.name);
});

// Query updates cannot bypass the derived uniqueness key. Bulk/native writes must
// use validated documents; they bypass Mongoose middleware by design.
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate"] as const) {
  topicSchema.pre(operation, function () {
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) throw new Error("Topic pipeline updates are unsupported; save a validated document");
    if (Object.keys(update).some((key) => key.startsWith("$") && key !== "$set" && key !== "$setOnInsert")) throw new Error("Topic query updates support only $set and $setOnInsert; save a validated document");
    if (update.$set && Object.keys(update).some((key) => !key.startsWith("$"))) throw new Error("Do not mix topic update operators and direct fields");
    const fields = update.$set ?? update;
    if (typeof fields.name === "string") fields.normalizedName = normalizeTopicName(fields.name);
    else if (fields.normalizedName !== undefined) throw new Error("Update the topic name instead of normalizedName");
    if (update.$setOnInsert?.name) update.$setOnInsert.normalizedName = normalizeTopicName(update.$setOnInsert.name);
    else if (update.$setOnInsert?.normalizedName !== undefined) throw new Error("Provide the topic name instead of normalizedName");
    if (this.getOptions().upsert && !fields.name && !update.$setOnInsert?.name) throw new Error("Topic upserts require a name in the update");
    this.setOptions({ runValidators: true });
  });
}

for (const operation of ["replaceOne", "findOneAndReplace"] as const) {
  topicSchema.pre(operation, function () { throw new Error("Save a validated Topic document instead of replacing it"); });
}

topicSchema.index({ userId: 1, subjectId: 1, normalizedName: 1 }, { unique: true, name: "topic_owner_subject_name_unique" });
topicSchema.index({ userId: 1, subjectId: 1, position: 1 }, { name: "topic_owner_subject_position" });
topicSchema.index({ userId: 1, subjectId: 1, folderId: 1, position: 1 }, { name: "topic_owner_subject_folder_position" });

export type TopicDocument = InferSchemaType<typeof topicSchema>;
if (mongoose.models.Topic && !mongoose.models.Topic.schema.path("folderId")) mongoose.deleteModel("Topic");
export const Topic: Model<TopicDocument> =
  (mongoose.models.Topic as Model<TopicDocument> | undefined) ?? mongoose.model<TopicDocument>("Topic", topicSchema);
