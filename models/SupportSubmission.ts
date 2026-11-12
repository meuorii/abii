import "server-only";
import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  key: { type: String, required: true },
  status: { type: String, enum: ["processing", "accepted", "failed"], required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

schema.index({ key: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SupportSubmission = mongoose.models.SupportSubmission || mongoose.model("SupportSubmission", schema);
