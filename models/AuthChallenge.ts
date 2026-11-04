import "server-only";
import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
  purpose: { type: String, enum: ["email_verification", "password_reset"], required: true },
  challengeId: { type: String, required: true },
  codeHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  resendAvailableAt: { type: Date, required: true },
  attemptCount: { type: Number, default: 0 },
  consumedAt: { type: Date, default: null },
  lockedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
schema.index({ userId: 1, purpose: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
if (mongoose.models.AuthChallenge && (!mongoose.models.AuthChallenge.schema.path("consumedAt") || !mongoose.models.AuthChallenge.schema.path("lockedAt"))) mongoose.deleteModel("AuthChallenge");
export const AuthChallenge = mongoose.models.AuthChallenge || mongoose.model("AuthChallenge", schema);
