import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectToDatabase } from "../lib/mongodb";
import { evaluateUserReminders, runReminderBatch } from "../lib/notifications/reminders";
import { Flashcard } from "../models/Flashcard";
import { AchievementEvent } from "../models/AchievementEvent";
import { Notification } from "../models/Notification";
import { NotificationScheduleState } from "../models/NotificationScheduleState";
import { QuizSession } from "../models/QuizSession";
import { ReviewRecord } from "../models/ReviewRecord";
import { Subject } from "../models/Subject";
import { User } from "../models/User";

test("due reminder counts only cards whose latest persisted review is due and is idempotent", { timeout: 60000 }, async () => {
  const server = await MongoMemoryServer.create();
  const previousUri = process.env.MONGODB_URI;
  try {
    process.env.MONGODB_URI = server.getUri("abii_notification_reminders_test");
    await connectToDatabase();
    // Subject's existing schema declares the same single-field index both inline and named;
    // this test does not depend on that unrelated index, so sync only tested persistence models.
    await Promise.all([User.syncIndexes(), Flashcard.syncIndexes(), ReviewRecord.syncIndexes(), Notification.syncIndexes()]);
    const user = await User.create({ name: "Reminder", email: "reminder@example.invalid", passwordHash: "hash", settings: { studyTimezone: "UTC", notifications: { flashcards_due: true, study_streak: false, unfinished_quiz: false, daily_study_reminder: false, weekly_progress: false, study_inactivity: false } } });
    const subject = await Subject.create({ userId: user._id, name: "Biology" });
    const dueCard = await Flashcard.create({ userId: user._id, subjectId: subject._id, question: "Q1", answer: "A1" });
    const futureCard = await Flashcard.create({ userId: user._id, subjectId: subject._id, question: "Q2", answer: "A2" });
    const now = new Date("2026-11-14T12:00:00.000Z");
    await ReviewRecord.create({ userId: user._id, flashcardId: futureCard._id, result: "wrong", questionType: "identification", reviewedAt: new Date(now.getTime() - 2 * 86_400_000), nextReviewAt: new Date(now.getTime() - 86_400_000) });
    await ReviewRecord.create({ userId: user._id, flashcardId: futureCard._id, result: "correct", questionType: "identification", reviewedAt: new Date(now.getTime() - 86_400_000), nextReviewAt: new Date(now.getTime() + 86_400_000) });

    await evaluateUserReminders(String(user._id), now);
    await evaluateUserReminders(String(user._id), new Date(now.getTime() + 60_000));
    const rows = await Notification.find({ userId: user._id, type: "flashcards_due" }).lean();
    assert.equal(rows.length, 1);
    assert.match(rows[0].message, /1 flashcard/);
    assert.equal(rows[0].target, "/review");
    assert.equal(rows[0].expiresAt?.toISOString(), "2026-12-14T00:00:00.000Z");
    assert.ok(dueCard._id);

    const streakUser = await User.create({ name: "Streak", email: "streak@example.invalid", passwordHash: "hash", settings: { studyTimezone: "Asia/Manila", dailyStudyTime: "20:00", notifications: { flashcards_due: true, study_streak: true, unfinished_quiz: true, daily_study_reminder: true, weekly_progress: true, study_inactivity: false } } });
    for (const [dayKey, occurredAt] of [
      ["2026-11-11", "2026-11-10T16:00:00.000Z"],
      ["2026-11-12", "2026-11-11T16:00:00.000Z"],
      ["2026-11-13", "2026-11-12T16:00:00.000Z"],
    ] as const) await AchievementEvent.create({ userId: streakUser._id, idempotencyKey: `study-day:${dayKey}`, kind: "study-day", occurredAt: new Date(occurredAt), dayKey });
    const staleSession = await QuizSession.create({ userId: streakUser._id, subjectName: "Biology", type: "multiple-choice", status: "active", lastActivityAt: new Date(now.getTime() - 25 * 60 * 60_000), expiresAt: new Date(now.getTime() + 86_400_000), questions: [{ flashcardId: dueCard._id, prompt: "Private question text", expectedAnswer: "Private answer", answered: false }] });
    const atEvening = new Date("2026-11-14T12:00:00.000Z");
    await evaluateUserReminders(String(streakUser._id), atEvening);
    const streakRows = await Notification.find({ userId: streakUser._id }).sort({ type: 1 }).lean();
    assert.deepEqual(streakRows.map((row) => row.type).sort(), ["study_streak", "unfinished_quiz"]);
    assert.equal(streakRows.find((row) => row.type === "study_streak")?.metadata.count, 3);
    assert.equal(streakRows.find((row) => row.type === "unfinished_quiz")?.metadata.sessionId, String(staleSession._id));
    assert.ok(streakRows.every((row) => row.target === "/review"));
    await evaluateUserReminders(String(streakUser._id), new Date(atEvening.getTime() + 60_000));
    assert.equal(await Notification.countDocuments({ userId: streakUser._id, type: { $in: ["study_streak", "unfinished_quiz"] } }), 2);

    const dailyUser = await User.create({ name: "Daily", email: "daily@example.invalid", passwordHash: "hash", settings: { studyTimezone: "Asia/Manila", dailyStudyTime: "20:00", notifications: { flashcards_due: false, study_streak: false, unfinished_quiz: false, daily_study_reminder: true, weekly_progress: false, study_inactivity: false } } });
    await evaluateUserReminders(String(dailyUser._id), atEvening);
    await evaluateUserReminders(String(dailyUser._id), new Date(atEvening.getTime() + 60_000));
    const daily = await Notification.find({ userId: dailyUser._id, type: "daily_study_reminder" }).lean();
    assert.equal(daily.length, 1);
    assert.equal(daily[0].dedupeKey, "daily-study:2026-11-14");
    assert.equal(daily[0].expiresAt?.toISOString(), "2026-12-13T16:00:00.000Z");

    const weeklyUser = await User.create({ name: "Weekly", email: "weekly@example.invalid", passwordHash: "hash", settings: { studyTimezone: "Asia/Manila", notifications: { weekly_progress: true, flashcards_due: false, study_streak: false, unfinished_quiz: false, daily_study_reminder: false, study_inactivity: false } } });
    await AchievementEvent.create({ userId: weeklyUser._id, idempotencyKey: "study-day:2026-11-10", kind: "study-day", occurredAt: new Date("2026-11-10T02:00:00Z"), dayKey: "2026-11-10" });
    await AchievementEvent.create({ userId: weeklyUser._id, idempotencyKey: "quiz-completed:week-one", kind: "quiz-completed", occurredAt: new Date("2026-11-12T02:00:00Z"), dayKey: "2026-11-12" });
    const mondayMorning = new Date("2026-11-16T00:00:00Z");
    await evaluateUserReminders(String(weeklyUser._id), mondayMorning);
    const weekly = await Notification.findOne({ userId: weeklyUser._id, type: "weekly_progress" }).lean();
    assert.equal(weekly?.dedupeKey, "weekly-progress:2026-11-09");
    assert.match(weekly?.message ?? "", /2 days and completed 1 quiz/);

    const inactiveUser = await User.create({ name: "Inactive", email: "inactive@example.invalid", passwordHash: "hash", settings: { studyTimezone: "Asia/Manila", notifications: { flashcards_due: true, study_streak: false, unfinished_quiz: false, daily_study_reminder: false, weekly_progress: false, study_inactivity: true } } });
    await AchievementEvent.create({ userId: inactiveUser._id, idempotencyKey: "study-day:2026-11-12", kind: "study-day", occurredAt: new Date("2026-11-11T16:00:00Z"), dayKey: "2026-11-12" });
    const inactiveSubject = await Subject.create({ userId: inactiveUser._id, name: "Chemistry" });
    await Flashcard.create({ userId: inactiveUser._id, subjectId: inactiveSubject._id, question: "Q3", answer: "A3" });
    await evaluateUserReminders(String(inactiveUser._id), new Date("2026-11-16T02:00:00Z"));
    const inactiveRows = await Notification.find({ userId: inactiveUser._id }).lean();
    assert.deepEqual(inactiveRows.map((row) => row.type), ["study_inactivity"]);
  } finally {
    await mongoose.disconnect();
    if (global.mongooseCache) { global.mongooseCache.conn = null; global.mongooseCache.promise = null; }
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    await server.stop();
  }
});

