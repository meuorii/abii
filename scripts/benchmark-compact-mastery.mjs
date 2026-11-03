import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectToDatabase } from "../lib/mongodb.ts";
import { getSubjectMastery } from "../lib/quiz/service.ts";
import { Flashcard } from "../models/Flashcard.ts";
import { ReviewRecord } from "../models/ReviewRecord.ts";
import { Subject } from "../models/Subject.ts";
import { Topic } from "../models/Topic.ts";

const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];
const report = (label, values) => process.stdout.write(`${label}: p50=${percentile(values, .5).toFixed(1)}ms p95=${percentile(values, .95).toFixed(1)}ms n=${values.length}\n`);
const server = await MongoMemoryServer.create();
try {
  process.env.MONGODB_URI = server.getUri("abii_compact_mastery_bench");
  await mongoose.connect(process.env.MONGODB_URI);
  const owner = new Types.ObjectId();
  await mongoose.connection.db.collection("users").insertOne({ _id: owner, name: "Benchmark fixture" });
  const subject = await Subject.create({ userId: owner, name: "Benchmark" });
  const topic = await Topic.create({ userId: owner, subjectId: subject._id, name: "Dense history" });
  const cards = await Flashcard.create(Array.from({ length: 80 }, (_, i) => ({ userId: owner, subjectId: subject._id, topicId: topic._id, flashcardType: i % 5 === 0 ? "items" : "standard", question: `Prompt ${i}`, answer: i % 5 === 0 ? "one\ntwo" : "answer" })));
  const modes = ["identification", "multiple-choice", "true-false", "random"];
  const baseTime = Date.UTC(2025, 0, 1);
  const reviewCount = 80000;
  for (let offset = 0; offset < reviewCount; offset += 1000) {
    const batch = Array.from({ length: Math.min(1000, reviewCount - offset) }, (_, local) => {
      const i = offset + local;
      const cardIndex = i % cards.length;
      const mode = modes[Math.floor(i / cards.length) % modes.length];
      const reviewedAt = new Date(baseTime + Math.floor(i / 240) * 86_400_000 + (i % 240) * 1000);
      return { userId: owner, flashcardId: cards[cardIndex]._id, questionType: mode, result: i % 13 === 0 ? "wrong" : "correct", reviewedAt, nextReviewAt: new Date(baseTime + (i % 2 ? 2 : -2) * 86_400_000) };
    });
    await ReviewRecord.insertMany(batch, { ordered: false });
  }
  await connectToDatabase();
  const filter = { userId: owner, flashcardId: { $in: cards.map((card) => card._id) } };
  const compactPipeline = [
    { $match: filter },
    { $group: { _id: { cardId: "$flashcardId", mode: "$questionType" }, correct: { $sum: { $cond: [{ $eq: ["$result", "correct"] }, 1, 0] } }, incorrect: { $sum: { $cond: [{ $eq: ["$result", "wrong"] }, 1, 0] } }, recent: { $topN: { n: 3, sortBy: { reviewedAt: -1, _id: -1 }, output: { _id: "$_id", result: "$result", reviewedAt: "$reviewedAt", nextReviewAt: "$nextReviewAt", questionType: "$questionType" } } } } },
  ];
  const db = mongoose.connection.db;
  const [fullExplain, compactExplain, fullRows, compactRows, dayRows] = await Promise.all([
    db.command({ explain: { find: "reviewrecords", filter, projection: { flashcardId: 1, result: 1, reviewedAt: 1, nextReviewAt: 1, questionType: 1 } }, verbosity: "executionStats" }),
    db.command({ explain: { aggregate: "reviewrecords", pipeline: compactPipeline, cursor: {} }, verbosity: "executionStats" }),
    ReviewRecord.find(filter).select("flashcardId result reviewedAt nextReviewAt questionType").lean(),
    ReviewRecord.aggregate(compactPipeline),
    ReviewRecord.aggregate([{ $match: filter }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$reviewedAt", timezone: "UTC" } } } }, { $project: { _id: 0, day: "$_id" } }]),
  ]);
  const fullStats = fullExplain.executionStats;
  const compactStats = compactExplain.executionStats ?? compactExplain.stages?.at(-1)?.$cursor?.executionStats;
  const compactBytes = Buffer.byteLength(JSON.stringify(compactRows)) + Buffer.byteLength(JSON.stringify(dayRows));
  const fullBytes = Buffer.byteLength(JSON.stringify(fullRows));
  process.stdout.write(`Fixture: ${cards.length} cards, ${reviewCount} reviews, ${modes.length} modes\n`);
  process.stdout.write(`Full find: exec=${fullStats.executionTimeMillis}ms docsExamined=${fullStats.totalDocsExamined} docsReturned=${fullStats.nReturned} JSON bytes=${fullBytes}\n`);
  process.stdout.write(`Compact aggregate: exec=${compactStats?.executionTimeMillis ?? "n/a"}ms docsExamined=${compactStats?.totalDocsExamined ?? "n/a"} docsReturned=${compactStats?.nReturned ?? compactRows.length} JSON bytes=${compactBytes}\n`);
  const fullTimes = [];
  const compactTimes = [];
  let fullResult;
  let compactResult;
  for (let i = 0; i < 20; i += 1) {
    let started = performance.now();
    fullResult = await getSubjectMastery(owner);
    fullTimes.push(performance.now() - started);
    started = performance.now();
    compactResult = await getSubjectMastery(owner, undefined, { includeHistory: false });
    compactTimes.push(performance.now() - started);
  }
  assert.equal(fullResult.overall.correct, compactResult.overall.correct);
  assert.equal(fullResult.overall.incorrect, compactResult.overall.incorrect);
  assert.deepEqual([...fullResult.reviewDays].sort(), [...compactResult.reviewDays].sort());
  report("full service mastery", fullTimes);
  report("compact dashboard mastery", compactTimes);
} finally {
  await mongoose.disconnect();
  await server.stop();
  delete process.env.MONGODB_URI;
}
