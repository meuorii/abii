import "server-only";
import type { Aggregate, PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User, ordinaryRoleFilter } from "@/models/User";
import { ReviewRecord } from "@/models/ReviewRecord";
import { QuizSession } from "@/models/QuizSession";
import { Subject } from "@/models/Subject";
import { Flashcard } from "@/models/Flashcard";
import {
  type AnalyticsReport, type MetricResult, type Retention, type RetentionCohort, type RetentionRates,
  type ReviewActivity, type ReviewTotals, type Trend, type QuizDistribution, quizModes, retentionHorizon,
} from "./analytics-contract";
import {
  aggregateOptions, calendarDays, dayKey, dayMs, fillDays, precedingWindow, reportingMaxTimeMS,
  reportingWindow, unindexedCollectionLimit, type ReportingWindow,
} from "./reporting";

// Only the explicit demo seeder writes this marker. Includes legacy ordinary users.
const eligibleUsers = { ...ordinaryRoleFilter, $nor: [{ demoSeedKey: { $type: "string", $ne: "" } }] };
const quizCoverage = "Completed sessions expire after 24 hours. Only surviving sessions are shown, and the completion ledger does not record the selected mode.";
type Periods = { current: ReportingWindow; previous: ReportingWindow };
type Bucket = { _id: string; count: number };
type SignupBucket = Bucket & { eligible: number; verified: number };
type RetentionBucket = { _id: { day: string; distance: number }; count: number };
type ReviewBucket = Omit<ReviewTotals, "ungraded"> & { _id: string; active: number };
type ReviewBuckets = {
  daily: ReviewBucket[];
  unique: { current: number; previous: number }[];
  returns: RetentionBucket[];
};
type CollectionSize = { estimatedDocumentCount(): { maxTimeMS(ms: number): PromiseLike<number> } };

async function bounded<T>(model: CollectionSize, query: Aggregate<T[]>, index: Record<string, 1 | -1>): Promise<T[]> {
  query.option(aggregateOptions);
  if (await model.estimatedDocumentCount().maxTimeMS(reportingMaxTimeMS) > unindexedCollectionLimit) query.hint(index);
  return query.exec();
}

function retainedOwner(localField: string, includeSignup = false): PipelineStage[] {
  return [
    { $lookup: { from: User.collection.name, localField, foreignField: "_id", as: "owner",
      pipeline: [{ $match: eligibleUsers }, { $project: includeSignup ? { createdAt: 1 } : { _id: 1 } }] } },
    { $match: { "owner.0": { $exists: true } } },
  ];
}

function trend(periods: Periods, buckets: Bucket[]): Trend {
  const daily = fillDays(periods.current, buckets);
  const sum = (rows: { count: number }[]) => rows.reduce((total, row) => total + row.count, 0);
  return { current: sum(daily), previous: sum(fillDays(periods.previous, buckets)), daily };
}

function readSignups({ current, previous }: Periods) {
  // Use the same 24 elapsed hours for each registration. Cut off both cohorts
  // at their respective period ends so recent signups get equal observation time.
  const maturityCutoff = { $cond: [{ $gte: ["$createdAt", current.start] },
    new Date(+current.end - dayMs), new Date(+previous.end - dayMs)] };
  return bounded(User, User.aggregate<SignupBucket>([
    { $match: { ...eligibleUsers, createdAt: { $gte: previous.start, $lt: current.end } } },
    { $project: { createdAt: 1, emailVerifiedAt: 1, mature: { $lte: ["$createdAt", maturityCutoff] } } },
    { $group: {
      _id: dayKey("$createdAt"),
      count: { $sum: 1 },
      eligible: { $sum: { $cond: ["$mature", 1, 0] } },
      verified: { $sum: { $cond: [{ $and: ["$mature", { $eq: [{ $type: "$emailVerifiedAt" }, "date"] },
        { $gte: ["$emailVerifiedAt", "$createdAt"] }, { $lte: ["$emailVerifiedAt", { $add: ["$createdAt", dayMs] }] }] }, 1, 0] } },
    } },
  ]), { createdAt: -1, _id: -1 });
}

