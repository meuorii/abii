import "server-only";
import mongoose from "mongoose";
import { AchievementEvent } from "@/models/AchievementEvent";
import { Flashcard } from "@/models/Flashcard";
import { QuizSession } from "@/models/QuizSession";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";
import { User } from "@/models/User";
import { getSubjectMastery } from "@/lib/quiz/service";
import { currentConsecutiveDayStreak, longestConsecutiveDayStreak, normalizeStudyTimezone, studyDayKey } from "./study-day";

export type EvidenceCompleteness = "current-state" | "verified-minimum" | "incomplete";
export type QuizScoreEvidence = { scorePercent: number; originalQuestionCount: number; completedAt: Date; evidenceId: string };
export type SubjectMasteryEvidence = { subjectId: string; totalCards: number; masteredCards: number; progressPercent: number; genuinelyComplete: boolean };
export type AchievementBaseline = {
  recordedAt: Date;
  subjectIds: string[];
  flashcardCount: number;
  flashcardIds: string[];
  subjectsWithFlashcards: string[];
  studyDayKeys: string[];
  completedQuizCount: number;
  completedQuizSessionIds: string[];
  completedQuizDayKeys: string[];
  qualifyingQuizScores: QuizScoreEvidence[];
  correctQuizAnswers: number;
  distinctCorrectQuestionIdentities: number;
  enumerationFullyCorrectAnswers: number;
  resumedQuizCompletions: number;
  resumedQuizSessionIds: string[];
  masteryThresholdSubjectIds: Record<25 | 50 | 75 | 100, string[]>;
};
export type AchievementMetrics = {
  userId: string;
  evaluatedAt: Date;
  timezone: string;
  subjectCount: number;
  subjectIds: string[];
  flashcardIds: string[];
  flashcardCount: number;
  distinctSubjectsWithFlashcards: number;
  subjectIdsWithFlashcards: string[];
  subjectCreationCompleteness: EvidenceCompleteness;
  flashcardCreationCompleteness: EvidenceCompleteness;
  creationTimestamps: Date[];
  studyDayKeys: string[];
  currentStudyStreak: number;
  longestStudyStreak: number;
  completedQuizCount: number;
  completedQuizSessionIds: string[];
  completedQuizDayKeys: string[];
  firstQuizCompleted: boolean;
  quizHistoryCompleteness: EvidenceCompleteness;
  qualifyingQuizScores: QuizScoreEvidence[];
  correctQuizAnswers: number;
  distinctCorrectQuestionIdentities: number;
  enumerationFullyCorrectAnswers: number;
  resumedQuizCompletions: number;
  resumedQuizSessionIds: string[];
  subjectsWithFlashcards: SubjectMasteryEvidence[];
  masteryThresholdSubjectIds: Record<25 | 50 | 75 | 100, string[]>;
  fullyMasteredSubjectCount: number;
};

export function createAchievementBaseline(metrics: AchievementMetrics): AchievementBaseline {
  const sortedScores = [...metrics.qualifyingQuizScores].sort((a, b) => b.scorePercent - a.scorePercent);
  const selectedScores = sortedScores.length ? [sortedScores[0]] : [];
  const perfect = sortedScores.find((score) => score.scorePercent === 100);
  if (perfect && !selectedScores.some((score) => score.evidenceId === perfect.evidenceId)) selectedScores.push(perfect);
  return {
    recordedAt: metrics.evaluatedAt,
    subjectIds: metrics.subjectIds,
    flashcardCount: metrics.flashcardCount,
    flashcardIds: metrics.flashcardIds,
    subjectsWithFlashcards: metrics.subjectIdsWithFlashcards,
    studyDayKeys: metrics.studyDayKeys,
    completedQuizCount: metrics.completedQuizCount,
    completedQuizSessionIds: metrics.completedQuizSessionIds,
    completedQuizDayKeys: metrics.completedQuizDayKeys,
    qualifyingQuizScores: selectedScores,
    correctQuizAnswers: metrics.correctQuizAnswers,
    distinctCorrectQuestionIdentities: metrics.distinctCorrectQuestionIdentities,
    enumerationFullyCorrectAnswers: metrics.enumerationFullyCorrectAnswers,
    resumedQuizCompletions: metrics.resumedQuizCompletions,
    resumedQuizSessionIds: metrics.resumedQuizSessionIds,
    masteryThresholdSubjectIds: metrics.masteryThresholdSubjectIds,
  };
}

