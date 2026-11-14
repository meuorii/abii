import "server-only";
import mongoose, { Types } from "mongoose";
import { addCalendarDays, getStudyDayWindow, normalizeStudyTimezone, studyDayKey } from "@/lib/badges/study-day";
import { connectToDatabase } from "@/lib/mongodb";
import { AchievementEvent } from "@/models/AchievementEvent";
import { Flashcard } from "@/models/Flashcard";
import { Notification } from "@/models/Notification";
import { NotificationScheduleState } from "@/models/NotificationScheduleState";
import { QuizSession } from "@/models/QuizSession";
import { ReviewRecord } from "@/models/ReviewRecord";
import { User } from "@/models/User";
import { createNotification } from "./service";
import { normalizeNotificationPreferences } from "./contracts";
import { getCompletedWeek, getInactivityTier, isDailyReminderWindow, isEveningReminderWindow, studyStreakThroughYesterday, completeLocalDaysSince } from "./reminder-policy";

const REMINDER_TYPES = ["flashcards_due", "study_streak", "unfinished_quiz", "daily_study_reminder", "weekly_progress", "study_inactivity"] as const;
const DAILY_REMINDERS = ["flashcards_due", "study_streak", "unfinished_quiz", "daily_study_reminder", "study_inactivity"] as const;
const WEEKLY_WINDOW_START_HOUR = 6;
const WEEKLY_WINDOW_END_HOUR = 12;
const INACTIVITY_WINDOW_START_HOUR = 10;
const INACTIVITY_WINDOW_END_HOUR = 20;
const DAY_MS = 86_400_000;

type ReminderCounts = { created: number; existing: number; suppressed: number; candidates: number };
type Candidate = {
  type: (typeof REMINDER_TYPES)[number];
  title: string;
  message: string;
  dedupeKey: string;
  target: "/review" | "/progress";
  metadata: { count?: number; sessionId?: string; periodKey?: string; eventId?: string };
  expiresAt: Date;
  priority: number;
};
type ReminderAccount = { _id: Types.ObjectId; settings?: { studyTimezone?: string; dailyStudyTime?: string | null; notifications?: unknown } };

function localHour(date: Date, timezone: string): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).formatToParts(date).find((part) => part.type === "hour")?.value ?? "0");
}

function localTomorrow(timezone: string, todayKey: string): Date {
  return getStudyDayWindow(addCalendarDays(todayKey, 1), timezone).start;
}

function plusLocalDays(timezone: string, todayKey: string, days: number): Date {
  return getStudyDayWindow(addCalendarDays(todayKey, days), timezone).start;
}

async function countDueCards(userId: Types.ObjectId, now: Date): Promise<number> {
  const result = await Flashcard.aggregate<{ count: number }>([
    { $match: { userId } },
    { $lookup: {
      from: ReviewRecord.collection.name,
      let: { cardId: "$_id" },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$userId", userId] }, { $eq: ["$flashcardId", "$$cardId"] }] } } },
        { $sort: { reviewedAt: -1, _id: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, nextReviewAt: 1 } },
      ],
      as: "latestReview",
    } },
    { $match: { $expr: { $or: [
      { $eq: [{ $size: "$latestReview" }, 0] },
      { $lte: [{ $arrayElemAt: ["$latestReview.nextReviewAt", 0] }, now] },
    ] } } },
    { $count: "count" },
  ]);
  return result[0]?.count ?? 0;
}

