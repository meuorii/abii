import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// One row per admin. Keeping the challenge beside the factor lets recovery invalidate both atomically.
const schema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  state: { type: String, enum: ["pending", "active"], required: true },
  encryptedSeed: { type: String, required: true, select: false },
  proofHash: { type: String, select: false },
  enrollmentExpiresAt: Date,
  enrollmentVersion: Number,
  lastStep: { type: Number, default: -1, required: true },
  recoveryHashes: { type: [String], select: false, default: [] },
  challengeHash: { type: String, select: false },
  challengeVersion: Number,
  challengeExpiresAt: Date,
  completedChallenges: { type: [{
    _id: false,
    hash: { type: String, required: true },
    version: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  }], select: false, default: [] },
}, { versionKey: false, strict: "throw" });

type Factor = InferSchemaType<typeof schema>;
export const AdminFactor: Model<Factor> = mongoose.models.AdminFactor ?? mongoose.model<Factor>("AdminFactor", schema);
