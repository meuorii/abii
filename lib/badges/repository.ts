import "server-only";
import mongoose from "mongoose";
import type { ClientSession } from "mongoose";
import { BADGE_IDS, type BadgeId } from "./types";
import { AchievementEvent, type ACHIEVEMENT_EVENT_KINDS } from "@/models/AchievementEvent";
import { UserBadge } from "@/models/UserBadge";
import { User } from "@/models/User";
import { longestConsecutiveDayStreak } from "./study-day";

const validBadgeIds = new Set<string>(BADGE_IDS);
export type AchievementEventKind = (typeof ACHIEVEMENT_EVENT_KINDS)[number];
export type AchievementEventInput = {
  idempotencyKey: string; kind: AchievementEventKind; occurredAt: Date; dayKey?: string; subjectId?: string;
  sessionId?: string; questionIdentity?: string;
  originalQuestionCount?: number; firstAttemptCorrectCount?: number; scorePercent?: number; correct?: boolean;
  enumerationFullyCorrect?: boolean; resumed?: boolean; masteryPercent?: number; masteryThreshold?: 25 | 50 | 75 | 100;
};
export type DurableAchievementStats = {
  qualifyingFlashcardsCreated: number;
  distinctSubjectIdsWithFlashcards: string[];
  completedQuizzes: number;
  quizCompletionDayKeys: string[];
  qualifyingCorrectQuizAnswers: number;
  fullyCorrectEnumerationQuestions: number;
  bestQualifyingQuizScore: number | null;
  qualifyingPerfectScoreAchieved: boolean;
  completedResumedQuizzes: number;
  studyDayKeys: string[];
  longestStudyStreak: number;
  subjectMasteryThresholds: Record<string, number[]>;
  fullyMasteredSubjectIds: string[];
};

function ownedUserId(userId: string) {
  if (!mongoose.isValidObjectId(userId)) throw new TypeError("A valid authenticated user ID is required.");
  return new mongoose.Types.ObjectId(userId);
}

export async function fetchEarnedBadges(userId: string) {
  return UserBadge.find({ userId: ownedUserId(userId) }).sort({ unlockedAt: 1, badgeId: 1 }).lean();
}

export async function findEarnedBadge(userId: string, badgeId: BadgeId) {
  return UserBadge.findOne({ userId: ownedUserId(userId), badgeId }).lean();
}

/** First award wins: repeated/concurrent calls cannot replace unlockedAt or evidence. */
export async function createEarnedBadgeIdempotently(userId: string, input: { badgeId: BadgeId; unlockedAt: Date; verifiedAt: Date; source: "live" | "backfill"; minimalEvidence?: { metric?: string; target?: number; observed?: number; subjectId?: string; eventId?: string } }) {
  return (await awardBadgeIdempotently(userId, input)).record;
}

/** Reports creation only when this call inserted the permanent award. */
export async function awardBadgeIdempotently(userId: string, input: { badgeId: BadgeId; unlockedAt: Date; verifiedAt: Date; source: "live" | "backfill"; minimalEvidence?: { metric?: string; target?: number; observed?: number; subjectId?: string; eventId?: string } }) {
  if (!validBadgeIds.has(input.badgeId)) throw new TypeError("Unknown badge ID.");
  const owner = ownedUserId(userId);
  const setOnInsert = { userId: owner, ...input };
  let created = false;
  try {
    await UserBadge.create(setOnInsert);
    created = true;
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
  }
  const record = await UserBadge.findOne({ userId: owner, badgeId: input.badgeId }).lean();
  if (!record) throw new Error("Badge award could not be confirmed.");
  return { record, created };
}

/** Append compact verified facts; duplicate idempotency keys return the original event. */
export async function recordAchievementEvent(userId: string, input: AchievementEventInput, session?: ClientSession) {
  const owner = ownedUserId(userId);
  try {
    return await AchievementEvent.findOneAndUpdate(
      { userId: owner, idempotencyKey: input.idempotencyKey },
      { $setOnInsert: { userId: owner, ...input } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) },
    ).lean();
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
    return AchievementEvent.findOne({ userId: owner, idempotencyKey: input.idempotencyKey }).lean();
  }
}

