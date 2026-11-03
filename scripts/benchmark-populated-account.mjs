import nextEnv from "@next/env";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];
const report = (label, values) => process.stdout.write(`${label}: p50=${percentile(values, .5).toFixed(1)}ms p95=${percentile(values, .95).toFixed(1)}ms n=${values.length}\n`);

try {
  await client.connect();
  const db = client.db();
  const topology = await db.admin().command({ hello: 1 });
  const topologyName = topology.setName ? "replica set" : topology.msg === "isdbgrid" ? "sharded cluster" : "standalone";
  process.stdout.write(`MongoDB topology: ${topologyName}; version=${topology.version ?? "unknown"}\n`);
  const reviewCollection = db.collection("reviewrecords");
  const sample = await reviewCollection.aggregate([
    { $group: { _id: "$userId", reviewCount: { $sum: 1 } } },
    { $sort: { reviewCount: -1 } },
    { $limit: 1 },
  ], { maxTimeMS: 30000 }).next();
  if (!sample?._id) {
    process.stdout.write("No populated account with ReviewRecords is available.\n");
    process.exitCode = 2;
  } else {
    const owner = sample._id;
    const [cardCount, sessionCount] = await Promise.all([
      db.collection("flashcards").countDocuments({ userId: owner }),
      db.collection("quizsessions").countDocuments({ userId: owner }),
    ]);
    process.stdout.write(`Sample size only: reviews=${sample.reviewCount} cards=${cardCount} sessions=${sessionCount}\n`);
    const modeSample = await reviewCollection.aggregate([
      { $match: { userId: owner } },
      { $group: { _id: "$questionType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]).next();
    const mode = modeSample?._id ?? "identification";
    const streakPipeline = [
      { $match: { userId: owner, questionType: mode } },
      { $group: { _id: "$flashcardId", results: { $topN: { n: 3, sortBy: { reviewedAt: -1, _id: -1 }, output: "$result" } } } },
    ];
    const explain = await db.command({
      explain: { aggregate: "reviewrecords", pipeline: streakPipeline, cursor: {} },
      verbosity: "executionStats",
    });
    const stats = explain.executionStats ?? explain.stages?.at(-1)?.$cursor?.executionStats;
    process.stdout.write(`Populated streak query ($topN retains at most 3 results per card): docsExamined=${stats?.totalDocsExamined ?? "n/a"} keysExamined=${stats?.totalKeysExamined ?? "n/a"} returned=${stats?.nReturned ?? "n/a"}\n`);

    const cardIds = await db.collection("flashcards").distinct("_id", { userId: owner });
    const masteryMatch = { $match: { userId: owner, flashcardId: { $in: cardIds } } };
    const compactPipeline = [
      masteryMatch,
      { $group: { _id: { cardId: "$flashcardId", mode: "$questionType" }, correct: { $sum: { $cond: [{ $eq: ["$result", "correct"] }, 1, 0] } }, incorrect: { $sum: { $cond: [{ $eq: ["$result", "wrong"] }, 1, 0] } }, recent: { $topN: { n: 3, sortBy: { reviewedAt: -1, _id: -1 }, output: { _id: "$_id", result: "$result", reviewedAt: "$reviewedAt", nextReviewAt: "$nextReviewAt", questionType: "$questionType" } } } } },
    ];
    const compactExplain = await db.command({ explain: { aggregate: "reviewrecords", pipeline: compactPipeline, cursor: {} }, verbosity: "executionStats" });
    const compactStats = compactExplain.executionStats ?? compactExplain.stages?.at(-1)?.$cursor?.executionStats;
    process.stdout.write(`Compact mastery aggregation: docsExamined=${compactStats?.totalDocsExamined ?? "n/a"} keysExamined=${compactStats?.totalKeysExamined ?? "n/a"} documentsReturned=${compactStats?.nReturned ?? "n/a"}\n`);

    await client.close();
    // Load the actual application services only after the driver has selected the sample owner.
    const { connectToDatabase } = await import("../lib/mongodb.ts");
    const { computeStreaks, getSubjectMastery } = await import("../lib/quiz/service.ts");
    const { reconcileUserBadges } = await import("../lib/badges/reconcile.ts");
    await connectToDatabase();
    const streakTimes = [];
    const masteryTimes = [];
    const compactMasteryTimes = [];
    const fullPayloadBytes = [];
    const compactPayloadBytes = [];
    const badgeTimes = [];
    for (let i = 0; i < 7; i++) {
      let start = performance.now();
      await computeStreaks(owner, undefined, mode);
      streakTimes.push(performance.now() - start);
      start = performance.now();
      const full = await getSubjectMastery(owner);
      masteryTimes.push(performance.now() - start);
      start = performance.now();
      const compact = await getSubjectMastery(owner, undefined, { includeHistory: false });
      compactMasteryTimes.push(performance.now() - start);
      const { reviewHistory: fullHistory, ...fullSummary } = full;
      const { reviewHistory: compactHistory, ...compactSummary } = compact;
      fullPayloadBytes.push(Buffer.byteLength(JSON.stringify({ summary: fullSummary, reviewHistory: fullHistory })));
      compactPayloadBytes.push(Buffer.byteLength(JSON.stringify({ summary: compactSummary, reviewHistory: compactHistory })));
      start = performance.now();
      await reconcileUserBadges(String(owner), { dryRun: true, force: true });
      badgeTimes.push(performance.now() - start);
    }
    report("computeStreaks", streakTimes);
    report("computeSubjectMastery", masteryTimes);
    report("dashboard compact mastery", compactMasteryTimes);
    process.stdout.write(`Service result bytes (median): full=${percentile(fullPayloadBytes, .5)} compact=${percentile(compactPayloadBytes, .5)}\n`);
    report("badge reconciliation dry-run", badgeTimes);
  }
} finally {
  await client.close();
  await mongoose.disconnect();
}
