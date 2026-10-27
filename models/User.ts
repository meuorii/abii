import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BADGE_IDS } from "@/lib/badges/types";
import { isIanaStudyTimezone } from "@/lib/badges/study-day";

const badgeIds = [...BADGE_IDS];

const userSettingsSchema = new Schema({
  targetSubjects: { type: Number, min: 1, max: 100, default: 5 },
  defaultLandingPage: { type: String, enum: ["/dashboard", "/subjects", "/review", "/progress"], default: "/dashboard" },
  subjectLayout: { type: String, enum: ["grid", "list"], default: "grid" },
  featuredBadges: {
    dashboard: { type: [{ type: String, enum: badgeIds }], default: [] , validate: { validator: (ids: string[]) => ids.length <= 3 && new Set(ids).size === ids.length, message: "Choose up to 3 different badges." } },
    progress: { type: [{ type: String, enum: badgeIds }], default: [], validate: { validator: (ids: string[]) => ids.length <= 3 && new Set(ids).size === ids.length, message: "Choose up to 3 different badges." } },
  },
  studyTimezone: { type: String, default: "UTC", validate: { validator: isIanaStudyTimezone, message: "Study timezone must be a valid IANA timezone." } },
}, { _id: false });

const userSchema = new Schema({
  name: { type: String, required: [true, "Name is required"], trim: true, minlength: [1, "Name cannot be empty"], maxlength: [80, "Name must be 80 characters or fewer"] },
  email: { type: String, required: [true, "Email is required"], trim: true, lowercase: true, maxlength: [254, "Email must be 254 characters or fewer"], match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"] },
  passwordHash: { type: String, required: [true, "Password hash is required"], select: false, minlength: [1, "Password hash cannot be empty"] },
  settings: { type: userSettingsSchema, default: () => ({}) },
  profileImage: { type: String, default: undefined, maxlength: 2048 },
  profileImagePublicId: { type: String, default: undefined, maxlength: 255 },
}, { timestamps: true, versionKey: false });
userSchema.index({ email: 1 }, { unique: true, name: "user_email_unique" });

// Replace a cached development model if it predates settings or the profile image fields.
// Without this, Mongoose strict mode silently drops profileImage / profileImagePublicId on update.
{
  const cached = mongoose.models.User;
  if (
    cached &&
    (!cached.schema.path("settings") ||
      !cached.schema.path("profileImage") ||
      !cached.schema.path("profileImagePublicId") ||
      !(cached.schema.path("settings") as unknown as { schema?: { path: (name: string) => unknown } }).schema?.path("featuredBadges") ||
      !(cached.schema.path("settings") as unknown as { schema?: { path: (name: string) => unknown } }).schema?.path("studyTimezone"))
  ) {
    mongoose.deleteModel("User");
  }
}

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User: Model<UserDocument> = (mongoose.models.User as Model<UserDocument> | undefined) ?? mongoose.model<UserDocument>("User", userSchema);
