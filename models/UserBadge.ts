import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BADGE_IDS } from "@/lib/badges/types";

const userBadgeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  badgeId: { type: String, enum: [...BADGE_IDS], required: true },
  unlockedAt: { type: Date, required: true },
  verifiedAt: { type: Date, required: true },
  source: { type: String, enum: ["live", "backfill"], required: true },
  minimalEvidence: {
    metric: { type: String, maxlength: 80 },
    target: { type: Number, min: 1 },
    observed: { type: Number, min: 0 },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    eventId: { type: String, maxlength: 160 },
  },
}, { timestamps: true, versionKey: false, strict: "throw" });

userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true, name: "user_badge_unique" });
userBadgeSchema.index({ userId: 1, unlockedAt: -1 }, { name: "user_badges_by_unlock" });

if (mongoose.models.UserBadge && !mongoose.models.UserBadge.schema.indexes().some(([keys, options]) => keys.userId === 1 && keys.badgeId === 1 && options.unique)) mongoose.deleteModel("UserBadge");
export type UserBadgeDocument = InferSchemaType<typeof userBadgeSchema>;
export const UserBadge: Model<UserBadgeDocument> = (mongoose.models.UserBadge as Model<UserBadgeDocument> | undefined) ?? mongoose.model<UserBadgeDocument>("UserBadge", userBadgeSchema);