function readReviews({ current, previous }: Periods) {
  const cohortStart = { $arrayElemAt: ["$owner.createdAt", 0] };
  const isCurrent = { $gte: ["$$day.date", current.start] };
  const touched = (condition: object) => ({ $cond: [{ $anyElementTrue: [{
    $map: { input: "$days", as: "day", in: condition },
  }] }, 1, 0] });
  return bounded(ReviewRecord, ReviewRecord.aggregate<ReviewBuckets>([
    { $match: { reviewedAt: { $gte: previous.start, $lt: current.end }, userId: { $type: "objectId" } } },
    { $group: {
      _id: { owner: "$userId", date: { $dateTrunc: { date: "$reviewedAt", unit: "day", timezone: "UTC" } } },
      attempts: { $sum: 1 },
      correct: { $sum: { $cond: [{ $eq: ["$result", "correct"] }, 1, 0] } },
      wrong: { $sum: { $cond: [{ $eq: ["$result", "wrong"] }, 1, 0] } },
    } },
    // At most 180 entries per owner. Raw attempts and study content are never materialized.
    { $group: { _id: "$_id.owner", days: { $push: {
      date: "$_id.date", attempts: "$attempts", correct: "$correct", wrong: "$wrong",
    } } } },
    ...retainedOwner("_id", true),
    { $project: { days: 1, signup: cohortStart } },
    { $facet: {
      unique: [
        { $project: { current: touched(isCurrent), previous: touched({ $not: [isCurrent] }) } },
        { $group: { _id: null, current: { $sum: "$current" }, previous: { $sum: "$previous" } } },
      ],
      daily: [
        { $unwind: "$days" },
        { $group: { _id: dayKey("$days.date"), active: { $sum: 1 }, attempts: { $sum: "$days.attempts" },
          correct: { $sum: "$days.correct" }, wrong: { $sum: "$days.wrong" } } },
      ],
      returns: [
        { $match: { signup: { $gte: previous.start, $lt: current.end } } },
        { $unwind: "$days" },
        // Restrict observations to the matching report period in each cohort.
        { $match: { $expr: { $eq: [{ $gte: ["$signup", current.start] }, { $gte: ["$days.date", current.start] }] } } },
        { $project: { day: dayKey("$signup"), distance: { $dateDiff: {
          startDate: "$signup", endDate: "$days.date", unit: "day", timezone: "UTC",
        } } } },
        { $match: { distance: { $in: [...retentionHorizon] } } },
        { $group: { _id: { day: "$day", distance: "$distance" }, count: { $sum: 1 } } },
      ],
    } },
  ]), { reviewedAt: 1, userId: 1 });
}

function retention(periods: Periods, signups: SignupBucket[], returns: RetentionBucket[]): Retention {
  const sizes = new Map(signups.map(bucket => [bucket._id, bucket.count]));
  const counts = new Map(returns.map(bucket => [`${bucket._id.day}/${bucket._id.distance}`, bucket.count]));
  const emptyRates = (): RetentionRates => ({ 1: { counted: 0, eligible: 0 }, 7: { counted: 0, eligible: 0 }, 30: { counted: 0, eligible: 0 } });

  function compute(window: ReportingWindow) {
    const overall = emptyRates();
    const cohorts: RetentionCohort[] = [];
    for (const [position, day] of calendarDays(window).entries()) {
      if (position % 7 === 0) cohorts.push({ start: day, end: day, size: 0, rates: emptyRates() });
      const cohort = cohorts[cohorts.length - 1];
      const size = sizes.get(day) ?? 0;
      cohort.end = day;
      cohort.size += size;
      for (const horizon of retentionHorizon) {
        const returnDay = +new Date(day) + horizon * dayMs;
        if (returnDay >= +window.end) continue;
        const counted = counts.get(`${day}/${horizon}`) ?? 0;
        for (const rates of [cohort.rates, overall]) {
          rates[horizon].eligible += size;
          rates[horizon].counted += counted;
        }
      }
    }
    return { overall, cohorts };
  }
  const current = compute(periods.current);
  return { current: current.overall, previous: compute(periods.previous).overall, cohorts: current.cohorts };
}

function reviewActivity(periods: Periods, input: ReviewBucket[]): ReviewActivity {
  const buckets = new Map(input.map(bucket => [bucket._id, bucket]));
  const daily = (window: ReportingWindow) => calendarDays(window).map(day => {
    const { attempts = 0, correct = 0, wrong = 0 } = buckets.get(day) ?? {};
    return { day, attempts, correct, wrong, ungraded: attempts - correct - wrong };
  });
  const sum = (days: ReviewTotals[]) => days.reduce((total, day) => ({
    attempts: total.attempts + day.attempts, correct: total.correct + day.correct,
    wrong: total.wrong + day.wrong, ungraded: total.ungraded + day.ungraded,
  }), { attempts: 0, correct: 0, wrong: 0, ungraded: 0 });
  const current = daily(periods.current);
  return { current: sum(current), previous: sum(daily(periods.previous)), daily: current };
}