async function buildCandidates(userId: Types.ObjectId, now: Date, account?: ReminderAccount): Promise<{ candidates: Candidate[]; frequencyRows: Array<{ type: string; dedupeKey: string }> }> {
  const user = account ?? await User.findById(userId).select("settings.notifications settings.dailyStudyTime settings.studyTimezone").lean();
  if (!user) return { candidates: [], frequencyRows: [] };
  const settings = user.settings;
  const zone = normalizeStudyTimezone(settings?.studyTimezone);
  const today = studyDayKey(now, zone);
  const day = getStudyDayWindow(today, zone);
  const tomorrow = localTomorrow(zone, today);
  const preferences = normalizeNotificationPreferences({ ...(settings?.notifications ?? {}), dailyStudyTime: settings?.dailyStudyTime });
  const enabled = (type: (typeof REMINDER_TYPES)[number]) => type === "daily_study_reminder"
    ? preferences.daily_study_reminder && Boolean(settings?.dailyStudyTime)
    : preferences[type];
  const candidates: Candidate[] = [];
  const frequencyRows = await Notification.find({ userId, type: { $in: REMINDER_TYPES }, createdAt: { $gte: new Date(now.getTime() - DAY_MS), $lt: now } }).select("type dedupeKey").lean();

  const studiedToday = Boolean(await AchievementEvent.exists({ userId, kind: "study-day", occurredAt: { $gte: day.start, $lt: day.end } }));
  const recentActivity = await AchievementEvent.findOne({ userId, kind: { $in: ["study-day", "quiz-completed"] } }).sort({ occurredAt: -1, _id: -1 }).select("occurredAt").lean();
  const lastActivityDay = recentActivity?.occurredAt ? studyDayKey(recentActivity.occurredAt, zone) : null;
  const inactiveDays = lastActivityDay ? completeLocalDaysSince(lastActivityDay, today) : null;
  const prolongedInactivity = inactiveDays !== null && inactiveDays >= 3;

  if (enabled("study_streak") && !studiedToday && isEveningReminderWindow(now, zone)) {
    const priorStudyEvents = await AchievementEvent.find({ userId, kind: "study-day", occurredAt: { $lt: day.start } }).sort({ occurredAt: -1, _id: -1 }).limit(10_000).select("occurredAt").lean();
    const studyDays = new Set(priorStudyEvents.map((event) => studyDayKey(event.occurredAt, zone)));
    const streak = studyStreakThroughYesterday(studyDays, today);
    if (streak > 0) candidates.push({ type: "study_streak", title: "Keep your streak going!", message: `Your ${streak}-day study streak is waiting. A quick review can help keep it alive!`, dedupeKey: `study-streak:${today}`, target: "/review", metadata: { count: streak, periodKey: today }, expiresAt: tomorrow, priority: 1 });
  }

  if (enabled("unfinished_quiz")) {
    const inactiveSince = new Date(now.getTime() - DAY_MS);
    const eligible = { userId, status: "active", expiresAt: { $gt: now }, lastActivityAt: { $lte: inactiveSince }, questions: { $exists: true, $ne: [] } };
    const [count, session] = await Promise.all([
      QuizSession.countDocuments(eligible),
      QuizSession.findOne(eligible).sort({ lastActivityAt: 1, _id: 1 }).select("_id lastActivityAt expiresAt").lean(),
    ]);
    if (count && session) {
      const activityIdentity = `${String(session._id)}:${new Date(session.lastActivityAt).getTime()}`;
      candidates.push({ type: "unfinished_quiz", title: "Your quiz is waiting!", message: count === 1 ? "You have an unfinished quiz ready to resume. Pick up where you left off!" : `You have ${count} unfinished quizzes ready to resume. Pick up where you left off!`, dedupeKey: `unfinished-quiz:${activityIdentity}`, target: "/review", metadata: { count, sessionId: String(session._id), eventId: `quiz-idle:${activityIdentity}` }, expiresAt: new Date(session.expiresAt), priority: 2 });
    }
  }

  if (!prolongedInactivity && enabled("flashcards_due") && !frequencyRows.some((row) => row.type === "flashcards_due")) {
    const count = await countDueCards(userId, now);
    if (count > 0) candidates.push({ type: "flashcards_due", title: "Your flashcards are ready!", message: `You have ${count} ${count === 1 ? "flashcard" : "flashcards"} ready for review. A little practice can help them stick!`, dedupeKey: `flashcards-due:${today}`, target: "/review", metadata: { count, periodKey: today }, expiresAt: plusLocalDays(zone, today, 30), priority: 3 });
  }

  if (!prolongedInactivity && enabled("daily_study_reminder") && !studiedToday && !frequencyRows.some((row) => row.type === "daily_study_reminder") && settings?.dailyStudyTime && isDailyReminderWindow(now, zone, settings.dailyStudyTime)) {
    candidates.push({ type: "daily_study_reminder", title: "A little study time?", message: "A few minutes of practice today can make a difference. Ready to review with Abii?", dedupeKey: `daily-study:${today}`, target: "/review", metadata: { periodKey: today }, expiresAt: plusLocalDays(zone, today, 30), priority: 4 });
  }

  if (enabled("weekly_progress")) {
    const week = getCompletedWeek(now, zone);
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const hour = localHour(now, zone);
    const isWeeklyWindow = (weekday === 1 && hour >= WEEKLY_WINDOW_START_HOUR && hour < WEEKLY_WINDOW_END_HOUR) || (weekday === 2 && hour >= WEEKLY_WINDOW_START_HOUR && hour < WEEKLY_WINDOW_END_HOUR);
    const periodAlreadySent = frequencyRows.some((row) => row.type === "weekly_progress" && row.dedupeKey === `weekly-progress:${week.startKey}`);
    if (isWeeklyWindow && !periodAlreadySent) {
      const [activityRows, completedQuizzes] = await Promise.all([
        AchievementEvent.find({ userId, kind: { $in: ["study-day", "quiz-completed"] }, occurredAt: { $gte: week.start, $lt: week.end } }).select("occurredAt").lean(),
        AchievementEvent.countDocuments({ userId, kind: "quiz-completed", occurredAt: { $gte: week.start, $lt: week.end } }),
      ]);
      const days = new Set(activityRows.map((event) => studyDayKey(event.occurredAt, zone)));
      if (days.size || completedQuizzes) {
        const dayText = `${days.size} ${days.size === 1 ? "day" : "days"}`;
        const quizText = `${completedQuizzes} ${completedQuizzes === 1 ? "quiz" : "quizzes"}`;
        candidates.push({ type: "weekly_progress", title: "Your weekly learning recap is here!", message: `You studied on ${dayText} and completed ${quizText} last week.`, dedupeKey: `weekly-progress:${week.startKey}`, target: "/progress", metadata: { count: completedQuizzes, periodKey: week.startKey }, expiresAt: plusLocalDays(zone, today, 90), priority: 6 });
      }
    }
  }

  if (enabled("study_inactivity") && lastActivityDay && !studiedToday) {
    const hour = localHour(now, zone);
    const tier = inactiveDays === null ? null : getInactivityTier(inactiveDays);
    if (tier && hour >= INACTIVITY_WINDOW_START_HOUR && hour < INACTIVITY_WINDOW_END_HOUR) {
      const episode = recentActivity?.occurredAt ? new Date(recentActivity.occurredAt).getTime() : lastActivityDay;
      candidates.push({ type: "study_inactivity", title: "Abii misses studying with you!", message: "It's been a few days since your last study session. Ready for a fresh start?", dedupeKey: `study-inactivity:${episode}:${tier}`, target: "/review", metadata: { periodKey: lastActivityDay, eventId: `inactivity:${episode}:${tier}` }, expiresAt: plusLocalDays(zone, today, 30), priority: 0 });
    }
  }

  return { candidates, frequencyRows };
}

