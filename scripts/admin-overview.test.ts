import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { readOverview, reportingWindow } from "@/lib/admin/overview";
import { User } from "@/models/User";
import { ReviewRecord } from "@/models/ReviewRecord";
import { AchievementEvent } from "@/models/AchievementEvent";

const now = new Date("2026-11-22T03:00:00Z");
const start = new Date("2026-11-15T00:00:00Z");
const end = new Date("2026-11-22T00:00:00Z");

test("reporting windows use complete UTC days and default to 30", () => {
  assert.deepEqual(reportingWindow("7", now), { days: 7, start, end });
  assert.equal(reportingWindow(["7", "90"], now).days, 30);
  assert.equal(reportingWindow("90", now).start.toISOString(), "2026-08-24T00:00:00.000Z");
});

test("Overview aggregates retained accounts, reviews, quiz evidence and redacted security context", async t => {
  const mongo = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = mongo.getUri("overview_fixture");
    await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false });
    const db = mongoose.connection.db!;
    const ids = Array.from({ length: 9 }, () => new mongoose.Types.ObjectId());
    const [learner, suspended, legacy, excluded, deleted, quiz, expired, recovered, companion] = ids;
    const users = db.collection("users");
    await users.insertMany([
      { _id: learner, name: "Current", email: "private@example.invalid", passwordHash: "private", role: "user", createdAt: start, emailVerifiedAt: now },
      { _id: suspended, name: "Suspended", role: "user", createdAt: new Date(+end - 1), suspendedAt: now },
      { _id: legacy, name: "Legacy", createdAt: end },
      { _id: excluded, name: "Excluded", role: "admin", createdAt: start },
    ]);
    await db.collection("flashcards").insertMany([{ flashcardType: "standard" }, { flashcardType: "enumeration" }]);
    await db.collection("reviewrecords").insertMany([
      { userId: learner, reviewedAt: start }, { userId: learner, reviewedAt: new Date("2026-11-19") },
      { userId: learner, reviewedAt: new Date("2026-11-19") }, { userId: suspended, reviewedAt: new Date(+end - 1) },
      { userId: deleted, reviewedAt: start }, { userId: excluded, reviewedAt: start }, { userId: legacy, reviewedAt: end },
      { userId: legacy, reviewedAt: new Date(+start - 1) },
    ]);
    await db.collection("achievementevents").insertMany([
      { userId: learner, kind: "quiz-completed", idempotencyKey: "quiz-completed:" + quiz, occurredAt: start },
      { userId: learner, kind: "quiz-completed", sessionId: quiz, idempotencyKey: "alternate", occurredAt: start },
      { userId: learner, kind: "resumed-quiz-completed", sessionId: quiz, occurredAt: start },
      { userId: learner, kind: "resumed-quiz-completed", sessionId: companion, occurredAt: start },
      { userId: deleted, kind: "quiz-completed", sessionId: recovered, occurredAt: start },
      { userId: learner, kind: "quiz-completed", idempotencyKey: "quiz-completed:" + new mongoose.Types.ObjectId(), occurredAt: start },
    ]);
    await db.collection("quizsessions").insertMany([
      { _id: quiz, userId: learner, status: "completed", completedAt: start, expiresAt: new Date(+now + 60_000) },
      { _id: recovered, userId: suspended, status: "completed", completedAt: new Date(+end - 1), expiresAt: new Date(+now + 60_000) },
      { _id: expired, userId: learner, status: "completed", completedAt: start, expiresAt: start },
    ]);
    await db.collection("adminsecurityevents").insertMany([
      { kind: "login-denied", occurredAt: start, actorId: "private" },
      { kind: "login", occurredAt: new Date(+end - 1) },
    ]);
    const began = performance.now();
    const report = await readOverview("7", now);
    t.diagnostic(`Small fixture Overview read took ${Math.round(performance.now() - began)}ms.`);
    assert.equal(report.totalUsers, 3);
    assert.equal(report.totalFlashcards, 2);
    assert.equal(report.growth?.reduce((sum, point) => sum + point.count, 0), 2);
    assert.equal(report.reviews?.active, 2);
    assert.deepEqual(report.reviews?.series.map(point => point.count), [1, 0, 0, 0, 2, 0, 1]);
    assert.equal(report.completedQuizzes, 3);
    assert.deepEqual(report.recent?.map(row => [row.name, row.status]), [["Legacy", "Unverified"], ["Suspended", "Suspended"], ["Current", "Verified"]]);
    assert.equal(report.attention?.kind, "login-denied");
    assert.doesNotMatch(JSON.stringify(report), /private|passwordHash|Excluded/);
    const longer = await readOverview("30", now);
    assert.equal(longer.totalUsers, report.totalUsers);
    assert.equal(longer.reviews?.active, 3);
    assert.equal(longer.growth?.length, 30);

    const failure = test.mock.method(User, "countDocuments", () => { throw Error("private database failure"); });
    try {
      const partial = await readOverview("7", now);
      assert.equal(partial.totalUsers, null);
      assert.equal(partial.completedQuizzes, 3);
    } finally { failure.mock.restore(); }

    const reviews = db.collection("reviewrecords");
    await reviews.insertMany(Array.from({ length: 2_500 }, () => ({ userId: learner, reviewedAt: new Date(+start - 1) })));
    const criterion = { reviewedAt: { $gte: start, $lt: end }, userId: { $type: "objectId" } };
    const scan = await reviews.find(criterion).project({ _id: 0, reviewedAt: 1, userId: 1 }).explain("executionStats");
    const estimated = t.mock.method(ReviewRecord, "estimatedDocumentCount", () => ({ maxTimeMS: async () => 50_001 }));
    try {
      assert.equal((await readOverview("7", now)).reviews, null);
      await reviews.createIndex({ reviewedAt: 1, userId: 1 });
      assert.equal((await readOverview("7", now)).reviews?.active, 2);
    } finally { estimated.mock.restore(); }
    const indexed = await reviews.find(criterion).project({ _id: 0, reviewedAt: 1, userId: 1 })
      .hint({ reviewedAt: 1, userId: 1 }).explain("executionStats");
    assert.equal(indexed.executionStats.nReturned, scan.executionStats.nReturned);
    assert.ok(indexed.executionStats.totalKeysExamined < scan.executionStats.totalDocsExamined / 10);
    t.diagnostic(`Review range plan examined ${scan.executionStats.totalDocsExamined} documents without the candidate index and ${indexed.executionStats.totalKeysExamined} keys with it.`);

    const estimatedEvents = t.mock.method(AchievementEvent, "estimatedDocumentCount", () => ({ maxTimeMS: async () => 50_001 }));
    try {
      assert.equal((await readOverview("7", now)).completedQuizzes, null);
      await db.collection("achievementevents").createIndex({ kind: 1, occurredAt: 1, userId: 1 });
      assert.equal((await readOverview("7", now)).completedQuizzes, 3);
    } finally { estimatedEvents.mock.restore(); }

    await Promise.all(["users", "flashcards", "reviewrecords", "achievementevents", "quizsessions", "adminsecurityevents"].map(name => db.collection(name).deleteMany({})));
    const empty = await readOverview("7", now);
    assert.equal(empty.totalUsers, 0);
    assert.equal(empty.reviews?.active, 0);
    assert.equal(empty.completedQuizzes, 0);
    assert.deepEqual(empty.recent, []);
    assert.equal(empty.attention, null);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