type CompactEventFacts = {
  studyDayKeys: (string | null)[];
  quizCompletionDays: (string | null)[];
  quizCount: number;
  quizCompletionKeys: (string | null)[];
  quizScores: { scorePercent: number; originalQuestionCount: number; completedAt: Date; evidenceId: string }[];
  correctAnswers: number;
  correctQuestionIdentities: { sessionId: mongoose.Types.ObjectId; questionIdentity: string }[];
  enumerationCorrect: number;
  resumedCount: number;
  resumedKeys: (string | null)[];
  masteryFacts: { subjectId: mongoose.Types.ObjectId; threshold: 25 | 50 | 75 | 100 }[];
};
type ReviewFacts = { studyDays: (string | null)[]; correctAnswers: number; enumerationCorrect: number };
type SessionQuestion = { flashcardId: mongoose.Types.ObjectId; type?: string; round?: number; origin?: number; answered?: boolean; correct?: boolean; answeredAt?: Date };
type CompletedSession = { _id: mongoose.Types.ObjectId; completedAt?: Date; resumedAt?: Date; questions: SessionQuestion[] };

function cardIdFromEventKey(value: string) { return value.startsWith("flashcard-created:") ? value.slice("flashcard-created:".length) : ""; }
function isValidCardId(value: string) { return mongoose.isValidObjectId(value); }