/** Evaluates one account at a captured instant. Database uniqueness remains the final duplicate guard. */
export async function evaluateUserReminders(userId: string, now = new Date(), account?: ReminderAccount): Promise<ReminderCounts> {
  if (!mongoose.isObjectIdOrHexString(userId) || !Number.isFinite(now.getTime())) throw new TypeError("A valid user identifier and evaluation time are required.");
  await connectToDatabase();
  const owner = new Types.ObjectId(userId);
  if (account && !account._id.equals(owner)) throw new TypeError("Reminder account snapshot must match the notification owner.");
  const { candidates, frequencyRows } = await buildCandidates(owner, now, account);
  const counts: ReminderCounts = { created: 0, existing: 0, suppressed: 0, candidates: candidates.length };
  const selected = candidates.filter((candidate) => candidate.type === "weekly_progress");
  const remindersAlreadySent = frequencyRows.filter((row) => DAILY_REMINDERS.includes(row.type as (typeof DAILY_REMINDERS)[number])).length;
  let remaining = Math.max(0, 2 - remindersAlreadySent);
  const seenTypes = new Set(frequencyRows.map((row) => row.type));
  for (const candidate of candidates.filter((item) => item.type !== "weekly_progress").sort((a, b) => a.priority - b.priority)) {
    if (seenTypes.has(candidate.type) || remaining === 0) { counts.suppressed += 1; continue; }
    selected.push(candidate);
    seenTypes.add(candidate.type);
    remaining -= 1;
  }
  for (const candidate of selected) {
    const result = await createNotification(userId, {
      type: candidate.type,
      title: candidate.title,
      message: candidate.message,
      dedupeKey: candidate.dedupeKey,
      target: candidate.target,
      metadata: candidate.metadata,
      expiresAt: candidate.expiresAt,
    });
    if (result.status === "created") counts.created += 1;
    else if (result.status === "already_exists") counts.existing += 1;
    else counts.suppressed += 1;
  }
  return counts;
}