test("scheduled batch advances a durable cursor, bounds work, and skips unverified accounts", { timeout: 60000 }, async () => {
  const server = await MongoMemoryServer.create();
  const previousUri = process.env.MONGODB_URI;
  try {
    process.env.MONGODB_URI = server.getUri("abii_notification_reminder_batch_test");
    await connectToDatabase();
    await Promise.all([User.syncIndexes(), NotificationScheduleState.syncIndexes()]);
    const verifiedAt = new Date("2026-11-01T00:00:00Z");
    await User.create({ name: "First", email: "first-batch@example.invalid", passwordHash: "hash", emailVerifiedAt: verifiedAt });
    await User.create({ name: "Second", email: "second-batch@example.invalid", passwordHash: "hash", emailVerifiedAt: verifiedAt });
    await User.create({ name: "Unverified", email: "unverified-batch@example.invalid", passwordHash: "hash" });
    await User.create({ name: "Muted", email: "muted-batch@example.invalid", passwordHash: "hash", emailVerifiedAt: verifiedAt, settings: { notifications: { flashcards_due: false, study_streak: false, unfinished_quiz: false, daily_study_reminder: false, weekly_progress: false, study_inactivity: false } } });
    const now = new Date("2026-11-14T12:00:00Z");

    const simultaneous = await Promise.all([runReminderBatch(now, 1), runReminderBatch(now, 1)]);
    assert.equal(simultaneous.filter((result) => result.busy).length, 1);
    const first = simultaneous.find((result) => !result.busy);
    assert.equal(first?.examined, 1);
    assert.equal(first?.hasMore, true);
    const second = await runReminderBatch(now, 1);
    assert.equal(second.examined, 1);
    const completed = await runReminderBatch(now, 1);
    assert.equal(completed.examined, 0);
    assert.equal(completed.hasMore, false);
    assert.equal(await Notification.countDocuments({}), 0);
  } finally {
    await mongoose.disconnect();
    if (global.mongooseCache) { global.mongooseCache.conn = null; global.mongooseCache.promise = null; }
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    await server.stop();
  }
});
