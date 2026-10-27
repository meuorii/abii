import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const ACHIEVEMENT_EVENT_KINDS = ["subject-created", "flashcard-created", "quiz-completed", "quiz-answer", "resumed-quiz-completed", "study-day", "mastery-milestone"] as const;
const achievementEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  idempotencyKey: { type: String, required: true, minlength: 1, maxlength: 200 },
  kind: { type: String, enum: ACHIEVEMENT_EVENT_KINDS, required: true },
  occurredAt: { type: Date, required: true },
  dayKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
  sessionId: { type: Schema.Types.ObjectId, ref: "QuizSession" },
  /** Stable identity within a session; contains no user answer or question text. */
  questionIdentity: { type: String, maxlength: 40 },
  /** Compact verified numeric facts only; never store prompt, answer, hint, or question text. */
  originalQuestionCount: { type: Number, min: 0 },
  firstAttemptCorrectCount: { type: Number, min: 0 },
  scorePercent: { type: Number, min: 0, max: 100 },
  correct: { type: Boolean },
  enumerationFullyCorrect: { type: Boolean },
  resumed: { type: Boolean },
  masteryPercent: { type: Number, min: 0, max: 100 },
  masteryThreshold: { type: Number, enum: [25, 50, 75, 100] },
}, { timestamps: true, versionKey: false, strict: "throw" });

achievementEventSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, name: "achievement_event_owner_key_unique" });
achievementEventSchema.index({ userId: 1, kind: 1, dayKey: 1 }, { name: "achievement_event_owner_kind_day" });
achievementEventSchema.index({ userId: 1, createdAt: -1 }, { name: "achievement_event_owner_created" });

if (mongoose.models.AchievementEvent && !mongoose.models.AchievementEvent.schema.indexes().some(([keys, options]) => keys.userId === 1 && keys.idempotencyKey === 1 && options.unique)) mongoose.deleteModel("AchievementEvent");
export type AchievementEventDocument = InferSchemaType<typeof achievementEventSchema>;
export const AchievementEvent: Model<AchievementEventDocument> = (mongoose.models.AchievementEvent as Model<AchievementEventDocument> | undefined) ?? mongoose.model<AchievementEventDocument>("AchievementEvent", achievementEventSchema);