export interface ReminderBatchResult extends ReminderCounts { examined: number; errors: number; busy: boolean; hasMore: boolean; durationMs: number }

/** Processes one bounded, restartable page of verified accounts, guarded by a MongoDB lease. */
export async function runReminderBatch(now = new Date(), batchSize = 50): Promise<ReminderBatchResult> {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new TypeError("A valid run time and batch size from 1 to 100 are required.");
  const startedAt = Date.now();
  await connectToDatabase();
  const leaseToken = new Types.ObjectId().toHexString();
  const leaseUntil = new Date(now.getTime() + 90_000);
  let state: { cursor?: Types.ObjectId | null; leaseToken?: string | null } | null;
  try {
    state = await NotificationScheduleState.findOneAndUpdate(
      { _id: "study-reminders", $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
      { $set: { leaseToken, leaseUntil, updatedAt: now }, $setOnInsert: { cursor: null } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).select("cursor leaseToken").lean();
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      return { created: 0, existing: 0, suppressed: 0, candidates: 0, examined: 0, errors: 0, busy: true, hasMore: true, durationMs: Date.now() - startedAt };
    }
    throw error;
  }
  if (!state || state.leaseToken !== leaseToken) return { created: 0, existing: 0, suppressed: 0, candidates: 0, examined: 0, errors: 0, busy: true, hasMore: true, durationMs: Date.now() - startedAt };

  const release = async (cursor: Types.ObjectId | null) => {
    await NotificationScheduleState.updateOne({ _id: "study-reminders", leaseToken }, { $set: { cursor, leaseUntil: new Date(0), leaseToken: null, updatedAt: new Date() } });
  };
  try {
    const query: Record<string, unknown> = {
      emailVerifiedAt: { $type: "date" },
      $or: [
        { "settings.notifications.flashcards_due": { $ne: false } },
        { "settings.notifications.study_streak": { $ne: false } },
        { "settings.notifications.unfinished_quiz": { $ne: false } },
        { "settings.notifications.weekly_progress": { $ne: false } },
        { "settings.notifications.daily_study_reminder": true, "settings.dailyStudyTime": { $type: "string" } },
        { "settings.notifications.study_inactivity": true },
      ],
    };
    if (state.cursor) query._id = { $gt: state.cursor };
    const users = await User.find(query).select("_id settings.notifications settings.dailyStudyTime settings.studyTimezone").sort({ _id: 1 }).limit(batchSize).lean();
    if (users.length === 0 && state.cursor) {
      await release(null);
      return { created: 0, existing: 0, suppressed: 0, candidates: 0, examined: 0, errors: 0, busy: false, hasMore: false, durationMs: Date.now() - startedAt };
    }
    const totals: ReminderBatchResult = { created: 0, existing: 0, suppressed: 0, candidates: 0, examined: users.length, errors: 0, busy: false, hasMore: users.length === batchSize, durationMs: 0 };
    for (let offset = 0; offset < users.length; offset += 4) {
      const group = users.slice(offset, offset + 4);
      const results = await Promise.all(group.map(async (user) => {
        try { return await evaluateUserReminders(String(user._id), now, user); }
        catch (error) {
          totals.errors += 1;
          console.error("Study reminder evaluation failed for an account.", { category: "study-reminders", failure: error instanceof Error ? error.name : "UnknownError" });
          return null;
        }
      }));
      for (const result of results) if (result) {
        totals.created += result.created;
        totals.existing += result.existing;
        totals.suppressed += result.suppressed;
        totals.candidates += result.candidates;
      }
    }
    await release(users.at(-1)?._id ?? state.cursor ?? null);
    totals.durationMs = Date.now() - startedAt;
    return totals;
  } catch (error) {
    await release(state.cursor ?? null);
    throw error;
  }
}