/** Calculate only evidence belonging to the supplied authenticated account. */
export async function calculateAchievementMetrics(userId: string, now = new Date(), baseline?: AchievementBaseline): Promise<AchievementMetrics> {
  if (!mongoose.isValidObjectId(userId)) throw new TypeError("A valid authenticated user ID is required.");
  const owner = new mongoose.Types.ObjectId(userId);
  const account = await User.findById(owner).select("settings.studyTimezone").lean();
  if (!account) throw new Error("User was not found.");
  const timezone = normalizeStudyTimezone(account.settings?.studyTimezone);

  const [subjects, cards, creationEvents, factsRows, reviewRows, completedSessions, mastery] = await Promise.all([
    Subject.find({ userId: owner }).select("_id createdAt").lean(),
    Flashcard.find({ userId: owner }).select("_id subjectId flashcardType createdAt").lean(),
    AchievementEvent.find({ userId: owner, kind: { $in: ["subject-created", "flashcard-created"] }, ...(baseline ? { createdAt: { $gt: baseline.recordedAt } } : {}) }).select("kind idempotencyKey subjectId occurredAt").lean(),
    AchievementEvent.aggregate<CompactEventFacts>([
      { $match: { userId: owner, ...(baseline ? { createdAt: { $gt: baseline.recordedAt } } : {}) } },
      { $group: {
        _id: null,
        studyDayKeys: { $addToSet: { $cond: [{ $eq: ["$kind", "study-day"] }, "$dayKey", null] } },
        quizCompletionDays: { $addToSet: { $cond: [{ $eq: ["$kind", "quiz-completed"] }, "$dayKey", null] } },
        quizCount: { $sum: { $cond: [{ $eq: ["$kind", "quiz-completed"] }, 1, 0] } },
        quizCompletionKeys: { $addToSet: { $cond: [{ $eq: ["$kind", "quiz-completed"] }, "$idempotencyKey", null] } },
        quizScores: { $push: { $cond: [{ $and: [{ $eq: ["$kind", "quiz-completed"] }, { $gte: ["$originalQuestionCount", 10] }, { $isNumber: "$scorePercent" }] }, { scorePercent: "$scorePercent", originalQuestionCount: "$originalQuestionCount", completedAt: "$occurredAt", evidenceId: "$idempotencyKey" }, "$$REMOVE"] } },
        correctAnswers: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "quiz-answer"] }, { $eq: ["$correct", true] }] }, 1, 0] } },
        correctQuestionIdentities: { $addToSet: { $cond: [{ $and: [{ $eq: ["$kind", "quiz-answer"] }, { $eq: ["$correct", true] }, { $ne: ["$sessionId", null] }, { $ne: ["$questionIdentity", null] }] }, { sessionId: "$sessionId", questionIdentity: "$questionIdentity" }, null] } },
        enumerationCorrect: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "quiz-answer"] }, { $eq: ["$enumerationFullyCorrect", true] }] }, 1, 0] } },
        resumedCount: { $sum: { $cond: [{ $eq: ["$kind", "resumed-quiz-completed"] }, 1, 0] } },
        resumedKeys: { $addToSet: { $cond: [{ $eq: ["$kind", "resumed-quiz-completed"] }, "$idempotencyKey", null] } },
        masteryFacts: { $addToSet: { $cond: [{ $eq: ["$kind", "mastery-milestone"] }, { subjectId: "$subjectId", threshold: "$masteryThreshold" }, null] } },
      } },
    ]),
    ReviewRecord.aggregate<ReviewFacts>([
      { $match: { userId: owner, ...(baseline ? { reviewedAt: { $gt: baseline.recordedAt } } : {}) } },
      { $facet: {
        studyDays: [{ $group: { _id: { $dateToString: { date: "$reviewedAt", format: "%Y-%m-%d", timezone } } } }],
        correctAnswers: [{ $match: { result: "correct" } }, { $count: "count" }],
        enumerationCorrect: [
          { $match: { result: "correct" } },
          { $lookup: { from: Flashcard.collection.name, localField: "flashcardId", foreignField: "_id", as: "card" } },
          { $unwind: "$card" },
          { $match: { "card.userId": owner, "card.flashcardType": "items" } },
          { $count: "count" },
        ],
      } },
      { $project: { studyDays: { $map: { input: "$studyDays", as: "day", in: "$$day._id" } }, correctAnswers: { $ifNull: [{ $arrayElemAt: ["$correctAnswers.count", 0] }, 0] }, enumerationCorrect: { $ifNull: [{ $arrayElemAt: ["$enumerationCorrect.count", 0] }, 0] } } },
    ]),
    QuizSession.find({ userId: owner, status: "completed", completedAt: { $type: "date" }, expiresAt: { $gt: now } }).select("_id completedAt resumedAt questions.flashcardId questions.type questions.round questions.origin questions.answered questions.correct questions.answeredAt").lean(),
    getSubjectMastery(owner),
  ]);

  const eventFacts = factsRows[0] ?? { studyDayKeys: [], quizCompletionDays: [], quizCount: 0, quizCompletionKeys: [], quizScores: [], correctAnswers: 0, correctQuestionIdentities: [], enumerationCorrect: 0, resumedCount: 0, resumedKeys: [], masteryFacts: [] };
  const reviewFacts = reviewRows[0] ?? { studyDays: [], correctAnswers: 0, enumerationCorrect: 0 };
  const historicalSubjectIds = new Set<string>((baseline?.subjectIds ?? []).map(String));
  const baselineFlashcardIds = new Set((baseline?.flashcardIds ?? []).map(String));
  const historicalFlashcards = new Map<string, { subjectId: string; createdAt: Date }>();
  for (const event of creationEvents) {
    if (event.kind === "subject-created" && event.subjectId) historicalSubjectIds.add(String(event.subjectId));
    if (event.kind === "flashcard-created" && event.subjectId) {
      const cardId = cardIdFromEventKey(event.idempotencyKey);
      if (isValidCardId(cardId)) historicalFlashcards.set(cardId, { subjectId: String(event.subjectId), createdAt: event.occurredAt });
      historicalSubjectIds.add(String(event.subjectId));
    }
  }
  for (const subject of subjects) historicalSubjectIds.add(String(subject._id));
  const creationByCardId = new Map<string, { subjectId: string; createdAt: Date }>(historicalFlashcards);
  for (const card of cards) {
    const id = String(card._id);
    const current = creationByCardId.get(id);
    creationByCardId.set(id, { subjectId: String(card.subjectId), createdAt: current?.createdAt ?? card.createdAt });
    historicalSubjectIds.add(String(card.subjectId));
  }
  const subjectIdsWithCards = new Set<string>([...(baseline?.subjectsWithFlashcards ?? []).map(String), ...cards.map((card) => String(card.subjectId))]);
  for (const item of historicalFlashcards.values()) subjectIdsWithCards.add(item.subjectId);

  const baselineQuizIds = new Set((baseline?.completedQuizSessionIds ?? []).map(String));
  const baselineResumeIds = new Set((baseline?.resumedQuizSessionIds ?? []).map(String));
  const quizEventKeys = eventFacts.quizCompletionKeys.filter((key): key is string => Boolean(key) && !baselineQuizIds.has(key!.replace(/^quiz-completed:/, "")));
  const resumedEventKeys = eventFacts.resumedKeys.filter((key): key is string => Boolean(key) && !baselineResumeIds.has(key!.replace(/^resumed-quiz-completed:/, "")));
  const quizScores = [...(baseline?.qualifyingQuizScores ?? []), ...eventFacts.quizScores.filter((score) => !baselineQuizIds.has(score.evidenceId.replace(/^quiz-completed:/, "")))];
  const sessionQuizDays = new Set<string>();
  const activeCompletedSessions = (completedSessions as unknown as CompletedSession[]).filter((session) => !baseline || Boolean(session.completedAt && session.completedAt > baseline.recordedAt));
  const sessionKeys = activeCompletedSessions.map((session) => `quiz-completed:${String(session._id)}`).filter((key) => !baselineQuizIds.has(key.replace(/^quiz-completed:/, "")));
  const resumedKeys = activeCompletedSessions.filter((session) => session.resumedAt && !baselineResumeIds.has(String(session._id)) && session.questions.some((question) => (question.round ?? 1) === 1 && question.answeredAt && question.answeredAt <= session.resumedAt!)).map((session) => `resumed-quiz-completed:${String(session._id)}`);
  const correctQuestionIdentities = new Set<string>(eventFacts.correctQuestionIdentities.filter(Boolean).map((item) => `${String(item.sessionId)}:${item.questionIdentity}`));
  for (const session of completedSessions as unknown as CompletedSession[]) {
    const completedAt = session.completedAt;
    if (!completedAt) continue;
    if (baseline && completedAt <= baseline.recordedAt) continue;
    sessionQuizDays.add(studyDayKey(completedAt, timezone));
    const original = session.questions.filter((question) => (question.round ?? 1) === 1);
    const correct = original.filter((question) => question.answered && question.correct === true).length;
    if (original.length >= 10 && original.every((question) => question.answered === true && typeof question.correct === "boolean")) quizScores.push({ scorePercent: correct / original.length * 100, originalQuestionCount: original.length, completedAt, evidenceId: `quiz-session:${String(session._id)}` });
    for (const [index, question] of session.questions.entries()) if ((question.round ?? 1) === 1 && question.answered && question.correct) correctQuestionIdentities.add(`${String(session._id)}:${question.origin ?? index}`);
  }
  const studyDays = [...new Set([...(baseline?.studyDayKeys ?? []), ...reviewFacts.studyDays, ...eventFacts.studyDayKeys].filter((day): day is string => Boolean(day)))].sort();
  const todayKey = studyDayKey(now, timezone);
  const masteryMap = mastery.bySubject as Map<string, { total: number; mastered: number; progress: number; completedRequirements: number; totalRequirements: number }>;
  const subjectsWithFlashcards: SubjectMasteryEvidence[] = [...masteryMap.entries()].filter(([, stats]) => stats.total > 0).map(([subjectId, stats]) => ({ subjectId, totalCards: stats.total, masteredCards: stats.mastered, progressPercent: stats.totalRequirements ? stats.completedRequirements / stats.totalRequirements * 100 : 0, genuinelyComplete: stats.total > 0 && stats.totalRequirements > 0 && stats.completedRequirements === stats.totalRequirements }));
  const thresholdIds: Record<25 | 50 | 75 | 100, Set<string>> = { 25: new Set(), 50: new Set(), 75: new Set(), 100: new Set() };
  for (const subject of subjectsWithFlashcards) for (const threshold of [25, 50, 75, 100] as const) {
    if (threshold === 100 ? subject.genuinelyComplete : subject.progressPercent >= threshold) thresholdIds[threshold].add(subject.subjectId);
  }
  for (const threshold of [25, 50, 75, 100] as const) for (const id of baseline?.masteryThresholdSubjectIds[threshold] ?? []) thresholdIds[threshold].add(String(id));
  for (const fact of eventFacts.masteryFacts) if (fact?.subjectId && [25, 50, 75, 100].includes(fact.threshold)) thresholdIds[fact.threshold as 25 | 50 | 75 | 100].add(String(fact.subjectId));

  const quizCompletionDayKeys = [...new Set([...(baseline?.completedQuizDayKeys ?? []), ...eventFacts.quizCompletionDays, ...sessionQuizDays].filter((day): day is string => Boolean(day)))].sort();
  const uniqueQuizEventIds = new Set(quizEventKeys.map((key) => key.replace(/^quiz-completed:/, "")));
  for (const key of sessionKeys) uniqueQuizEventIds.add(key.replace(/^quiz-completed:/, ""));
  const uniqueResumeEventIds = new Set(resumedEventKeys.map((key) => key.replace(/^resumed-quiz-completed:/, "")));
  for (const key of resumedKeys) uniqueResumeEventIds.add(key.replace(/^resumed-quiz-completed:/, ""));
  const quizCount = (baseline?.completedQuizCount ?? 0) + uniqueQuizEventIds.size;
  const postBaselineFlashcardIds = [...historicalFlashcards.keys()].filter((id) => !baselineFlashcardIds.has(id));
  const flashcardCount = baseline ? baseline.flashcardCount + new Set(postBaselineFlashcardIds).size : creationByCardId.size;

  return {
    userId,
    evaluatedAt: now,
    timezone,
    subjectCount: historicalSubjectIds.size,
    subjectIds: [...historicalSubjectIds],
    flashcardCount,
    flashcardIds: [...new Set([...(baseline?.flashcardIds ?? []).map(String), ...creationByCardId.keys()])],
    distinctSubjectsWithFlashcards: subjectIdsWithCards.size,
    subjectIdsWithFlashcards: [...subjectIdsWithCards],
    subjectCreationCompleteness: baseline ? (baseline.subjectIds.length ? "verified-minimum" : "incomplete") : creationEvents.some((event) => event.kind === "subject-created") ? "verified-minimum" : subjects.length ? "current-state" : "incomplete",
    flashcardCreationCompleteness: baseline ? (baseline.flashcardCount ? "verified-minimum" : "incomplete") : creationEvents.some((event) => event.kind === "flashcard-created") ? "verified-minimum" : cards.length ? "current-state" : "incomplete",
    creationTimestamps: [...subjects.map((subject) => subject.createdAt).filter((date): date is Date => Boolean(date)), ...[...creationByCardId.values()].map((card) => card.createdAt).filter((date): date is Date => Boolean(date))],
    studyDayKeys: studyDays,
    currentStudyStreak: currentConsecutiveDayStreak(studyDays, todayKey),
    longestStudyStreak: longestConsecutiveDayStreak(studyDays),
    completedQuizCount: quizCount,
    completedQuizSessionIds: [...new Set([...(baseline?.completedQuizSessionIds ?? []).map(String), ...uniqueQuizEventIds])],
    completedQuizDayKeys: quizCompletionDayKeys,
    firstQuizCompleted: quizCount > 0,
    quizHistoryCompleteness: quizCount > 0 ? "verified-minimum" : "incomplete",
    qualifyingQuizScores: quizScores,
    // After baseline, the compact event ledger is attempt-deduplicated and excludes retry rounds.
    // ReviewRecord is used only to establish the legacy baseline because it has no session/question identity.
    correctQuizAnswers: (baseline?.correctQuizAnswers ?? 0) + (baseline ? Math.max(correctQuestionIdentities.size, eventFacts.correctAnswers) : Math.max(eventFacts.correctAnswers, reviewFacts.correctAnswers)),
    distinctCorrectQuestionIdentities: (baseline?.distinctCorrectQuestionIdentities ?? 0) + correctQuestionIdentities.size,
    enumerationFullyCorrectAnswers: (baseline?.enumerationFullyCorrectAnswers ?? 0) + (baseline ? eventFacts.enumerationCorrect : Math.max(eventFacts.enumerationCorrect, reviewFacts.enumerationCorrect)),
    resumedQuizCompletions: (baseline?.resumedQuizCompletions ?? 0) + uniqueResumeEventIds.size,
    resumedQuizSessionIds: [...new Set([...(baseline?.resumedQuizSessionIds ?? []).map(String), ...uniqueResumeEventIds])],
    subjectsWithFlashcards,
    masteryThresholdSubjectIds: { 25: [...thresholdIds[25]], 50: [...thresholdIds[50]], 75: [...thresholdIds[75]], 100: [...thresholdIds[100]] },
    fullyMasteredSubjectCount: thresholdIds[100].size,
  };
}
