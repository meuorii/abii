import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../models/User";
import { Subject } from "../models/Subject";
import { Flashcard } from "../models/Flashcard";
import { ReviewRecord } from "../models/ReviewRecord";
import { QuizSession } from "../models/QuizSession";
import { AchievementEvent } from "../models/AchievementEvent";
import { UserBadge } from "../models/UserBadge";
import { BadgeReconciliation } from "../models/BadgeReconciliation";
import { calculateAchievementMetrics } from "../lib/badges/metrics";
import { evaluateBadgeCatalog } from "../lib/badges/evaluator";
import { reconcileUserBadges } from "../lib/badges/reconcile";
import { connectToDatabase } from "../lib/mongodb";
import { addCalendarDays, currentConsecutiveDayStreak, longestConsecutiveDayStreak } from "../lib/badges/study-day";
import { recordAchievementEvent } from "../lib/badges/repository";

function question(flashcardId: Types.ObjectId, correct: boolean) {
  return { flashcardId, prompt: "Stored quiz question", expectedAnswer: "private answer", round: 1, answered: true, correct };
}

test("retroactive metrics use only verified owner data and reconciliation awards idempotently", { timeout: 60000 }, async () => {
  const server = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = server.getUri("abii_badge_reconcile_test");
    await connectToDatabase();
    await Promise.all([AchievementEvent.createIndexes(), UserBadge.createIndexes(), BadgeReconciliation.createIndexes()]);
    const user = await User.create({ name: "Legacy Learner", email: "legacy@example.invalid", passwordHash: "hash", settings: { studyTimezone: "UTC" } });
    const stranger = await User.create({ name: "Other Learner", email: "other@example.invalid", passwordHash: "hash" });
    const subjects = await Subject.create(Array.from({ length: 4 }, (_, index) => ({ userId: user._id, name: `Subject ${index + 1}` })));
    const strangerSubject = await Subject.create({ userId: stranger._id, name: "Private Subject" });
    const cards = await Flashcard.create(Array.from({ length: 25 }, (_, index) => ({
      userId: user._id,
      subjectId: subjects[index % 3]._id,
      flashcardType: index === 0 ? "items" : "standard",
      question: `Question ${index + 1}`,
      answer: index === 0 ? "alpha, beta" : `Answer ${index + 1}`,
    })));
    await Flashcard.create({ userId: stranger._id, subjectId: strangerSubject._id, question: "Private", answer: "Private answer" });

    const reviewDates = [new Date("2024-04-01T08:00:00Z"), new Date("2024-04-02T08:00:00Z"), new Date("2024-04-03T08:00:00Z")];
    await ReviewRecord.create(reviewDates.map((reviewedAt) => ({ userId: user._id, flashcardId: cards[0]._id, result: "correct", questionType: "identification", reviewedAt, nextReviewAt: new Date(reviewedAt.getTime() + 86_400_000) })));

    const quizQuestions = cards.slice(0, 10).map((card, index) => question(card._id, index < 8));
    const completedAt = new Date("2024-04-03T10:00:00Z");
    await QuizSession.create([
      { userId: user._id, subjectId: subjects[0]._id, subjectName: "Subject 1", type: "identification", status: "completed", completedAt, expiresAt: new Date("2029-04-04T10:00:00Z"), questions: quizQuestions },
      { userId: user._id, subjectId: subjects[1]._id, subjectName: "Subject 2", type: "identification", status: "completed", completedAt: new Date("2024-04-04T10:00:00Z"), expiresAt: new Date("2029-04-05T10:00:00Z"), questions: cards.slice(10, 12).map((card) => question(card._id, false)) },
      { userId: stranger._id, subjectId: strangerSubject._id, subjectName: "Private Subject", type: "identification", status: "completed", completedAt, expiresAt: new Date("2029-04-04T10:00:00Z"), questions: [question(cards[0]._id, true)] },
    ]);

    const metrics = await calculateAchievementMetrics(String(user._id), new Date("2024-04-04T12:00:00Z"));
    assert.equal(metrics.subjectCount, 4);
    assert.equal(metrics.flashcardCount, 25);
    assert.equal(metrics.distinctSubjectsWithFlashcards, 3);
    assert.equal(metrics.completedQuizCount, 2);
    assert.equal(metrics.completedQuizDayKeys.length, 2);
    assert.equal(metrics.qualifyingQuizScores.length, 1);
    assert.equal(metrics.qualifyingQuizScores[0].scorePercent, 80);
    assert.equal(metrics.enumerationFullyCorrectAnswers, 3, "items flashcards count once per fully correct answer; questionType does not identify enumeration");
    assert.equal(metrics.longestStudyStreak, 3);
    assert.equal(metrics.currentStudyStreak, 3, "yesterday's activity preserves the full live streak");

    const reconciliation = await Promise.all([reconcileUserBadges(String(user._id)), reconcileUserBadges(String(user._id))]);
    const unlockedIds = new Set<string>(reconciliation.flatMap((result) => result.results.filter((badge) => badge.unlocked).map((badge) => badge.badgeId)));
    for (const id of ["hello-abii", "card-creator", "little-explorer", "quiz-rookie", "sharp-mind", "getting-into-rhythm"]) assert.ok(unlockedIds.has(id), `expected ${id}`);
    for (const id of ["perfect-pearl", "weekly-wonder", "dedicated-otter", "study-superstar", "finish-line", "mastermind-abii", "ultimate-scholar"]) assert.ok(!unlockedIds.has(id), `unexpected ${id}`);
    assert.equal(await UserBadge.countDocuments({ userId: user._id }), unlockedIds.size);
    const baseline = (await BadgeReconciliation.findOne({ userId: user._id }).lean())?.baseline;
    assert.equal(baseline?.flashcardCount, 25, "historical content counts are persisted as a deduplicated baseline");
    assert.equal(baseline?.flashcardIds.length, 25);
    assert.equal(await UserBadge.countDocuments({ userId: stranger._id }), 0);
    const rerun = await reconcileUserBadges(String(user._id));
    assert.equal(rerun.cached, true);
    assert.equal(await UserBadge.countDocuments({ userId: user._id }), unlockedIds.size);

    await ReviewRecord.deleteMany({ userId: user._id, flashcardId: cards[0]._id });
    await Flashcard.deleteOne({ _id: cards[0]._id, userId: user._id });
    const postBaselineCard = await Flashcard.create({ userId: user._id, subjectId: subjects[3]._id, question: "New card", answer: "New answer" });
    await recordAchievementEvent(String(user._id), { idempotencyKey: `flashcard-created:${String(postBaselineCard._id)}`, kind: "flashcard-created", occurredAt: postBaselineCard.createdAt ?? new Date(), subjectId: String(subjects[3]._id) });
    const afterDeletion = await calculateAchievementMetrics(String(user._id), new Date("2024-04-05T12:00:00Z"), baseline as never);
    assert.equal(afterDeletion.flashcardCount, 26, "baseline preserves old cards after normal deletion, and new events add once");
    assert.equal(afterDeletion.completedQuizCount, 2, "late compact evidence for a baselined session is not counted twice");
    assert.equal(afterDeletion.correctQuizAnswers, 3, "baseline preserves verified answers when a card's review history is removed");
    assert.equal(afterDeletion.enumerationFullyCorrectAnswers, 3);
    assert.equal(afterDeletion.distinctSubjectsWithFlashcards, 4);

    const empty = await User.create({ name: "No Activity", email: "empty@example.invalid", passwordHash: "hash" });
    const emptyMetrics = await calculateAchievementMetrics(String(empty._id), new Date("2024-04-04T12:00:00Z"));
    assert.equal(evaluateBadgeCatalog(emptyMetrics).filter((badge) => badge.unlocked).length, 0);
    assert.equal(emptyMetrics.quizHistoryCompleteness, "incomplete");
  } finally {
    await mongoose.disconnect();
    delete process.env.MONGODB_URI;
    await server.stop();
  }
});

test("calendar streak utilities handle gaps, duplicates, year boundaries, and thresholds", () => {
  const days = ["2023-12-30", "2023-12-31", "2024-01-01", "2024-01-02", "2024-01-02", "2024-01-04"];
  assert.equal(longestConsecutiveDayStreak(days), 4);
  assert.equal(currentConsecutiveDayStreak(days, "2024-01-06"), 0, "a missed day ends the live streak");
  assert.equal(currentConsecutiveDayStreak(days, "2024-01-05"), 1, "activity completed yesterday preserves one day");
  assert.equal(currentConsecutiveDayStreak(days, "2024-01-02"), 4);
  assert.equal(addCalendarDays("2024-02-28", 1), "2024-02-29");
});
