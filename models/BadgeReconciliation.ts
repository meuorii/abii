import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BADGE_IDS } from "@/lib/badges/types";

const badgeEvaluationSchema = new Schema({
  badgeId: { type: String, enum: [...BADGE_IDS], required: true },
  unlocked: { type: Boolean, required: true },
  alreadyEarned: { type: Boolean, required: true },
  progress: { type: Number, required: true, min: 0 },
  target: { type: Number, required: true, min: 1 },
  remaining: { type: Number, required: true, min: 0 },
  progressLabel: { type: String, required: true, maxlength: 120 },
  evidenceCompleteness: { type: String, enum: ["current-state", "verified-minimum", "incomplete"], required: true },
  historicalNote: { type: String, maxlength: 240 },
  evidenceSubjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
  evidenceId: { type: String, maxlength: 160 },
}, { _id: false, strict: "throw" });

const baselineScoreSchema = new Schema({
  scorePercent: { type: Number, min: 0, max: 100, required: true },
  originalQuestionCount: { type: Number, min: 10, required: true },
  completedAt: { type: Date, required: true },
  evidenceId: { type: String, required: true, maxlength: 160 },
}, { _id: false, strict: "throw" });
const baselineMasterySchema = new Schema({
  25: { type: [{ type: Schema.Types.ObjectId, ref: "Subject" }], default: [] },
  50: { type: [{ type: Schema.Types.ObjectId, ref: "Subject" }], default: [] },
  75: { type: [{ type: Schema.Types.ObjectId, ref: "Subject" }], default: [] },
  100: { type: [{ type: Schema.Types.ObjectId, ref: "Subject" }], default: [] },
}, { _id: false, strict: "throw" });
const achievementBaselineSchema = new Schema({
  recordedAt: { type: Date, required: true },
  subjectIds: { type: [{ type: Schema.Types.ObjectId, ref: "Subject" }], default: [] },
  flashcardCount: { type: Number, required: true, min: 0 },
  flashcardIds: { type: [String], default: [] },
  subjectsWithFlashcards: { type: [{ type: Schema.Types.ObjectId, ref: "Subject" }], default: [] },
  studyDayKeys: { type: [String], default: [] },
  completedQuizCount: { type: Number, required: true, min: 0 },
  completedQuizSessionIds: { type: [String], default: [] },
  completedQuizDayKeys: { type: [String], default: [] },
  qualifyingQuizScores: { type: [baselineScoreSchema], default: [] },
  correctQuizAnswers: { type: Number, required: true, min: 0 },
  distinctCorrectQuestionIdentities: { type: Number, required: true, min: 0 },
  enumerationFullyCorrectAnswers: { type: Number, required: true, min: 0 },
  resumedQuizCompletions: { type: Number, required: true, min: 0 },
  resumedQuizSessionIds: { type: [String], default: [] },
  masteryThresholdSubjectIds: { type: baselineMasterySchema, required: true },
}, { _id: false, strict: "throw" });

const badgeReconciliationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  version: { type: Number, required: true, default: 0 },
  evaluatedAt: { type: Date },
  lockToken: { type: String },
  lockUntil: { type: Date },
  results: { type: [badgeEvaluationSchema], default: [] },
  baseline: { type: achievementBaselineSchema },
}, { timestamps: true, versionKey: false, strict: "throw" });
badgeReconciliationSchema.index({ userId: 1 }, { unique: true, name: "badge_reconciliation_owner_unique" });

if (mongoose.models.BadgeReconciliation && !mongoose.models.BadgeReconciliation.schema.indexes().some(([keys, options]) => keys.userId === 1 && options.unique)) mongoose.deleteModel("BadgeReconciliation");
export type BadgeReconciliationDocument = InferSchemaType<typeof badgeReconciliationSchema>;
export const BadgeReconciliation: Model<BadgeReconciliationDocument> = (mongoose.models.BadgeReconciliation as Model<BadgeReconciliationDocument> | undefined) ?? mongoose.model<BadgeReconciliationDocument>("BadgeReconciliation", badgeReconciliationSchema);
