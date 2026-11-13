import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { loadProgressReviewActivity, loadProgressSessionAnalytics } from "../lib/progress/analytics";
import { studyDayKey } from "../lib/badges/study-day";
import { getSubjectMastery } from "../lib/quiz/service";
import { QuizSession } from "../models/QuizSession";
import { ReviewRecord } from "../models/ReviewRecord";
import { Flashcard } from "../models/Flashcard";
import { Subject } from "../models/Subject";

test("Progress analytics match legacy current-card, retained-session, and timezone semantics", { timeout: 60000 }, async () => {
  const server = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = server.getUri("abii_progress_analytics_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const owner = new Types.ObjectId("000000000000000000000101");
    const otherOwner = new Types.ObjectId("000000000000000000000102");
    const firstCard = new Types.ObjectId("000000000000000000000201");
    const secondCard = new Types.ObjectId("000000000000000000000202");
    const deletedCard = new Types.ObjectId("000000000000000000000203");
    const timezone = "Asia/Manila";
    const todayKey = "2025-03-10";
    await mongoose.connection.db!.collection("users").insertMany([{ _id: owner, name: "Owner" }, { _id: otherOwner, name: "Other" }]);
    const subject = await Subject.create({ _id: new Types.ObjectId("000000000000000000000401"), userId: owner, name: "Owned subject" });
    await Flashcard.create([
      { _id: firstCard, userId: owner, subjectId: subject._id, question: "First question", answer: "First answer" },
      { _id: secondCard, userId: owner, subjectId: subject._id, question: "Second question", answer: "Second answer" },
    ]);
    await mongoose.connection.db!.collection("reviewrecords").insertMany([
      { userId: owner, flashcardId: firstCard, result: "correct", questionType: "identification", reviewedAt: new Date("2024-12-01T12:00:00Z") },
      { userId: owner, flashcardId: firstCard, result: "wrong", questionType: "multiple-choice", reviewedAt: new Date("2025-03-08T16:00:00Z") },
      { userId: owner, flashcardId: firstCard, result: "correct", questionType: "random", reviewedAt: new Date("2025-03-09T15:59:00Z") },
      { userId: owner, flashcardId: secondCard, result: "wrong", questionType: "true-false", reviewedAt: new Date("2025-03-09T16:00:00Z") },
      { userId: owner, flashcardId: deletedCard, result: "correct", questionType: "identification", reviewedAt: new Date("2025-03-10T00:00:00Z") },
      { userId: otherOwner, flashcardId: firstCard, result: "wrong", questionType: "identification", reviewedAt: new Date("2025-03-10T01:00:00Z") },
    ]);
    const sessionDocs = [
      { _id: new Types.ObjectId("000000000000000000000301"), userId: owner, subjectName: "Legacy", type: "identification", status: "completed", createdAt: new Date("2025-03-10T02:00:00Z"), expiresAt: new Date("2026-01-01T00:00:00Z"), questions: [{ answered: true, correct: true }, { answered: true, correct: false }, { answered: false }] },
      { _id: new Types.ObjectId("000000000000000000000302"), userId: owner, subjectName: "Today", type: "multiple-choice", status: "completed", completedAt: new Date("2025-03-09T16:00:00Z"), createdAt: new Date("2025-03-09T15:00:00Z"), expiresAt: new Date("2026-01-01T00:00:00Z"), questions: [{ answered: true, correct: true, round: 1 }, { answered: true, correct: true, round: 2 }, { answered: false }] },
      { _id: new Types.ObjectId("000000000000000000000303"), userId: owner, subjectName: "Earlier", type: "true-false", status: "completed", completedAt: new Date("2024-12-01T00:00:00Z"), createdAt: new Date("2024-12-01T00:00:00Z"), expiresAt: new Date("2026-01-01T00:00:00Z"), questions: [] },
      { _id: new Types.ObjectId("000000000000000000000304"), userId: owner, subjectName: "Active", type: "random", status: "active", createdAt: new Date("2025-03-10T03:00:00Z"), expiresAt: new Date("2026-01-01T00:00:00Z"), questions: [{ answered: true, correct: true }] },
      { _id: new Types.ObjectId("000000000000000000000305"), userId: otherOwner, subjectName: "Private", type: "random", status: "completed", completedAt: new Date("2025-03-10T03:00:00Z"), createdAt: new Date("2025-03-10T03:00:00Z"), expiresAt: new Date("2026-01-01T00:00:00Z"), questions: [{ answered: true, correct: true }] },
    ];
    await mongoose.connection.db!.collection("quizsessions").insertMany(sessionDocs);

    const currentCards = [{ id: String(firstCard) }, { id: String(secondCard) }];
    const mastery = await getSubjectMastery(owner, undefined, { includeHistory: false, studyTimezone: timezone });
    const [reviewActivity, actual] = await Promise.all([
      loadProgressReviewActivity(owner, currentCards.map((card) => card.id), timezone, todayKey),
      loadProgressSessionAnalytics(owner, timezone, todayKey),
    ]);
    const legacyReviews = await ReviewRecord.find({ userId: owner, flashcardId: { $in: currentCards.map((card) => new Types.ObjectId(card.id)) } }).select("flashcardId result reviewedAt").sort({ reviewedAt: -1, _id: -1 }).lean();
    const legacySessions = await QuizSession.find({ userId: owner, status: "completed" }).select("_id subjectName type questions completedAt createdAt").lean();
    const cardStats = new Map<string, { total: number; correct: number; wrong: number; latestAt: Date; latestId: string }>();
    for (const row of legacyReviews) {
      const id = String(row.flashcardId);
      const stats = cardStats.get(id) ?? { total: 0, correct: 0, wrong: 0, latestAt: new Date(row.reviewedAt), latestId: String(row._id) };
      stats.total += 1;
      if (row.result === "correct") stats.correct += 1;
      else stats.wrong += 1;
      cardStats.set(id, stats);
    }
    const start = new Date("2024-12-11T16:00:00Z");
    const end = new Date("2025-03-11T16:00:00Z");
    const legacyDays = [...new Set(legacyReviews.map((row) => studyDayKey(new Date(row.reviewedAt), timezone)))].sort();
    const legacyActivity = new Map<string, number>();
    for (const row of legacyReviews) {
      const at = new Date(row.reviewedAt);
      if (at >= start && at < end) {
        const key = studyDayKey(at, timezone);
        legacyActivity.set(key, (legacyActivity.get(key) ?? 0) + 1);
      }
    }
    const expectedSessions = legacySessions.map((session) => {
      const answered = (session.questions ?? []).filter((question) => question.answered);
      const correct = answered.filter((question) => question.correct).length;
      const date = session.completedAt ? new Date(session.completedAt) : new Date(session.createdAt);
      return { id: String(session._id), subject: session.subjectName, quizType: session.type, date, answered: answered.length, correct };
    }).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

    assert.equal(mastery.reviewHistory.length, 0, "Progress must use compact mastery rather than return review history");
    assert.deepEqual([...mastery.reviewStatsByCard].map(([id, item]) => ({ id, total: item.total, correct: item.correct, wrong: item.wrong, latestAt: item.latestReviewedAt?.toISOString(), latestId: item.latestReviewId })).sort((a, b) => a.id.localeCompare(b.id)), [...cardStats].map(([id, item]) => ({ id, total: item.total, correct: item.correct, wrong: item.wrong, latestAt: item.latestAt.toISOString(), latestId: item.latestId })).sort((a, b) => a.id.localeCompare(b.id)));
    assert.equal([...mastery.reviewStatsByCard.values()].reduce((sum, item) => sum + item.total, 0), legacyReviews.length);
    assert.equal([...mastery.reviewStatsByCard.values()].reduce((sum, item) => sum + item.correct, 0), legacyReviews.filter((row) => row.result === "correct").length);
    assert.deepEqual([...mastery.reviewDays].sort(), legacyDays);
    assert.deepEqual(reviewActivity, [...legacyActivity].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)));
    assert.equal(actual.sessionCount, legacySessions.length);
    assert.deepEqual(actual.sessionActivity, [{ date: "2025-03-10", count: 1 }]);
    assert.deepEqual(actual.recentSessions.map((item) => ({ id: item.id, subject: item.subject, quizType: item.quizType, date: item.date.toISOString(), answered: item.answered, correct: item.correct })), expectedSessions.map((item) => ({ ...item, date: item.date.toISOString() })));
  } finally {
    await mongoose.disconnect();
    await server.stop();
    delete process.env.MONGODB_URI;
  }
});
