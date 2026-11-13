import "server-only";
import { Types } from "mongoose";
import { addCalendarDays, getStudyDayWindow, normalizeStudyTimezone } from "@/lib/badges/study-day";
import { connectToDatabase } from "@/lib/mongodb";
import { QuizSession } from "@/models/QuizSession";
import { ReviewRecord } from "@/models/ReviewRecord";
import { measureServerOperation } from "@/lib/performance/server-timing";

type ReviewActivityRow = { date: string; count: number };
type RecentSessionRow = {
  _id: Types.ObjectId;
  subjectName: string;
  type: string;
  date: Date;
  answered: number;
  correct: number;
};

export type ProgressSessionAnalytics = {
  sessionCount: number;
  sessionActivity: ReviewActivityRow[];
  recentSessions: Array<{ id: string; subject: string; quizType: string; date: Date; answered: number; correct: number }>;
};

/** Fetches only the 90-day review buckets for the account's current cards. */
export async function loadProgressReviewActivity(
  userId: Types.ObjectId | string,
  currentCardIds: readonly string[],
  studyTimezone: string,
  todayKey: string,
): Promise<ReviewActivityRow[]> {
  await connectToDatabase();
  const owner = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
  const timezone = normalizeStudyTimezone(studyTimezone);
  const start = getStudyDayWindow(addCalendarDays(todayKey, -89), timezone).start;
  const end = getStudyDayWindow(addCalendarDays(todayKey, 1), timezone).start;
  const reviewFilter = {
    userId: owner,
    flashcardId: { $in: currentCardIds.map((id) => new Types.ObjectId(id)) },
    reviewedAt: { $gte: start, $lt: end },
  };

  if (!currentCardIds.length) return [];
  return measureServerOperation("progress 90-day review activity aggregation", () => ReviewRecord.aggregate<ReviewActivityRow>([
        { $match: reviewFilter },
        { $group: { _id: { $dateToString: { date: "$reviewedAt", format: "%Y-%m-%d", timezone } }, count: { $sum: 1 } } },
        { $project: { _id: 0, date: "$_id", count: 1 } },
        { $sort: { date: 1 } },
      ]), { database: true });
}

/** Counts retained completed sessions and returns daily buckets plus five score summaries. */
export async function loadProgressSessionAnalytics(
  userId: Types.ObjectId | string,
  studyTimezone: string,
  todayKey: string,
): Promise<ProgressSessionAnalytics> {
  await connectToDatabase();
  const owner = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
  const timezone = normalizeStudyTimezone(studyTimezone);
  const start = getStudyDayWindow(addCalendarDays(todayKey, -89), timezone).start;
  const end = getStudyDayWindow(addCalendarDays(todayKey, 1), timezone).start;
  const sessionFilter = { userId: owner, status: "completed" as const };
  const [sessionCount, sessionActivity, recent] = await Promise.all([
    measureServerOperation("progress completed session count", () => QuizSession.countDocuments(sessionFilter), { database: true }),
    measureServerOperation("progress 90-day session activity aggregation", () => QuizSession.aggregate<ReviewActivityRow>([
      { $match: { ...sessionFilter, completedAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $dateToString: { date: "$completedAt", format: "%Y-%m-%d", timezone } }, count: { $sum: 1 } } },
      { $project: { _id: 0, date: "$_id", count: 1 } },
      { $sort: { date: 1 } },
    ]), { database: true }),
    measureServerOperation("progress recent session summaries aggregation", () => QuizSession.aggregate<RecentSessionRow>([
      { $match: sessionFilter },
      { $addFields: { date: { $ifNull: ["$completedAt", "$createdAt"] } } },
      // `_id: 1` makes same-date ordering deterministic and matches insertion order for legacy ObjectIds.
      { $sort: { date: -1, _id: 1 } },
      { $limit: 5 },
      { $project: {
        _id: 1,
        subjectName: 1,
        type: 1,
        date: 1,
        answered: { $size: { $filter: { input: { $ifNull: ["$questions", []] }, as: "question", cond: "$$question.answered" } } },
        correct: { $size: { $filter: { input: { $ifNull: ["$questions", []] }, as: "question", cond: { $and: ["$$question.answered", "$$question.correct"] } } } },
      } },
    ]), { database: true }),
  ]);

  return {
    sessionCount,
    sessionActivity,
    recentSessions: recent.map((session) => ({
      id: String(session._id),
      subject: session.subjectName,
      quizType: session.type,
      date: new Date(session.date),
      answered: session.answered,
      correct: session.correct,
    })),
  };
}
