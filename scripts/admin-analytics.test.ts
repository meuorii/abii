import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { readAnalytics } from "@/lib/admin/analytics";
import { countChange, rate, type MetricResult } from "@/lib/admin/analytics-contract";
import { dayMs, precedingWindow, reportingWindow } from "@/lib/admin/reporting";

const now = new Date("2026-04-12T06:00:00.000Z");

function value<T>(result: MetricResult<T>) {
  if (result.status === "unavailable") assert.fail(result.reason);
  return result.value;
}

test("UTC windows, adjacent equal periods, and undefined percentages", () => {
  for (const days of [7, 30, 90]) {
    const current = reportingWindow(String(days), now);
    const previous = precedingWindow(current);
    assert.equal(current.days, days);
    assert.equal(current.end.toISOString(), "2026-04-12T00:00:00.000Z");
    assert.equal(+previous.end, +current.start);
    assert.equal(+previous.end - +previous.start, days * dayMs);
  }
  assert.equal(reportingWindow("unknown", now).days, 30);
  assert.equal(countChange({ current: 19, previous: 0 }), null);
  assert.equal(countChange({ current: 3, previous: 4 }), -25);
  assert.equal(rate({ counted: 0, eligible: 0 }), null);
  assert.equal(rate({ counted: 0, eligible: 4 }), 0);
});