function readContent(model: typeof Subject | typeof Flashcard, { current, previous }: Periods) {
  return bounded(model, model.aggregate<Bucket>([
    { $match: { createdAt: { $gte: previous.start, $lt: current.end }, userId: { $type: "objectId" } } },
    { $group: { _id: { owner: "$userId", day: dayKey("$createdAt") }, count: { $sum: 1 } } },
    ...retainedOwner("_id.owner"),
    { $group: { _id: "$_id.day", count: { $sum: "$count" } } },
  ]), { createdAt: 1, userId: 1 });
}

async function readQuizModes(window: ReportingWindow, now: Date): Promise<QuizDistribution> {
  const rows = await bounded(QuizSession, QuizSession.aggregate<{ _id: string; count: number; first: Date; last: Date }>([
    { $match: { status: "completed", expiresAt: { $gt: now }, completedAt: { $gte: window.start, $lt: window.end },
      userId: { $type: "objectId" } } },
    { $project: { userId: 1, completedAt: 1, mode: {
      $cond: [{ $in: ["$type", quizModes.map(mode => mode.id)] }, "$type", "unknown"],
    } } },
    ...retainedOwner("userId"),
    { $group: { _id: "$mode", count: { $sum: 1 }, first: { $min: "$completedAt" }, last: { $max: "$completedAt" } } },
  ]), { expiresAt: 1 });
  const counts = new Map(rows.map(row => [row._id, row.count]));
  return {
    modes: { "multiple-choice": counts.get("multiple-choice") ?? 0, identification: counts.get("identification") ?? 0,
      "true-false": counts.get("true-false") ?? 0, random: counts.get("random") ?? 0 },
    unknown: counts.get("unknown") ?? 0,
    first: rows.length ? new Date(Math.min(...rows.map(row => +row.first))).toISOString() : null,
    last: rows.length ? new Date(Math.max(...rows.map(row => +row.last))).toISOString() : null,
  };
}

function measured<T>(value: T | null, label: string): MetricResult<T> {
  return value === null ? { status: "unavailable", reason: `${label} could not be loaded for this period.` } : { status: "available", value };
}

/** Server-only repository. The Analytics route authorizes the request before calling it. */
export async function readAnalytics(period: unknown, now = new Date()): Promise<AnalyticsReport> {
  const window = reportingWindow(period, now);
  const previous = precedingWindow(window);
  const periods = { current: window, previous };
  const connection = connectToDatabase();
  async function read<T>(query: () => PromiseLike<T>) {
    try { await connection; return await query(); } catch { return null; }
  }
  const [signups, reviews, quizzes, subjects, flashcards] = await Promise.all([
    read(() => readSignups(periods)),
    read(async () => (await readReviews(periods))[0] ?? { daily: [], unique: [], returns: [] }),
    read(() => readQuizModes(window, now)),
    read(() => readContent(Subject, periods)),
    read(() => readContent(Flashcard, periods)),
  ]);
  function activation(forWindow: ReportingWindow) {
    const start = forWindow.start.toISOString().slice(0, 10);
    const end = forWindow.end.toISOString().slice(0, 10);
    return (signups ?? []).filter(bucket => bucket._id >= start && bucket._id < end)
      .reduce((total, bucket) => ({ counted: total.counted + bucket.verified, eligible: total.eligible + bucket.eligible }), { counted: 0, eligible: 0 });
  }
  return {
    measuredAt: now.toISOString(), window, previous,
    growth: measured(signups && trend(periods, signups), "User growth"),
    active: measured(reviews && { current: reviews.unique[0]?.current ?? 0, previous: reviews.unique[0]?.previous ?? 0,
      daily: fillDays(window, reviews.daily.map(row => ({ _id: row._id, count: row.active }))) }, "Active learners"),
    activation: measured(signups && { current: activation(window), previous: activation(previous) }, "Account activation"),
    retention: measured(signups && reviews ? retention(periods, signups, reviews.returns) : null, "Learning retention"),
    reviews: measured(reviews && reviewActivity(periods, reviews.daily), "Review activity"),
    quizzes: quizzes ? { status: "partial", value: quizzes, coverage: quizCoverage } : { status: "unavailable", reason: "Quiz modes could not be loaded for this period." },
    subjects: measured(subjects && trend(periods, subjects), "Subject creation"),
    flashcards: measured(flashcards && trend(periods, flashcards), "Flashcard creation"),
  };
}
