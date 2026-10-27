import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../models/User";
import { UserBadge } from "../models/UserBadge";
import { AchievementEvent } from "../models/AchievementEvent";
import { clearAchievementActivity } from "../lib/badges/persistence";
import { createEarnedBadgeIdempotently, fetchEarnedBadges, fetchFeaturedBadgeSelections, readDurableAchievementStats, recordAchievementEvent, updateFeaturedBadgeSelection } from "../lib/badges/repository";
import { longestConsecutiveDayStreak, studyDayKey } from "../lib/badges/study-day";

test("durable achievement persistence, ownership, deletion semantics, and study calendar", { timeout: 60000 }, async () => {
  const server = await MongoMemoryServer.create();
  try {
    await mongoose.connect(server.getUri(), { dbName: "abii_achievement_test", autoIndex: false, autoCreate: false });
    await Promise.all([User.syncIndexes(), UserBadge.syncIndexes(), AchievementEvent.syncIndexes()]);
    const owner = new Types.ObjectId();
    const stranger = new Types.ObjectId();
    const user = await User.create({ _id: owner, name: "Study User", email: "study@example.invalid", passwordHash: "hash", settings: { targetSubjects: 12, subjectLayout: "list", defaultLandingPage: "/progress" } });
    assert.equal(user.settings.targetSubjects, 12);
    assert.equal(user.settings.subjectLayout, "list");
    assert.deepEqual(user.settings.featuredBadges?.dashboard ?? [], []);
    assert.deepEqual(user.settings.featuredBadges?.progress ?? [], []);
    assert.equal(user.settings.studyTimezone, "UTC");
    await assert.rejects(new User({ name: "Bad", email: "bad@example.invalid", passwordHash: "hash", settings: { featuredBadges: { dashboard: ["hello-abii", "hello-abii"] } } }).validate());
    await assert.rejects(new User({ name: "Bad", email: "bad@example.invalid", passwordHash: "hash", settings: { featuredBadges: { progress: ["not-a-badge"] } } }).validate());
    await assert.rejects(new User({ name: "Bad", email: "bad@example.invalid", passwordHash: "hash", settings: { studyTimezone: "Mars/Olympus" } }).validate());

    const badgeIndex = UserBadge.schema.indexes().find(([keys]) => keys.userId === 1 && keys.badgeId === 1);
    assert.equal(badgeIndex?.[1].unique, true);
    const firstDate = new Date("2024-01-02T03:04:05Z");
    const concurrentAwards = await Promise.all(Array.from({ length: 8 }, () => createEarnedBadgeIdempotently(String(owner), { badgeId: "hello-abii", unlockedAt: firstDate, verifiedAt: new Date(), source: "live", minimalEvidence: { metric: "subject-count", target: 1, observed: 1 } })));
    assert.equal(new Set(concurrentAwards.map((award) => String(award._id))).size, 1);
    const laterAward = await createEarnedBadgeIdempotently(String(owner), { badgeId: "hello-abii", unlockedAt: new Date("2025-01-01"), verifiedAt: new Date(), source: "backfill" });
    assert.equal(laterAward.unlockedAt.toISOString(), firstDate.toISOString());
    await assert.rejects(createEarnedBadgeIdempotently(String(owner), { badgeId: "bad-id" as never, unlockedAt: firstDate, verifiedAt: firstDate, source: "live" }));

    await Promise.all(Array.from({ length: 8 }, () => recordAchievementEvent(String(owner), { idempotencyKey: "quiz-completed:q1", kind: "quiz-completed", occurredAt: firstDate, dayKey: "2024-01-02", originalQuestionCount: 10, firstAttemptCorrectCount: 9, scorePercent: 90 })));
    await recordAchievementEvent(String(owner), { idempotencyKey: "card-1", kind: "flashcard-created", occurredAt: firstDate, subjectId: String(new Types.ObjectId()) });
    const eventIndex = AchievementEvent.schema.indexes().find(([keys]) => keys.userId === 1 && keys.idempotencyKey === 1);
    assert.equal(eventIndex?.[1].unique, true);
    assert.equal(await AchievementEvent.countDocuments({ userId: owner, idempotencyKey: "quiz-completed:q1" }), 1);
    assert.equal((await fetchEarnedBadges(String(owner))).length, 1);
    assert.equal((await fetchEarnedBadges(String(stranger))).length, 0);
    const stats = await readDurableAchievementStats(String(owner));
    assert.equal(stats.completedQuizzes, 1);
    assert.equal(stats.bestQualifyingQuizScore, 90);

    await createEarnedBadgeIdempotently(String(owner), { badgeId: "card-creator", unlockedAt: firstDate, verifiedAt: firstDate, source: "live" });
    const dashboard = await updateFeaturedBadgeSelection(String(owner), "dashboard", ["hello-abii"]);
    assert.deepEqual(dashboard.dashboard, ["hello-abii"]);
    assert.deepEqual(dashboard.progress, []);
    const progress = await updateFeaturedBadgeSelection(String(owner), "progress", ["card-creator"]);
    assert.deepEqual(progress.dashboard, ["hello-abii"]);
    assert.deepEqual(progress.progress, ["card-creator"]);
    assert.deepEqual(await fetchFeaturedBadgeSelections(String(owner)), progress);
    await assert.rejects(updateFeaturedBadgeSelection(String(owner), "dashboard", ["hello-abii", "card-creator", "quiz-rookie", "little-explorer"]));
    await assert.rejects(updateFeaturedBadgeSelection(String(owner), "dashboard", ["quiz-rookie"]));
    await assert.rejects(updateFeaturedBadgeSelection(String(owner), "dashboard", ["hello-abii", "hello-abii"]));

    await clearAchievementActivity(String(owner));
    assert.equal(await AchievementEvent.countDocuments({ userId: owner }), 0);
    assert.equal(await UserBadge.countDocuments({ userId: owner }), 2, "explicit history/material erasure preserves permanent badge awards");
    assert.equal((await UserBadge.findOne({ userId: owner, badgeId: "hello-abii" }).lean())?.minimalEvidence, undefined, "explicit erasure removes supporting activity evidence");

    assert.equal(studyDayKey(new Date("2024-03-10T07:30:00Z"), "America/Los_Angeles"), "2024-03-09");
    assert.equal(studyDayKey(new Date("2024-03-10T10:30:00Z"), "America/Los_Angeles"), "2024-03-10");
    assert.equal(studyDayKey(new Date("2024-01-01T00:30:00Z"), "America/Los_Angeles"), "2023-12-31");
    assert.equal(studyDayKey(new Date("2024-06-01T00:00:00Z"), "invalid-zone"), "2024-06-01");
    assert.equal(longestConsecutiveDayStreak(["2024-03-09", "2024-03-10", "2024-03-11", "2023-12-31", "2024-01-01"]), 3);

    await Promise.all([AchievementEvent.deleteMany({ userId: owner }), UserBadge.deleteMany({ userId: owner }), User.deleteOne({ _id: owner })]);
    assert.equal(await AchievementEvent.countDocuments({ userId: owner }), 0);
    assert.equal(await UserBadge.countDocuments({ userId: owner }), 0);
    assert.equal(await User.countDocuments({ _id: owner }), 0, "account deletion removes preferences with the User document");
  } finally {
    await mongoose.disconnect();
    await server.stop();
  }
});