test("aggregate evidence, mature retention, protected population, and large-collection index gates", async t => {
  const mongo = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = mongo.getUri("phase_six_analytics_fixture");
    await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false });
    const db = mongoose.connection.db!;
    const id = () => new mongoose.Types.ObjectId();
    const [a, b, recent, legacy, earlier, compareRecent, demo, admin, deleted] = Array.from({ length: 9 }, id);
    const current = reportingWindow("90", now);
    const previous = precedingWindow(current);
    const date = (offset: number, start = current.start) => new Date(+start + dayMs * offset);
    const users = db.collection("users");
    await users.insertMany([
      { _id: a, role: "user", createdAt: date(0.25), emailVerifiedAt: date(1.25), email: "private@example.invalid" },
      { _id: b, role: "user", createdAt: date(1.5), emailVerifiedAt: date(3), suspendedAt: date(10) },
      { _id: recent, role: "user", createdAt: date(89.5), emailVerifiedAt: date(89.6) },
      { _id: legacy, createdAt: date(-1, previous.start) },
      { _id: earlier, createdAt: date(0.25, previous.start), emailVerifiedAt: date(0.5, previous.start) },
      { _id: compareRecent, createdAt: date(89.5, previous.start), emailVerifiedAt: date(0.25) },
      { _id: demo, demoSeedKey: "abii-demo-fixture", role: "user", createdAt: date(0), emailVerifiedAt: date(0) },
      { _id: admin, role: "admin", createdAt: date(0), emailVerifiedAt: date(0) },
      { _id: id(), role: "unknown", createdAt: date(0) },
      { _id: id(), role: "user", createdAt: current.end },
    ]);
    const reviews = db.collection("reviewrecords");
    await reviews.insertMany([
      { userId: a, reviewedAt: date(1.1), result: "correct", privateText: "private prompt" },
      { userId: a, reviewedAt: date(1.2), result: "correct" },
      { userId: a, reviewedAt: date(7.1), result: "wrong" },
      { userId: a, reviewedAt: date(30.1), result: "legacy-outcome" },
      { userId: b, reviewedAt: date(8.1), result: "wrong" },
      { userId: legacy, reviewedAt: date(1.1), result: "correct" },
      { userId: legacy, reviewedAt: date(5, previous.start), result: "correct" },
      { userId: earlier, reviewedAt: date(1, previous.start), result: "wrong" },
      { userId: earlier, reviewedAt: date(7, previous.start), result: "correct" },
      { userId: earlier, reviewedAt: date(30, previous.start), result: "correct" },
      { userId: compareRecent, reviewedAt: date(0.1), result: "correct" },
      { userId: demo, reviewedAt: date(1), result: "correct" },
      { userId: admin, reviewedAt: date(1), result: "correct" },
      { userId: deleted, reviewedAt: date(1), result: "correct" },
      { userId: a, reviewedAt: current.end, result: "correct" },
      ...Array.from({ length: 2500 }, () => ({ userId: a, reviewedAt: date(-1, previous.start) })),
    ]);
    for (const collection of ["subjects", "flashcards"]) {
      await db.collection(collection).insertMany([
        { userId: a, createdAt: date(0), flashcardType: "items", privateText: "private content" },
        { userId: legacy, createdAt: date(4, previous.start) },
        { userId: demo, createdAt: date(1) }, { userId: deleted, createdAt: date(1) },
        { userId: admin, createdAt: date(1) }, { userId: a, createdAt: current.end },
      ]);
    }
    const quizDate = new Date(+now - 8 * 3_600_000);
    const retained = { completedAt: quizDate, expiresAt: new Date(+quizDate + dayMs), status: "completed" };
    await db.collection("quizsessions").insertMany([
      { ...retained, userId: a, type: "random", questions: [{ type: "multiple-choice", prompt: "private quiz" }] },
      { ...retained, userId: a, type: "identification", completedAt: new Date(+quizDate - 3_600_000) },
      { ...retained, userId: b, type: "old-mode" },
      { ...retained, userId: a, type: "true-false", expiresAt: now },
      { ...retained, userId: a, type: "multiple-choice", completedAt: current.end },
      { ...retained, userId: a, type: "multiple-choice", status: "active" },
      { ...retained, userId: demo, type: "multiple-choice" },
      { ...retained, userId: deleted, type: "true-false" },
    ]);
    const report = await readAnalytics("90", now);
    assert.equal(report.measuredAt, now.toISOString());
    assert.equal(value(report.growth).current, 3);
    assert.equal(value(report.growth).previous, 2);
    assert.equal(value(report.growth).daily.length, 90);
    assert.equal(value(report.growth).daily[2].count, 0);
    assert.deepEqual(value(report.activation), { current: { counted: 1, eligible: 2 }, previous: { counted: 1, eligible: 1 } });
    assert.equal(value(report.active).current, 4);
    assert.equal(value(report.active).previous, 2);
    assert.equal(value(report.active).daily[1].count, 2);
    assert.deepEqual(value(report.reviews).current, { attempts: 7, correct: 4, wrong: 2, ungraded: 1 });
    assert.deepEqual(value(report.reviews).previous, { attempts: 4, correct: 3, wrong: 1, ungraded: 0 });
    assert.deepEqual(value(report.retention).current, {
      1: { counted: 1, eligible: 2 }, 7: { counted: 2, eligible: 2 }, 30: { counted: 1, eligible: 2 },
    });
    assert.deepEqual(value(report.retention).previous, {
      1: { counted: 1, eligible: 1 }, 7: { counted: 1, eligible: 1 }, 30: { counted: 1, eligible: 1 },
    });
    assert.equal(value(report.retention).cohorts.length, 13);
    assert.equal(value(report.retention).cohorts.at(-1)?.size, 1);
    assert.equal(value(report.retention).cohorts.at(-1)?.rates[1].eligible, 0);
    assert.equal(value((await readAnalytics("7", now)).retention).current[30].eligible, 0);
    assert.equal(report.quizzes.status, "partial");
    assert.deepEqual(value(report.quizzes).modes, { "multiple-choice": 0, identification: 1, "true-false": 0, random: 1 });
    assert.equal(value(report.quizzes).unknown, 1);
    assert.equal(value(report.quizzes).last, quizDate.toISOString());
    for (const result of [report.subjects, report.flashcards]) {
      assert.equal(value(result).current, 1);
      assert.equal(value(result).previous, 1);
    }
    assert.doesNotMatch(JSON.stringify(report), /private|abii-demo-fixture/);

    const reviewMatch = { reviewedAt: { $gte: previous.start, $lt: current.end } };
    const unindexed = await reviews.find(reviewMatch).explain("executionStats");
    await reviews.createIndex({ reviewedAt: 1, userId: 1 });
    const indexed = await reviews.find(reviewMatch).hint({ reviewedAt: 1, userId: 1 }).explain("executionStats");
    assert.equal(indexed.executionStats.nReturned, unindexed.executionStats.nReturned);
    assert.ok(indexed.executionStats.totalDocsExamined < unindexed.executionStats.totalDocsExamined);
    t.diagnostic(`Review range documents examined ${unindexed.executionStats.totalDocsExamined} before and ${indexed.executionStats.totalDocsExamined} after indexing.`);

    const subjects = db.collection("subjects");
    for (let batch = 0; batch < 10; batch++) {
      await subjects.insertMany(Array.from({ length: 5000 }, () => ({ userId: a, createdAt: date(-1, previous.start) })));
    }
    const partial = await readAnalytics("90", now);
    assert.equal(partial.subjects.status, "unavailable");
    assert.equal(value(partial.flashcards).current, 1);
    await subjects.createIndex({ createdAt: 1, userId: 1 });
    assert.equal(value((await readAnalytics("90", now)).subjects).current, 1);

    const empty = await readAnalytics("30", new Date("2025-01-01T00:00:00Z"));
    assert.equal(value(empty.growth).current, 0);
    assert.ok(value(empty.reviews).daily.every(point => point.attempts === 0));
    assert.equal(value(empty.quizzes).first, null);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
