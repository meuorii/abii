import "server-only";
import type { PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User, ordinaryRoleFilter } from "@/models/User";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
import { AchievementEvent } from "@/models/AchievementEvent";
import { AdminSecurityEvent, denials } from "@/models/AdminAuditLog";
import { aggregateOptions, dayKey, fillDays, precedingWindow, reportingMaxTimeMS as maxTimeMS, reportingWindow, unindexedCollectionLimit, type DailyCount } from "./reporting";
export { reportingWindow } from "./reporting";
export type { DailyCount, ReportingDays } from "./reporting";
type Bucket = { _id: string; count: number };
type Range = { $gte: Date; $lt: Date };

function retainedOwner(localField = "_id"): PipelineStage[] {
  return [
    { $lookup: { from: User.collection.name, localField, foreignField: "_id", pipeline: [{ $match: ordinaryRoleFilter }, { $project: { _id: 1 } }], as: "owner" } },
    { $match: { "owner.0": { $exists: true } } },
  ];
}

type MetricTrend = {
  current: number | null; previous: number | null; absoluteChange: number | null; percentageChange: number | null;
  direction: "up" | "down" | "flat" | "unavailable"; availability: "available" | "partial" | "unavailable";
  comparisonLabel: string; series: DailyCount[] | null;
};
function metricTrend(current: number | null, previous: number | null, series: DailyCount[] | null, comparisonLabel: string, availability: MetricTrend["availability"] = "available"): MetricTrend {
  const comparable = current !== null && previous !== null && availability !== "unavailable";
  const absoluteChange = comparable ? current - previous : null;
  return { current, previous, absoluteChange, percentageChange: comparable && previous > 0 ? ((current - previous) / previous) * 100 : null,
    direction: absoluteChange === null ? "unavailable" : absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "flat",
    availability: current === null ? "unavailable" : availability, comparisonLabel, series };
}

async function readReviews(window: ReturnType<typeof reportingWindow>, previous: ReturnType<typeof reportingWindow>) {
  const query = ReviewRecord.aggregate<{ daily: Bucket[]; activeDaily: Bucket[]; owners: { _id: string; count: number }[] }>([
    { $match: { reviewedAt: { $gte: previous.start, $lt: window.end }, userId: { $type: "objectId" } } },
    { $group: { _id: { owner: "$userId", day: dayKey("$reviewedAt") }, count: { $sum: 1 } } },
    { $group: { _id: "$_id.owner", days: { $push: { day: "$_id.day", count: "$count" } } } },
    ...retainedOwner(),
    { $project: { days: 1 } },
    { $unwind: "$days" },
    { $facet: {
      owners: [
        { $group: { _id: {
          period: { $cond: [{ $gte: ["$days.day", window.start.toISOString().slice(0, 10)] }, "current", "previous"] },
          owner: "$_id",
        } } },
        { $group: { _id: "$_id.period", count: { $sum: 1 } } },
      ],
      daily: [
        { $match: { "days.day": { $gte: window.start.toISOString().slice(0, 10) } } },
        { $group: { _id: "$days.day", count: { $sum: "$days.count" } } },
      ],
      activeDaily: [
        { $match: { "days.day": { $gte: window.start.toISOString().slice(0, 10) } } },
        { $group: { _id: "$days.day", count: { $sum: 1 } } },
      ],
    } },
  ]).option(aggregateOptions);
  if (await ReviewRecord.estimatedDocumentCount().maxTimeMS(maxTimeMS) > unindexedCollectionLimit) query.hint({ reviewedAt: 1, userId: 1 });
  const row = (await query)[0];
  const owners = Object.fromEntries((row?.owners ?? []).map(item => [item._id, item.count]));
  return { active: owners.current ?? 0, previousActive: owners.previous ?? 0, series: fillDays(window, row?.daily ?? []), activeSeries: fillDays(window, row?.activeDaily ?? []) };
}

async function countCompletions(window: ReturnType<typeof reportingWindow>, previous: ReturnType<typeof reportingWindow>, now: Date) {
  const range = { $gte: previous.start, $lt: window.end };
  const query = AchievementEvent.aggregate<{ _id: string; count: number; daily: Bucket[] }>([
    { $match: { kind: "quiz-completed", occurredAt: range, userId: { $type: "objectId" }, $or: [{ sessionId: { $type: "objectId" } }, { idempotencyKey: /^quiz-completed:[a-f0-9]{24}$/i }] } },
    { $project: { userId: 1, occurredAt: 1, session: { $ifNull: [{ $convert: { input: "$sessionId", to: "objectId", onError: null, onNull: null } }, { $convert: { input: { $substrBytes: [{ $ifNull: ["$idempotencyKey", ""] }, 15, 24] }, to: "objectId", onError: null, onNull: null } }] } } },
    { $unionWith: { coll: QuizSession.collection.name, pipeline: [{ $match: { status: "completed", completedAt: range, expiresAt: { $gt: now }, userId: { $type: "objectId" } } }, { $project: { userId: 1, occurredAt: "$completedAt", session: "$_id" } }] } },
    { $match: { session: { $type: "objectId" } } },
    { $group: { _id: { owner: "$userId", session: "$session" }, occurredAt: { $min: "$occurredAt" } } },
    ...retainedOwner("_id.owner"),
    { $group: { _id: { period: { $cond: [{ $gte: ["$occurredAt", window.start] }, "current", "previous"] }, day: dayKey("$occurredAt") }, count: { $sum: 1 } } },
    { $group: { _id: "$_id.period", count: { $sum: "$count" }, daily: { $push: { _id: "$_id.day", count: "$count" } } } },
  ]).option(aggregateOptions);
  if (await AchievementEvent.estimatedDocumentCount().maxTimeMS(maxTimeMS) > unindexedCollectionLimit) query.hint({ kind: 1, occurredAt: 1, userId: 1 });
  return Object.fromEntries((await query).map(({ _id, count, daily }) => [_id, { count, daily }])) as Record<string, { count: number; daily: Bucket[] }>;
}

function safeProfileImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
async function readRecent() {
  const rows = await User.find({ ...ordinaryRoleFilter, createdAt: { $type: "date" } }).sort({ createdAt: -1, _id: -1 }).limit(5)
    .select("_id name createdAt emailVerifiedAt suspendedAt profileImage").lean().maxTimeMS(maxTimeMS);
  return rows.map(row => ({ id: String(row._id), name: row.name, profileImage: safeProfileImage(row.profileImage), createdAt: row.createdAt.toISOString(), status: row.suspendedAt instanceof Date ? "Suspended" : row.emailVerifiedAt instanceof Date ? "Verified" : "Unverified" }));
}
async function readAttention(range: Range) {
  const latest = await AdminSecurityEvent.findOne({ kind: { $in: denials }, occurredAt: range }).select("-_id kind occurredAt").sort({ occurredAt: -1, _id: -1 }).lean().maxTimeMS(maxTimeMS);
  return latest ? { kind: latest.kind, occurredAt: latest.occurredAt.toISOString() } : null;
}
async function section<T>(query: () => PromiseLike<T>) { try { return await query(); } catch { return null; } }

/** Server-only reporting service. Call only after the admin page/API authorization guard. */
export async function readOverview(period: unknown, now = new Date()) {
  const window = reportingWindow(period, now);
  const previous = precedingWindow(window);
  const range = { $gte: window.start, $lt: window.end };
  const previousRange = { $gte: previous.start, $lt: previous.end };
  const connection = connectToDatabase();
  const read = <T,>(query: () => PromiseLike<T>) => section(async () => { await connection; return query(); });
  const [totalUsers, totalFlashcards, registrationSeries, previousRegistrations, reviews, completions, flashcardSeries, recent, attention] = await Promise.all([
    read(() => User.countDocuments(ordinaryRoleFilter).maxTimeMS(maxTimeMS)),
    read(() => Flashcard.countDocuments().hint("_id_").maxTimeMS(maxTimeMS)),
    read(async () => fillDays(window, await User.aggregate<Bucket>([{ $match: { ...ordinaryRoleFilter, createdAt: range } }, { $group: { _id: dayKey("$createdAt"), count: { $sum: 1 } } }]).option(aggregateOptions))),
    read(() => User.countDocuments({ ...ordinaryRoleFilter, createdAt: previousRange }).maxTimeMS(maxTimeMS)),
    read(() => readReviews(window, previous)),
    read(() => countCompletions(window, previous, now)),
    read(async () => fillDays(window, await Flashcard.aggregate<Bucket>([
      { $match: { createdAt: range, userId: { $type: "objectId" } } }, { $group: { _id: "$userId", days: { $push: dayKey("$createdAt") } } }, ...retainedOwner(),
      { $unwind: "$days" }, { $group: { _id: "$days", count: { $sum: 1 } } },
    ]).option(aggregateOptions))),
    read(readRecent), read(async () => ({ latest: await readAttention(range) })),
  ]);
  const registrationCount = registrationSeries?.reduce((sum, point) => sum + point.count, 0) ?? null;
  const completionCurrent = completions ? completions.current?.count ?? 0 : null;
  const completionPrevious = completions ? completions.previous?.count ?? 0 : null;
  const completionSeries = completions ? fillDays(window, completions.current?.daily ?? []) : null;
  const trends = {
    totalUsers: metricTrend(totalUsers, null, registrationSeries, "Registration activity", totalUsers === null ? "unavailable" : "partial"),
    registrations: metricTrend(registrationCount, previousRegistrations, registrationSeries, `vs previous ${window.days} days`),
    activeLearners: metricTrend(reviews?.active ?? null, reviews?.previousActive ?? null, reviews?.activeSeries ?? null, `vs previous ${window.days} days`),
    totalFlashcards: metricTrend(totalFlashcards, null, flashcardSeries, "Retained flashcards created", totalFlashcards === null ? "unavailable" : "partial"),
    completedQuizzes: metricTrend(completionCurrent, completionPrevious, completionSeries, `Verified minimum vs previous ${window.days} days`, "partial"),
  };
  return { window, readAt: now, totalUsers, totalFlashcards, growth: registrationSeries, reviews: reviews ? { active: reviews.active, series: reviews.series, activeSeries: reviews.activeSeries } : null,
    completedQuizzes: completionCurrent, recent, attention: attention?.latest ?? null, attentionFailed: attention === null, trends };
}
export type OverviewReport = Awaited<ReturnType<typeof readOverview>>;
