import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SignJWT } from "jose";

test("notification APIs require authentication, enforce owner scope, and patch preferences safely", { timeout: 240000 }, async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let child;
  let output = "";
  try {
    const uri = mongo.getUri("abii_notifications_http_test");
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const owner = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    await db.collection("users").insertMany([
      { _id: owner, name: "Owner", email: "owner@example.invalid", passwordHash: "never-export-this", emailVerifiedAt: new Date(), sessionVersion: 0, settings: { studyTimezone: "Asia/Manila", targetSubjects: 9, notifications: { flashcards_due: false } } },
      { _id: stranger, name: "Stranger", email: "stranger@example.invalid", passwordHash: "never-export-this", emailVerifiedAt: new Date(), sessionVersion: 0 },
    ]);
    const notificationId = new mongoose.Types.ObjectId();
    const ownNotificationId = new mongoose.Types.ObjectId();
    await db.collection("notifications").insertOne({ _id: notificationId, userId: stranger, type: "badge_unlocked", title: "Private", message: "Private message", target: "/badges", dedupeKey: "foreign:1", metadata: {}, readAt: null, expiresAt: null, createdAt: new Date(), updatedAt: new Date() });
    await db.collection("notifications").insertOne({ _id: ownNotificationId, userId: owner, type: "study_streak", title: "Your reminder", message: "Keep learning.", target: "/progress", dedupeKey: "own:1", metadata: {}, readAt: null, expiresAt: null, createdAt: new Date(), updatedAt: new Date() });
    const secret = "isolated-notification-route-test-secret-at-least-32-characters";
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(String(owner)).setIssuer("abii").setAudience("abii-web").setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    child = spawn(process.execPath, [fileURLToPath(new URL("./topic-test-server.mjs", import.meta.url)), String(port)], {
      cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "development", MONGODB_URI: uri, AUTH_SECRET: secret, NEXT_TELEMETRY_DISABLED: "1" },
    });
    child.stdout.on("data", (data) => { output = (output + data).slice(-12000); });
    child.stderr.on("data", (data) => { output = (output + data).slice(-12000); });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      if (output.includes("Ready in test server")) { ready = true; break; }
      if (child.exitCode !== null) throw new Error(`Next exited: ${output}`);
      await delay(200);
    }
    assert.ok(ready, `Next startup timed out: ${output}`);
    const call = async (path, method = "GET", body, auth = true, origin) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(auth ? { Cookie: `abii_session=${token}` } : {}), ...(origin ? { Origin: origin } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(60000),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null, cache: response.headers.get("cache-control") };
    };

    assert.equal((await call("/api/notifications", "GET", undefined, false)).status, 401);
    const ownList = await call("/api/notifications");
    assert.equal(ownList.status, 200);
    assert.equal(ownList.body.notifications.length, 1);
    assert.equal(ownList.body.notifications[0].id, String(ownNotificationId));
    assert.match(ownList.cache ?? "", /no-store/);
    assert.equal((await call("/api/notifications?group=reminders")).body.notifications.length, 1);
    assert.equal((await call("/api/notifications?group=not-a-group")).status, 400);
    assert.equal((await call(`/api/notifications/${notificationId}`, "PATCH")).status, 404);
    assert.equal((await call("/api/notifications/preferences", "PATCH", { notifications: { study_streak: false } }, true, "https://attacker.invalid")).status, 403);
    const patched = await call("/api/notifications/preferences", "PATCH", { notifications: { study_streak: false }, dailyStudyTime: "09:35" });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.preferences.study_streak, false);
    assert.equal(patched.body.preferences.dailyStudyTime, "09:35");
    const stored = await db.collection("users").findOne({ _id: owner });
    assert.equal(stored.settings.studyTimezone, "Asia/Manila");
    assert.equal(stored.settings.targetSubjects, 9);
    assert.equal((await call("/api/notifications/preferences", "PATCH", { notifications: { account_security: false } })).status, 400);
    assert.equal((await call("/api/notifications", "POST", { type: "badge_unlocked" })).status, 405);
    const exported = await call("/api/data/export");
    assert.equal(exported.status, 200);
    assert.equal(exported.body.notifications.length, 1, "the full account export includes only the authenticated owner's notification history");
    assert.equal(String(exported.body.notifications[0]._id), String(ownNotificationId));
    assert.equal(exported.body.account.settings.notifications.flashcards_due, false, "export includes persisted notification preferences");
    assert.equal(exported.body.account.settings.studyTimezone, "Asia/Manila");
    assert.equal(Object.hasOwn(exported.body.account, "passwordHash"), false, "export excludes password hashes");
    const deletion = await call("/api/account", "DELETE", { confirmation: "DELETE" });
    assert.equal(deletion.status, 200);
    assert.equal(await db.collection("notifications").countDocuments({ userId: owner }), 0);
    assert.equal(await db.collection("users").countDocuments({ _id: owner }), 0);
  } finally {
    if (child && child.exitCode === null) { child.kill(); await new Promise((resolve) => child.once("exit", resolve)); }
    await mongoose.disconnect();
    await mongo.stop();
  }
});
