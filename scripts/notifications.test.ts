import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { connectToDatabase } from "../lib/mongodb";
import { createNotification, listNotifications, markNotificationRead, markAllNotificationsRead, countUnreadNotifications } from "../lib/notifications/service";
import { DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_TYPES, normalizeNotificationPreferences, validateNotificationTarget } from "../lib/notifications/contracts";

test("notification preferences normalize legacy users and keep security mandatory", () => {
  assert.equal(normalizeNotificationPreferences(undefined).study_streak, true);
  assert.equal(normalizeNotificationPreferences({ account_security: false }).account_security, true);
  assert.equal(normalizeNotificationPreferences({ dailyStudyTime: "09:30" }).dailyStudyTime, "09:30");
  assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.daily_study_reminder, false);
  assert.equal(validateNotificationTarget("/progress"), "/progress");
  assert.throws(() => validateNotificationTarget("//example.com"));
  assert.throws(() => validateNotificationTarget("/%2e%2e/settings"));
});

test("notification persistence is idempotent, paginated, isolated, and read atomically", { timeout: 60000 }, async () => {
  const server = await MongoMemoryServer.create();
  const previousUri = process.env.MONGODB_URI;
  try {
    process.env.MONGODB_URI = server.getUri("abii_notification_test");
    await connectToDatabase();
    await Promise.all([User.syncIndexes(), Notification.syncIndexes()]);
    for (const type of NOTIFICATION_TYPES) {
      await new Notification({ userId: new Types.ObjectId(), type, title: "Valid title", message: "Valid body", dedupeKey: `type:${type}` }).validate();
    }
    await assert.rejects(new Notification({ userId: new Types.ObjectId(), type: "unknown", title: "Bad", message: "Bad", dedupeKey: "bad" }).validate());
    await assert.rejects(new Notification({ userId: new Types.ObjectId(), type: "whats_new", title: " ", message: "Bad", dedupeKey: "bad" }).validate());
    await assert.rejects(new Notification({ userId: new Types.ObjectId(), type: "whats_new", title: "Bad", message: "Bad", dedupeKey: "bad", target: "https://example.invalid" }).validate());
    await assert.rejects(new Notification({ userId: new Types.ObjectId(), type: "whats_new", title: "Bad", message: "Bad", dedupeKey: "bad", metadata: { passwordHash: "secret" } }).validate());
    const owner = new Types.ObjectId();
    const stranger = new Types.ObjectId();
    await User.create({ _id: owner, name: "Owner", email: "owner@example.invalid", passwordHash: "hash" });
    await User.create({ _id: stranger, name: "Stranger", email: "stranger@example.invalid", passwordHash: "hash" });

    const attempts = await Promise.all(Array.from({ length: 8 }, () => createNotification(String(owner), {
      type: "badge_unlocked", title: "Badge earned", message: "You earned a badge.", dedupeKey: "badge:hello", target: "/badges",
    })));
    assert.equal(attempts.filter((result) => result.status === "created").length, 1);
    assert.equal(attempts.filter((result) => result.status === "already_exists").length, 7);
    assert.equal(await Notification.countDocuments({ userId: owner }), 1);
    assert.equal((await createNotification(String(stranger), { type: "badge_unlocked", title: "Other badge", message: "Other owner.", dedupeKey: "badge:hello", target: "/badges" })).status, "created");
    assert.equal(await countUnreadNotifications(String(owner)), 1);
    assert.equal(await countUnreadNotifications(String(stranger)), 1);

    const first = await Notification.findOne({ userId: owner }).lean();
    assert.ok(first);
    const firstReadAt = new Date("2026-01-01T00:00:00Z");
    assert.equal(await markNotificationRead(String(owner), String(first._id), firstReadAt), true);
    assert.equal(await markNotificationRead(String(owner), String(first._id), new Date("2026-01-02T00:00:00Z")), true);
    assert.equal((await Notification.findById(first._id).lean())?.readAt?.toISOString(), firstReadAt.toISOString());
    assert.equal(await markNotificationRead(String(stranger), String(first._id)), false);
    assert.equal((await createNotification(String(owner), { type: "badge_unlocked", title: "Changed title", message: "Changed body", dedupeKey: "badge:hello" })).status, "already_exists");
    const afterDuplicate = await Notification.findById(first._id).lean();
    assert.equal(afterDuplicate?.title, "Badge earned");
    assert.equal(afterDuplicate?.readAt?.toISOString(), firstReadAt.toISOString());
    assert.equal(await markAllNotificationsRead(String(owner)), 0);

    await Promise.all(["one", "two", "three"].map((key) => createNotification(String(owner), {
      type: "weekly_progress", title: `Update ${key}`, message: "Weekly update", dedupeKey: `weekly:${key}`,
    })));
    await createNotification(String(owner), { type: "flashcards_due", title: "Review due", message: "A few cards are ready.", dedupeKey: "review:due" });
    const reminderGroup = await listNotifications(String(owner), { limit: 20, group: "reminders" });
    assert.deepEqual(reminderGroup.notifications.map((item) => item.type), ["flashcards_due"]);
    const page1 = await listNotifications(String(owner), { limit: 2 });
    assert.equal(page1.notifications.length, 2);
    assert.equal(page1.hasMore, true);
    const page2 = await listNotifications(String(owner), { limit: 2, cursor: page1.nextCursor ?? undefined });
    assert.equal(page2.notifications.length, 2);
    assert.equal(new Set([...page1.notifications, ...page2.notifications].map((item) => item.id)).size, 4);
    assert.equal((await listNotifications(String(stranger), { limit: 20 })).notifications.length, 1);
    assert.equal((await listNotifications(String(owner), { limit: 20, unreadOnly: true })).notifications.length, 4);
    await assert.rejects(listNotifications(String(owner), { limit: 20, cursor: "tampered" }), /cursor is invalid/i);
    assert.equal(await markAllNotificationsRead(String(owner)), 4);
    assert.equal(await countUnreadNotifications(String(owner)), 0);
    await Notification.create({ userId: owner, type: "flashcards_due", title: "Expired reminder", message: "This reminder has expired.", dedupeKey: "expired:reminder", readAt: null, expiresAt: new Date(Date.now() - 60_000) });
    assert.equal((await listNotifications(String(owner), { limit: 20, unreadOnly: true })).notifications.length, 0, "expired unread reminders stay out of active lists");
    assert.equal(await countUnreadNotifications(String(owner)), 0, "expired unread reminders do not inflate the navbar count");
    assert.equal(await Notification.countDocuments({ userId: stranger, dedupeKey: "badge:hello" }), 1);
  } finally {
    await mongoose.disconnect();
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    await server.stop();
  }
});