/** Stats are derived from the append-only event ledger to avoid counter drift and double writes. */
export async function readDurableAchievementStats(userId: string): Promise<DurableAchievementStats> {
  const events = await AchievementEvent.find({ userId: ownedUserId(userId) }).select("kind dayKey subjectId originalQuestionCount firstAttemptCorrectCount scorePercent correct enumerationFullyCorrect resumed masteryPercent masteryThreshold").lean();
  const flashcardEvents = events.filter((event) => event.kind === "flashcard-created");
  const quizEvents = events.filter((event) => event.kind === "quiz-completed");
  const qualifyingQuizzes = quizEvents.filter((event) => (event.originalQuestionCount ?? 0) >= 10 && typeof event.scorePercent === "number");
  const subjectMasteryThresholds: Record<string, number[]> = {};
  for (const event of events) if (event.kind === "mastery-milestone" && event.subjectId && event.masteryThreshold) {
    const key = String(event.subjectId);
    subjectMasteryThresholds[key] ??= [];
    if (!subjectMasteryThresholds[key].includes(event.masteryThreshold)) subjectMasteryThresholds[key].push(event.masteryThreshold);
  }
  const studyDayKeys = [...new Set(events.filter((event) => event.kind === "study-day" && event.dayKey).map((event) => event.dayKey!))].sort();
  return {
    qualifyingFlashcardsCreated: flashcardEvents.length,
    distinctSubjectIdsWithFlashcards: [...new Set(flashcardEvents.flatMap((event) => event.subjectId ? [String(event.subjectId)] : []))].sort(),
    completedQuizzes: quizEvents.length,
    quizCompletionDayKeys: [...new Set(quizEvents.flatMap((event) => event.dayKey ? [event.dayKey] : []))].sort(),
    qualifyingCorrectQuizAnswers: events.filter((event) => event.kind === "quiz-answer" && event.correct === true).length,
    fullyCorrectEnumerationQuestions: events.filter((event) => event.kind === "quiz-answer" && event.enumerationFullyCorrect === true).length,
    bestQualifyingQuizScore: qualifyingQuizzes.reduce<number | null>((best, event) => best === null || event.scorePercent! > best ? event.scorePercent! : best, null),
    qualifyingPerfectScoreAchieved: qualifyingQuizzes.some((event) => event.scorePercent === 100),
    completedResumedQuizzes: events.filter((event) => event.kind === "resumed-quiz-completed").length,
    studyDayKeys,
    longestStudyStreak: longestConsecutiveDayStreak(studyDayKeys),
    subjectMasteryThresholds: Object.fromEntries(Object.entries(subjectMasteryThresholds).map(([subject, thresholds]) => [subject, thresholds.sort((a, b) => a - b)])),
    fullyMasteredSubjectIds: Object.entries(subjectMasteryThresholds).filter(([, thresholds]) => thresholds.includes(100)).map(([subject]) => subject).sort(),
  };
}

export async function fetchFeaturedBadgeSelections(userId: string) {
  const user = await User.findById(ownedUserId(userId)).select("settings.featuredBadges").lean();
  return { dashboard: user?.settings?.featuredBadges?.dashboard ?? [], progress: user?.settings?.featuredBadges?.progress ?? [] };
}

export async function updateFeaturedBadgeSelection(userId: string, surface: "dashboard" | "progress", ids: readonly string[]) {
  if (ids.length > 3 || new Set(ids).size !== ids.length || ids.some((id) => !validBadgeIds.has(id))) throw new TypeError("Choose up to 3 unique official badges.");
  const owner = ownedUserId(userId);
  const earned = await UserBadge.find({ userId: owner, badgeId: { $in: ids } }).select("badgeId").lean();
  if (earned.length !== ids.length) throw new TypeError("Only earned badges can be featured.");
  const result = await User.updateOne({ _id: owner }, { $set: { [`settings.featuredBadges.${surface}`]: [...ids] } }, { runValidators: true });
  if (!result.matchedCount) throw new Error("User was not found.");
  return fetchFeaturedBadgeSelections(userId);
}
