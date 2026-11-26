import assert from "node:assert/strict";
import { test } from "node:test";
import { announcementContent, publicationTime } from "@/lib/admin/announcement-contract";

test("validates plain text, fixed broadcast destinations and explicit UTC scheduling", () => {
  assert.deepEqual(announcementContent({ title: " Hello ", message: " Update ", target: "/review" }), {
    title: "Hello", message: "Update", target: "/review",
  });
  assert.throws(() => announcementContent({ title: "x", message: "y", target: "/subjects/61db623cdc644c6b9d92f27e" }), /destination/i);
  assert.throws(() => announcementContent({ title: "x", message: "y", target: "//unsafe.invalid" }), /destination/i);
  const now = new Date("2027-01-01T00:00:00Z");
  assert.equal(publicationTime("2027-01-01T12:30", now).toISOString(), "2027-01-01T12:30:00.000Z");
  for (const value of ["2026-12-31T23:59", "2027-02-30T12:30", "2027-01-02T12:30+02:00"]) {
    assert.throws(() => publicationTime(value, now));
  }
});

import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { Admin, ADMIN_SUBJECT } from "@/models/Admin";
import { AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { Announcement, AnnouncementReceipt, receiptOwnerIndex } from "@/models/Announcement";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { digest, prepareEnrollment } from "@/lib/auth/admin-factor-crypto";
import { AnnouncementConflict, AnnouncementDeliveryUnavailable, mutateAnnouncement, parseAnnouncementCommand, parseAnnouncementQuery, previewAnnouncement, readAnnouncements } from "@/lib/admin/announcements";
import { deliverAnnouncementPage, managedPublicationId, publishWhatsNewAnnouncement } from "@/lib/notifications/announcements";
import { runDueAnnouncements } from "@/lib/notifications/announcement-worker";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";

test("durable announcement management commits and recovers in an isolated replica set", { timeout: 120_000 }, async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri("phase9_admin_fixture");
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_MFA_KEY_ID = "fixture";
  process.env.ADMIN_MFA_KEYS = JSON.stringify({ fixture: randomBytes(32).toString("base64") });
  process.env.ABII_ANNOUNCEMENTS_DELIVERY_ENABLED = "true";
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 1200 });
    await Promise.all([AdminAuditLog.createCollection(), AdminSecurityEvent.createCollection(),
      Announcement.syncIndexes(), AnnouncementReceipt.syncIndexes(), Notification.syncIndexes(), User.syncIndexes()]);
    const { encryptedSeed } = prepareEnrollment(ADMIN_SUBJECT);
    const environment = process.env.NODE_ENV === "production" ? "production" : "development";
    await Admin.create({ _id: "primary", name: "Fixture Admin", email: "phase9-admin@example.invalid",
      passwordHash: "$2b$12$HUdxSbGT.hyi71fJSD2hr.uO9XngNUp.lzcO4cJUDKgl/Zzw8KCVu",
      status: "active", sessionVersion: 0, mfa: { encryptedSeed, lastStep: 1 },
      recoveryCodes: Array.from({ length: 8 }, (_, index) => digest(String(index))) });
    const token = async (issued: number) => {
      const sessionId = randomBytes(24).toString("base64url");
      const authenticatedAt = new Date(issued * 1000);
      await Admin.updateOne({ _id: "primary" }, { $set: { activeSession: { sessionId, version: 0, authenticatedAt, absoluteExpiresAt: new Date((issued + 28_800) * 1000), lastActivityAt: new Date(), environment } } });
      return new SignJWT({ sv: 0, sid: sessionId, env: environment, amr: ["pwd", "otp"] })
        .setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" }).setIssuer("abii").setAudience("abii-admin")
        .setSubject(ADMIN_SUBJECT).setIssuedAt(issued).setExpirationTime(issued + 28_800)
        .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    };
    const epoch = Math.floor(Date.now() / 1000);
    let cookie = await token(epoch);
    const stale = await token(epoch - 301);
    const addLearner = (name: string, options?: { suspendedAt?: Date; optOut?: boolean; verify?: boolean }) => User.create({
      name, passwordHash: "fixture", email: `${name}@example.invalid`, emailVerifiedAt: options?.verify === false ? null : new Date(),
      ...(options?.suspendedAt ? { suspendedAt: options.suspendedAt } : {}),
      ...(options?.optOut ? { settings: { notifications: { whats_new: false } } } : {}),
    });
    const [first, second, opted, suspended, unverified, changesPreference] = await (async () => [
      await addLearner("first"), await addLearner("second"), await addLearner("opted", { optOut: true }),
      await addLearner("suspended", { suspendedAt: new Date() }), await addLearner("unverified", { verify: false }), await addLearner("changes"),
    ])();
    const legacy = await mongoose.connection.db!.collection("users").insertOne({
      role: "admin", name: "Legacy admin marker", email: "legacy-marker@example.invalid", emailVerifiedAt: new Date(),
    });
    const content = announcementContent({ title: "A useful release", message: "Study cards are easier to organize.", target: "/review" });
    assert.equal((await previewAnnouncement(content)).estimate.count, 3);
    await mongoose.connection.db!.collection("users").deleteOne({ _id: legacy.insertedId });

    const write = (body: Record<string, unknown>, credential = cookie) => mutateAnnouncement(credential, parseAnnouncementCommand(body));
    const id = new Types.ObjectId().toHexString();
    const draft = await write({ ...content, action: "save", id, revision: null }, stale);
    assert.equal(draft.state, "draft");
    assert.equal(await Notification.countDocuments(), 0);
    cookie = await token(epoch);
    const edited = await write({ ...content, title: "New review tools", action: "save", id, revision: draft.revision });
    await assert.rejects(write({ ...content, action: "save", id, revision: draft.revision }), AnnouncementConflict);
    const editedBody = announcementContent(edited);
    const proof = await previewAnnouncement(editedBody);
    const now = new Date();
    const future = new Date(+now + 120_000).toISOString().slice(0, 16);
    const schedule = { ...editedBody, action: "schedule", id, revision: edited.revision, confirmed: true, confirmation: proof.confirmation, scheduledAt: future };
    await assert.rejects(write(schedule, stale), { status: 401 });
    const scheduled = await write(schedule);
    assert.equal(await runDueAnnouncements({ now: new Date(future + ":00Z") > now ? now : new Date(+now - 1), id }), "idle");
    const rescheduled = await write({ ...schedule, revision: scheduled.revision, scheduledAt: new Date(+now + 240_000).toISOString().slice(0, 16) });
    const canceled = await write({ action: "cancel", id, revision: rescheduled.revision, confirmed: true });
    assert.equal(canceled.state, "canceled");
    assert.equal(await runDueAnnouncements({ now: new Date(+now + 480_000), id }), "idle");

    const publish = { ...editedBody, action: "publish", id, revision: canceled.revision, confirmed: true, confirmation: proof.confirmation };
    assert.throws(() => parseAnnouncementCommand({ ...publish, message: "Unreviewed content" }), /preview and confirm/);
    await AnnouncementReceipt.collection.dropIndex(receiptOwnerIndex);
    await assert.rejects(write(publish), AnnouncementDeliveryUnavailable);
    await AnnouncementReceipt.collection.createIndex({ userId: 1 }, { name: receiptOwnerIndex });
    await mongoose.connection.db!.command({ collMod: "adminsecurityevents", validator: { kind: { $ne: "announcement.publish" } } });
    await assert.rejects(write(publish), { status: 503 });
    assert.equal((await Announcement.findById(id))?.state, "canceled");
    await mongoose.connection.db!.command({ collMod: "adminsecurityevents", validator: {} });
    const double = await Promise.allSettled([write(publish), write(publish)]);
    assert.equal(double.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(await AdminAuditLog.countDocuments({ action: "announcement.publish", targetId: id }), 1);
    await assert.rejects(write({ ...content, action: "save", id, revision: canceled.revision + 1 }), AnnouncementConflict);

    const late = await addLearner("late");
    await User.updateOne({ _id: changesPreference._id }, { $set: { "settings.notifications.whats_new": false } });
    await mongoose.connection.db!.command({ collMod: "announcementreceipts", validator: { userId: { $ne: second._id } } });
    assert.equal(await runDueAnnouncements({ id, batchSize: 1, maxPages: 3 }), "interrupted");
    const failed = await Announcement.findById(id);
    assert.equal(failed?.state, "incomplete");
    assert.equal(failed?.delivered, 1);
    assert.equal(failed?.pending, 1);
    assert.equal(await Notification.countDocuments({ userId: second._id }), 0);
    const dedupeKey = `whats-new:${managedPublicationId(id)}`;
    await Notification.deleteOne({ userId: first._id, dedupeKey });
    const replay = await withRequiredTransaction(session => deliverAnnouncementPage(
      { id: managedPublicationId(id), ...editedBody }, [first._id], failed!.committedAt!, session));
    assert.equal(replay.alreadyExists, 1);
    assert.equal(await Notification.countDocuments({ userId: first._id }), 0);

    await mongoose.connection.db!.command({ collMod: "announcementreceipts", validator: {} });
    assert.ok(failed);
    const queued = await write({ action: "retry", id, revision: failed.revision, confirmed: true });
    await Announcement.updateOne({ _id: id }, { $set: { state: "publishing", lease: "interrupted", nextRunAt: new Date(Date.now() - 500) } });
    assert.equal(queued.state, "queued");
    const overlapping = await Promise.all([runDueAnnouncements({ id }), runDueAnnouncements({ id })]);
    assert.ok(overlapping.includes("delivered"));
    const completed = await Announcement.findById(id);
    assert.equal(completed?.state, "delivered");
    assert.equal(completed?.delivered, 2);
    assert.equal(completed?.suppressed, 3);
    assert.equal(await Notification.countDocuments({ userId: { $in: [opted._id, suspended._id, unverified._id, late._id, changesPreference._id] }, dedupeKey }), 0);
    assert.equal(await AnnouncementReceipt.countDocuments({ userId: { $in: [first._id, second._id] } }), 2);
    await withRequiredTransaction(async session => {
      await User.deleteOne({ _id: second._id }, { session });
      await Notification.deleteMany({ userId: second._id }, { session });
      await AnnouncementReceipt.deleteMany({ userId: second._id }, { session });
    });
    assert.equal((await withRequiredTransaction(session => deliverAnnouncementPage(
      { id: managedPublicationId(id), ...editedBody }, [second._id], completed!.committedAt!, session))).suppressed, 1);
    assert.equal(await AnnouncementReceipt.countDocuments({ userId: second._id }), 0);
    assert.equal((await readAnnouncements(parseAnnouncementQuery({ q: managedPublicationId(id) }))).rows[0].delivered, 2);
    await assert.rejects(publishWhatsNewAnnouncement({ announcement: { id: managedPublicationId(id), ...editedBody }, apply: false }), /reserved/);

    const remaining = await previewAnnouncement(content);
    const calendar = new Types.ObjectId().toHexString();
    await write({ ...content, action: "schedule", id: calendar, revision: null, confirmed: true, confirmation: remaining.confirmation, scheduledAt: future });
    await User.updateMany({}, { $set: { "settings.notifications.whats_new": false } });
    assert.equal(await runDueAnnouncements({ id: calendar, now: new Date(future + ":00Z") }), "delivered");
    assert.equal((await Announcement.findById(calendar))?.delivered, 0);
    assert.equal(await AdminAuditLog.countDocuments({ action: "announcement.publish", targetId: calendar }), 1);
    assert.equal((await readAnnouncements(parseAnnouncementQuery({ status: "published" }))).counts.published, 2);
    await Announcement.insertMany(Array.from({ length: 22 }, (_, index) => ({
      ...content, title: "List fixture " + index, titleKey: "list fixture " + index,
      author: ADMIN_SUBJECT, state: "draft", lastAction: "Draft created",
    })));
    const front = await readAnnouncements(parseAnnouncementQuery({ q: "List fixture", sort: "created" }));
    assert.equal(front.rows.length, 20);
    assert.ok(front.next);
    const back = await readAnnouncements(parseAnnouncementQuery({ q: "List fixture", sort: "created", page: front.next }));
    assert.equal(back.rows.length, 2);
    assert.equal(new Set([...front.rows, ...back.rows].map(row => row.id)).size, 22);
    await assert.rejects(readAnnouncements(parseAnnouncementQuery({ status: "scheduled", page: front.next })), /page link/);
    await AnnouncementReceipt.collection.drop();
    const erasureWithoutReceipts = await withRequiredTransaction(session => AnnouncementReceipt.deleteMany({ userId: first._id }, { session }));
    assert.equal(erasureWithoutReceipts.deletedCount, 0);
    assert.equal(await mongoose.connection.db!.listCollections({ name: "announcementreceipts" }).hasNext(), false);
    await mongo.stop();
    await assert.rejects(readAnnouncements(parseAnnouncementQuery({})));

  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
