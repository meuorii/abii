import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../models/User";
import { UserBadge } from "../models/UserBadge";
import { AchievementEvent } from "../models/AchievementEvent";
import { Notification } from "../models/Notification";
import { connectToDatabase } from "../lib/mongodb";
import { BADGE_BY_ID } from "../lib/badges/catalog";
import { awardBadgeIdempotently } from "../lib/badges/repository";
import { notifyLiveBadgeAward, notifyQuizMilestoneForCompletion, notifyAccountSecurityChange } from "../lib/notifications/producers";
import { publishWhatsNewAnnouncement } from "../lib/notifications/announcements";

test("trusted event producers publish only verified, opted-in events idempotently", { timeout: 120_000 }, async () => {
  const server = await MongoMemoryServer.create();
  const previousUri = process.env.MONGODB_URI;
  try {
    process.env.MONGODB_URI = server.getUri("abii_notification_events_test");
    await connectToDatabase();
    await Promise.all([User.syncIndexes(), UserBadge.syncIndexes(), AchievementEvent.syncIndexes(), Notification.syncIndexes()]);
    const userIndexes = await User.collection.indexes();
    assert.ok(userIndexes.some((index) => index.name === "verified_users_cursor"), "verified announcement recipients use a bounded indexed cursor");
    const eventIndexes = await AchievementEvent.collection.indexes();
    assert.ok(eventIndexes.some((index) => index.name === "achievement_event_owner_kind_occurred"), "milestone rank queries use an owner, kind, and completion-time index");

    const badgeOwner = await User.create({ name: "Badge Learner", email: "badge-events@example.invalid", passwordHash: "hash" });
    const liveAward = await awardBadgeIdempotently(String(badgeOwner._id), { badgeId: "memory-pro", unlockedAt: new Date(), verifiedAt: new Date(), source: "live" });
    assert.equal(liveAward.created, true);
    const badgeResult = await notifyLiveBadgeAward(String(badgeOwner._id), liveAward);
    assert.equal(badgeResult, "created");
    const duplicateBadgeResults = await Promise.all([notifyLiveBadgeAward(String(badgeOwner._id), liveAward), notifyLiveBadgeAward(String(badgeOwner._id), liveAward)]);
    assert.deepEqual(duplicateBadgeResults.sort(), ["already_exists", "already_exists"]);
    const badgeNotice = await Notification.findOne({ userId: badgeOwner._id, type: "badge_unlocked" }).lean();
    assert.equal(badgeNotice?.title, "You unlocked a new badge!");
    assert.match(badgeNotice?.message ?? "", new RegExp(BADGE_BY_ID["memory-pro"].name));
    assert.equal(badgeNotice?.target, "/badges");
    const racingOwner = await User.create({ name: "Racing Learner", email: "racing-events@example.invalid", passwordHash: "hash" });
    const racingAward = await awardBadgeIdempotently(String(racingOwner._id), { badgeId: "memory-pro", unlockedAt: new Date(), verifiedAt: new Date(), source: "live" });
    const concurrentResults = await Promise.all([notifyLiveBadgeAward(String(racingOwner._id), racingAward), notifyLiveBadgeAward(String(racingOwner._id), racingAward)]);
    assert.deepEqual(concurrentResults.sort(), ["already_exists", "created"], "unique owner/dedupe index arbitrates concurrent inserts");
    const otherOwner = await User.create({ name: "Separate Learner", email: "separate-events@example.invalid", passwordHash: "hash" });
    const sameEventDifferentOwner = await awardBadgeIdempotently(String(otherOwner._id), { badgeId: "memory-pro", unlockedAt: new Date(), verifiedAt: new Date(), source: "live" });
    assert.equal(await notifyLiveBadgeAward(String(otherOwner._id), sameEventDifferentOwner), "created", "deduplication remains account scoped");
    const backfill = await awardBadgeIdempotently(String(badgeOwner._id), { badgeId: "card-creator", unlockedAt: new Date(), verifiedAt: new Date(), source: "backfill" });
    assert.equal(await notifyLiveBadgeAward(String(badgeOwner._id), backfill), "not_live_award");
    assert.equal(await Notification.countDocuments({ userId: badgeOwner._id, type: "badge_unlocked" }), 1);

    const failureOwner = await User.create({ name: "Failure Learner", email: "failure-events@example.invalid", passwordHash: "hash" });
    const durableAward = await awardBadgeIdempotently(String(failureOwner._id), { badgeId: "hello-abii", unlockedAt: new Date(), verifiedAt: new Date(), source: "live" });
    const ownCreate = Object.getOwnPropertyDescriptor(Notification, "create");
    Object.defineProperty(Notification, "create", { configurable: true, value: async () => { throw new Error("injected notification write failure"); } });
    try {
      assert.equal(await notifyLiveBadgeAward(String(failureOwner._id), durableAward), "failed");
      assert.ok(await UserBadge.exists({ userId: failureOwner._id, badgeId: "hello-abii" }), "a notification failure cannot revoke the durable badge");
    } finally {
      if (ownCreate) Object.defineProperty(Notification, "create", ownCreate);
      else delete (Notification as unknown as { create?: unknown }).create;
    }

    const quizOwner = await User.create({ name: "Quiz Learner", email: "quiz-events@example.invalid", passwordHash: "hash" });
    for (let index = 0; index < 4; index += 1) await AchievementEvent.create({ userId: quizOwner._id, idempotencyKey: `quiz-completed:prior-${index}`, kind: "quiz-completed", occurredAt: new Date(Date.now() - 60_000 + index * 1000) });
    const fifthSession = new Types.ObjectId();
    const fifthCompletedAt = new Date();
    await AchievementEvent.create({ userId: quizOwner._id, idempotencyKey: `quiz-completed:${fifthSession}`, sessionId: fifthSession, kind: "quiz-completed", occurredAt: fifthCompletedAt });
    await AchievementEvent.create({ userId: quizOwner._id, idempotencyKey: "quiz-completed:later-already-committed", kind: "quiz-completed", occurredAt: new Date(fifthCompletedAt.getTime() + 1000) });
    assert.equal(await notifyQuizMilestoneForCompletion(String(quizOwner._id), String(fifthSession)), "created");
    assert.equal(await notifyQuizMilestoneForCompletion(String(quizOwner._id), String(fifthSession)), "already_exists");
    const quizNotice = await Notification.findOne({ userId: quizOwner._id, type: "quiz_milestone" }).lean();
    assert.equal(quizNotice?.dedupeKey, "quiz-milestone:5");
    assert.equal(quizNotice?.metadata?.count, 5);
    assert.equal(quizNotice?.target, "/progress");

    const historyOwner = await User.create({ name: "Established Learner", email: "history-events@example.invalid", passwordHash: "hash" });
    for (let index = 0; index < 30; index += 1) await AchievementEvent.create({ userId: historyOwner._id, idempotencyKey: `quiz-completed:history-${index}`, kind: "quiz-completed", occurredAt: new Date(Date.now() - 86_400_000) });
    const thirtyFirstSession = new Types.ObjectId();
    await AchievementEvent.create({ userId: historyOwner._id, idempotencyKey: `quiz-completed:${thirtyFirstSession}`, sessionId: thirtyFirstSession, kind: "quiz-completed", occurredAt: new Date() });
    assert.equal(await notifyQuizMilestoneForCompletion(String(historyOwner._id), String(thirtyFirstSession)), "not_milestone");
    assert.equal(await notifyQuizMilestoneForCompletion(String(historyOwner._id), String(new Types.ObjectId())), "not_verified");
    assert.equal(await Notification.countDocuments({ userId: historyOwner._id, type: "quiz_milestone" }), 0);
    for (const threshold of [1, 10, 25, 50, 100]) {
      const owner = await User.create({ name: `Milestone ${threshold}`, email: `milestone-${threshold}@example.invalid`, passwordHash: "hash" });
      const sessions = Array.from({ length: threshold }, () => new Types.ObjectId());
      const startedAt = Date.now() - threshold * 1000;
      await AchievementEvent.insertMany(sessions.map((sessionId, index) => ({
        userId: owner._id, sessionId, idempotencyKey: `quiz-completed:${sessionId}`, kind: "quiz-completed",
        occurredAt: new Date(startedAt + index * 1000),
      })));
      assert.equal(await notifyQuizMilestoneForCompletion(String(owner._id), String(sessions.at(-1))), "created", `${threshold} is a configured milestone`);
      assert.equal((await Notification.findOne({ userId: owner._id, type: "quiz_milestone" }).lean())?.metadata?.count, threshold);
    }
    const mutedQuizOwner = await User.create({ name: "Muted Learner", email: "muted-events@example.invalid", passwordHash: "hash", settings: { notifications: { quiz_milestone: false } } });
    for (let index = 0; index < 4; index += 1) await AchievementEvent.create({ userId: mutedQuizOwner._id, idempotencyKey: `quiz-completed:muted-${index}`, kind: "quiz-completed", occurredAt: new Date() });
    const mutedSession = new Types.ObjectId();
    await AchievementEvent.create({ userId: mutedQuizOwner._id, idempotencyKey: `quiz-completed:${mutedSession}`, sessionId: mutedSession, kind: "quiz-completed", occurredAt: new Date() });
    assert.equal(await notifyQuizMilestoneForCompletion(String(mutedQuizOwner._id), String(mutedSession)), "suppressed");

    const securityOwner = await User.create({ name: "Security Learner", email: "security-events@example.invalid", passwordHash: "hash", settings: { notifications: { account_security: false } } });
    assert.equal(await notifyAccountSecurityChange(String(securityOwner._id), "password_changed", "version-4"), "created");
    assert.equal(await notifyAccountSecurityChange(String(securityOwner._id), "password_changed", "version-4"), "already_exists");
    const securityNotice = await Notification.findOne({ userId: securityOwner._id, type: "account_security" }).lean();
    assert.equal(securityNotice?.title, "Your password was changed");
    assert.equal(securityNotice?.target, "/settings");
    assert.doesNotMatch(`${securityNotice?.title} ${securityNotice?.message}`, /passwordHash|token|otp|secret/i);

    const eligible = await User.create({ name: "Announcement Learner", email: "announcement-events@example.invalid", passwordHash: "hash", emailVerifiedAt: new Date() });
    const optedOut = await User.create({ name: "Opted Out", email: "announcement-optout@example.invalid", passwordHash: "hash", emailVerifiedAt: new Date(), settings: { notifications: { whats_new: false } } });
    const unverified = await User.create({ name: "Unverified", email: "announcement-unverified@example.invalid", passwordHash: "hash" });
    const announcement = { id: "study-tools-v1", title: "A new way to study", message: "You can now organize your materials into topics.", target: "/dashboard" };
    const preview = await publishWhatsNewAnnouncement({ announcement, apply: false, batchSize: 1 });
    assert.equal(preview.mode, "dry-run");
    assert.equal(preview.eligibleRecipients, 1);
    assert.equal(await Notification.countDocuments({ type: "whats_new" }), 0, "dry-run performs no notification writes");
    const published = await publishWhatsNewAnnouncement({ announcement, apply: true, batchSize: 1 });
    assert.equal(published.mode, "published");
    if (published.mode !== "published") throw new Error("Expected publication summary.");
    assert.deepEqual({ created: published.created, alreadyExists: published.alreadyExists, suppressed: published.suppressed, failed: published.failed }, { created: 1, alreadyExists: 0, suppressed: 0, failed: 0 });
    const repeated = await publishWhatsNewAnnouncement({ announcement, apply: true, batchSize: 1 });
    assert.equal(repeated.mode === "published" ? repeated.alreadyExists : -1, 1);
    assert.equal(await Notification.countDocuments({ userId: eligible._id, dedupeKey: "whats-new:study-tools-v1" }), 1);
    assert.equal(await Notification.countDocuments({ userId: optedOut._id, type: "whats_new" }), 0);
    assert.equal(await Notification.countDocuments({ userId: unverified._id, type: "whats_new" }), 0);
    await assert.rejects(publishWhatsNewAnnouncement({ announcement: { ...announcement, target: "https://example.invalid" }, apply: false }), /safe internal route/i);
    assert.ok(await User.exists({ _id: eligible._id }));
  } finally {
    await mongoose.disconnect();
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    await server.stop();
  }
});
