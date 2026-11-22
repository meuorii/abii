import "server-only";
import type { PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User, ordinaryRoleFilter } from "@/models/User";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
import { AchievementEvent } from "@/models/AchievementEvent";
import { AdminSecurityEvent, denials } from "@/models/AdminAuditLog";

const dayMs = 86_400_000;
const maxTimeMS = 1500;
const aggregateOptions = { maxTimeMS, allowDiskUse: false };
// On larger collections require the approved date-leading index rather than scanning history.
const unindexedCollectionLimit = 50_000;
export type ReportingDays = 7 | 30 | 90;
export type DailyCount = { day: string; count: number };
type Bucket = { _id: string; count: number };

export function reportingWindow(value: unknown, now = new Date()) {
  const days: ReportingDays = value === "7" ? 7 : value === "90" ? 90 : 30;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { days, start: new Date(+end - days * dayMs), end };
}

function fillDays(window: ReturnType<typeof reportingWindow>, buckets: Bucket[]): DailyCount[] {
  const counts = new Map(buckets.map(bucket => [bucket._id, bucket.count]));
  return Array.from({ length: window.days }, (_, offset) => {
    const day = new Date(+window.start + offset * dayMs).toISOString().slice(0, 10);
    return { day, count: counts.get(day) ?? 0 };
  });
}

const dayKey = (date: string) => ({
  $dateToString: { date, format: "%Y-%m-%d", timezone: "UTC" },
});

// Runs after grouping by owner, so each aggregate joins each owner at most once.
function retainedOwner(): PipelineStage[] {
  return [
    { $lookup: { from: User.collection.name, localField: "_id", foreignField: "_id",
      pipeline: [{ $match: ordinaryRoleFilter }, { $project: { _id: 1 } }], as: "owner" } },
    { $match: { "owner.0": { $exists: true } } },
  ];
}

type Range = { $gte: Date; $lt: Date };
async function countCompletions(range: Range, now: Date) {
  const query = AchievementEvent.aggregate<{ count: number }>([
    { $match: { kind: "quiz-completed", occurredAt: range, userId: { $type: "objectId" }, $or: [
      { sessionId: { $type: "objectId" } }, { idempotencyKey: /^quiz-completed:[a-f0-9]{24}$/i },
    ] } },
    { $project: { userId: 1, session: { $ifNull: [
      { $convert: { input: "$sessionId", to: "objectId", onError: null, onNull: null } },
      { $convert: { input: { $substrBytes: [{ $ifNull: ["$idempotencyKey", ""] }, 15, 24] }, to: "objectId", onError: null, onNull: null } },
    ] } } },
    { $unionWith: { coll: QuizSession.collection.name, pipeline: [
      { $match: { status: "completed", completedAt: range, expiresAt: { $gt: now }, userId: { $type: "objectId" } } },
      { $project: { userId: 1, session: "$_id" } },
    ] } },
    { $match: { session: { $type: "objectId" } } },
    { $group: { _id: { owner: "$userId", session: "$session" } } },
    { $group: { _id: "$_id.owner", count: { $sum: 1 } } },
    ...retainedOwner(),
    { $group: { _id: null, count: { $sum: "$count" } } },
  ]).option(aggregateOptions);
  if (await AchievementEvent.estimatedDocumentCount().maxTimeMS(maxTimeMS) > unindexedCollectionLimit) {
    query.hint({ kind: 1, occurredAt: 1, userId: 1 });
  }
  const rows = await query;
  return rows[0]?.count ?? 0;
}

type ReviewBuckets = { daily: Bucket[]; owners: { count: number }[] };
async function readReviews(range: Range, window: ReturnType<typeof reportingWindow>) {
  const query = ReviewRecord.aggregate<ReviewBuckets>([
    { $match: { reviewedAt: range, userId: { $type: "objectId" } } },
    { $group: { _id: { owner: "$userId", day: dayKey("$reviewedAt") }, count: { $sum: 1 } } },
    { $group: { _id: "$_id.owner", days: { $push: { day: "$_id.day", count: "$count" } } } },
    ...retainedOwner(),
    { $project: { days: 1 } },
    { $facet: {
      owners: [{ $count: "count" }],
      daily: [{ $unwind: "$days" }, { $group: { _id: "$days.day", count: { $sum: "$days.count" } } }],
    } },
  ]).option(aggregateOptions);
  if (await ReviewRecord.estimatedDocumentCount().maxTimeMS(maxTimeMS) > unindexedCollectionLimit) {
    query.hint({ reviewedAt: 1, userId: 1 });
  }
  const rows = await query;
  return { active: rows[0]?.owners[0]?.count ?? 0, series: fillDays(window, rows[0]?.daily ?? []) };
}

async function readRecent() {
  const rows = await User.find({ ...ordinaryRoleFilter, createdAt: { $type: "date" } })
    .sort({ createdAt: -1, _id: -1 }).limit(5).select("_id name createdAt emailVerifiedAt suspendedAt").lean().maxTimeMS(maxTimeMS);
  return rows.map(row => ({
    id: String(row._id), name: row.name, createdAt: row.createdAt.toISOString(),
    status: row.suspendedAt instanceof Date ? "Suspended" : row.emailVerifiedAt instanceof Date ? "Verified" : "Unverified",
  }));
}

async function readAttention(range: Range) {
  const latest = await AdminSecurityEvent.findOne({ kind: { $in: denials }, occurredAt: range })
    .select("-_id kind occurredAt").sort({ occurredAt: -1, _id: -1 }).lean().maxTimeMS(maxTimeMS);
  return latest ? { kind: latest.kind, occurredAt: latest.occurredAt.toISOString() } : null;
}

async function section<T>(query: () => PromiseLike<T>) {
  try { return await query(); } catch { return null; }
}

/** Server-only repository. The Overview route authorizes the request before invoking it. */
export async function readOverview(period: unknown, now = new Date()) {
  const window = reportingWindow(period, now);
  const range = { $gte: window.start, $lt: window.end };
  // Share acquisition; each section handles connectivity or query failure independently.
  const connection = connectToDatabase();
  const read = <T,>(query: () => PromiseLike<T>) => section(async () => { await connection; return query(); });

  const [totalUsers, totalFlashcards, growth, reviews, completedQuizzes, recent, attention] = await Promise.all([
    read(() => User.countDocuments(ordinaryRoleFilter).maxTimeMS(maxTimeMS)),
    read(() => Flashcard.countDocuments().hint("_id_").maxTimeMS(maxTimeMS)),
    read(async () => fillDays(window, await User.aggregate<Bucket>([
      { $match: { ...ordinaryRoleFilter, createdAt: range } },
      { $group: { _id: dayKey("$createdAt"), count: { $sum: 1 } } },
    ]).option(aggregateOptions))),
    read(() => readReviews(range, window)),
    read(() => countCompletions(range, now)),
    read(readRecent),
    read(async () => ({ latest: await readAttention(range) })),
  ]);
  return { window, readAt: now, totalUsers, totalFlashcards, growth, reviews, completedQuizzes, recent,
    attention: attention?.latest ?? null, attentionFailed: attention === null };
}

export type OverviewReport = Awaited<ReturnType<typeof readOverview>>;
