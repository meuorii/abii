import "server-only";
import mongoose, { Schema } from "mongoose";

const schema = new Schema({ key: { type: String, required: true }, window: { type: Number, required: true }, count: { type: Number, required: true, default: 0 }, expiresAt: { type: Date, required: true } }, { versionKey: false });
schema.index({ key: 1, window: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AuthRateLimit = mongoose.models.AuthRateLimit || mongoose.model("AuthRateLimit", schema);
