import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const ADMIN_ID = "primary";
export const ADMIN_SUBJECT = `admin:${ADMIN_ID}` as const;
export const ADMIN_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ADMIN_PASSWORD_HASH = /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/;
export const SHA256_HEX = /^[a-f0-9]{64}$/;
const version = { type: Number, required: true, min: 0, validate: Number.isSafeInteger } as const;

const completed = new Schema({
  hash: { type: String, required: true, match: SHA256_HEX },
  version,
  expiresAt: { type: Date, required: true },
}, { _id: false, strict: "throw" });

const factor = new Schema({
  encryptedSeed: { type: String, required: true },
  lastStep: { type: Number, required: true, min: -1, validate: Number.isSafeInteger },
  proofHash: { type: String, match: SHA256_HEX },
  enrollmentExpiresAt: Date,
  challengeHash: { type: String, match: SHA256_HEX },
  challengeVersion: { type: Number, min: 0, validate: Number.isSafeInteger },
  challengeExpiresAt: Date,
  completedChallenges: { type: [completed], default: [] },
}, { _id: false, strict: "throw" });

const activeAdminSession = new Schema({
  sessionId: { type: String, required: true, match: /^[A-Za-z0-9_-]{32}$/ },
  version,
  authenticatedAt: { type: Date, required: true },
  absoluteExpiresAt: { type: Date, required: true },
  lastActivityAt: { type: Date, required: true },
  environment: { type: String, required: true, enum: ["development", "production"] },
}, { _id: false, strict: "throw" });

const schema = new Schema({
  _id: { type: String, required: true, enum: [ADMIN_ID] },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: ADMIN_EMAIL_PATTERN, immutable: true },
  passwordHash: { type: String, required: true, match: ADMIN_PASSWORD_HASH, select: false },
  status: { type: String, required: true, enum: ["pending", "active", "suspended"] },
  mfa: { type: factor, required: true, select: false },
  recoveryCodes: { type: [{ type: String, match: SHA256_HEX }], default: [], select: false },
  sessionVersion: version,
  activeSession: { type: activeAdminSession, select: false },
  mutationVersion: { type: Number, min: 0, default: 0, select: false },
  lastLoginAt: Date,
}, { collection: "admins", autoCreate: false, autoIndex: false, strict: "throw", timestamps: true, versionKey: false });

export type AdminRecord = InferSchemaType<typeof schema>;
export const Admin: Model<AdminRecord> = mongoose.models.Admin ?? mongoose.model<AdminRecord>("Admin", schema);
