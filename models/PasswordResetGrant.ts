import "server-only";
import mongoose, { Schema } from "mongoose";
const schema = new Schema({ userId: { type: Schema.Types.ObjectId, required: true }, tokenHash: { type: String, required: true, select: false }, expiresAt: { type: Date, required: true }, consumedAt: { type: Date, default: null } }, { timestamps: true, versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ tokenHash: 1 }, { unique: true });
export const PasswordResetGrant = mongoose.models.PasswordResetGrant || mongoose.model("PasswordResetGrant", schema);
