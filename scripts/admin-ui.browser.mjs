import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { chromium } from "playwright";
import { digest, prepareEnrollment, totpAt } from "../lib/auth/admin-factor-crypto.ts";
import { hashOtp } from "../lib/auth/otp-crypto.ts";

import { buildMetricBatches, metricCollection, reminderCollection, metricTimeIndex, reminderTimeIndex, expiryIndex } from "../lib/performance/storage.ts";
import { emptyDatabase, recordLatency, minute, retentionMs } from "../lib/performance/monitoring.ts";

import { securityTimelineIndex, securityCorrelationIndex } from "../lib/admin/security-contract.ts";
import { securityEvidence } from "../lib/auth/security-evidence.ts";

import { Announcement, AnnouncementReceipt } from "../models/Announcement.ts";
import { Notification } from "../models/Notification.ts";

const destinations = [
  ["", "Overview", "Everything in one view.", "Platform Overview", "overview"],
  ["/users", "Users", "Every learner matters.", "User Directory", "users"],
  ["/analytics", "Analytics", "See how learning grows.", "Platform insights", "analytics"],
  ["/performance", "Performance", "Keep things running smoothly.", "System monitoring", "performance"],
  ["/security", "Security", "Safety in every step.", "Security Overview", "security"],
  ["/announcements", "Announcements", "Keep everyone in the loop.", "Announcement Library", "announcements"],
  ["/support", "Support", "Here to help, always.", "Ticket Conversation", "support"],
  ["/settings", "Settings", "Make every detail count.", "Administrator Settings", "settings"],
];
const widths = [320, 375, 390, 768, 1024, 1280, 1440, 1920];

async function screenshotScrollable(page, path) {
  const width = page.viewportSize().width;
  await page.evaluate(() => { document.querySelector("main").scrollTo(0, 0); window.scrollTo(0, 0); });
  const height = await page.evaluate(() => Math.min(5000, Math.max(innerHeight, document.querySelector("main").scrollHeight + 48)));
  await page.setViewportSize({ width, height });
  await page.screenshot({ path, fullPage: true, animations: "disabled", caret: "initial" });
}

function workspaceGeometry() {
  const main = document.querySelector("main");
  const hero = main.querySelector(".abii-page-hero");
  const mainBox = main.getBoundingClientRect();
  const heroBox = hero.getBoundingClientRect();
  const frame = main.parentElement.parentElement.getBoundingClientRect();
  return {
    frameWidth: frame.width,
    sidebarWidth: mainBox.left - frame.left,
    headerHeight: main.parentElement.querySelector("header").getBoundingClientRect().height,
    canvas: getComputedStyle(main).backgroundColor,
    left: heroBox.left - mainBox.left,
    top: heroBox.top - mainBox.top,
  };
}

function adminHeroGeometry() {
  const main = document.querySelector("main");
  const hero = main.querySelector(".abii-page-hero");
  const image = hero.querySelector("img");
  const art = image.getBoundingClientRect();
  const box = hero.getBoundingClientRect();
  const copy = [...hero.querySelectorAll(".abii-page-hero__title h1, .abii-page-hero__description p")].map(element => element.getBoundingClientRect());
  const panels = Array.from(hero.parentElement.children).slice(1);
  const scale = Math.min(art.width / image.naturalWidth, art.height / image.naturalHeight);
  const visibleHeight = image.naturalHeight * scale;
  const motion = [...hero.querySelectorAll(".abii-enter, .abii-enter-art")].map(el => getComputedStyle(el));
  return {
    fits: main.scrollWidth <= main.clientWidth && document.documentElement.scrollWidth <= innerWidth,
    aligns: panels.every(panel => {
      const rect = panel.getBoundingClientRect();
      return Math.abs(rect.left - box.left) < 1 && Math.abs(rect.right - box.right) < 1;
    }),
    bottomGap: box.bottom - art.bottom,
    preservesFullArtwork: visibleHeight <= art.height + 1 && art.top >= box.top && getComputedStyle(image).objectFit === "contain",
    bottomAligned: getComputedStyle(image).objectPosition.endsWith("100%"),
    height: box.height,
    copyFits: copy.every(rect => rect.top >= box.top && rect.bottom <= box.bottom),
    variant: hero.dataset.variant,
    background: getComputedStyle(hero).backgroundColor,
    still: motion.every(style => style.animationName === "none" && style.transform === "none" && style.opacity === "1"),
  };
}

async function startServer(env, production = false) {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const args = production ? ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)] : ["scripts/topic-test-server.mjs", String(port)];
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ...env, APP_BASE_URL: base, NODE_ENV: production ? "production" : "development", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let output = "";
  let telemetryDropped = false;
  let securityDropped = false;
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => {
    output = (output + chunk).slice(-3000);
    telemetryDropped ||= output.includes("abii.performance.delivery_incomplete");
    securityDropped ||= output.includes("abii.security.evidence_incomplete");
  });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const closed = new Promise(resolve => child.once("exit", resolve));
    child.kill();
    await closed;
  };
  try {
    for (let attempt = 0; attempt < 240; attempt++) {
      if (/Ready in/.test(output)) return { base, stop, telemetryDropped: () => telemetryDropped, securityDropped: () => securityDropped, logs: () => output };
      if (child.exitCode !== null) break;
      await delay(250);
    }
    throw new Error(`Next server did not start: ${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

test("admin routes fail closed, require real MFA, and render the protected workspace", { timeout: 480_000 }, async () => {
  const securityOnly = process.env.ABII_TEST_SECURITY_LOGS_ONLY === "1";
  const announcementsOnly = process.env.ABII_TEST_ANNOUNCEMENTS_ONLY === "1";
  const focusedTargets = process.env.ABII_TEST_ADMIN_TARGETS?.split(",").filter(asset => ["overview", "users", "analytics", "performance", "security", "announcements", "support", "settings"].includes(asset)) ?? [];
  const targetWidths = process.env.ABII_TEST_ADMIN_VIEWPORTS?.split(",").map(Number).filter(Number.isFinite) ?? widths;
  const routeWidths = securityOnly || announcementsOnly || focusedTargets.length ? targetWidths : widths;
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const secret = randomBytes(32).toString("hex");
  const uri = replica.getUri("abii_admin_ui_fixture");
  const env = {
    ABII_SECURITY_EVENTS_ENABLED: "true",
    ABII_ANNOUNCEMENTS_DELIVERY_ENABLED: "true",
    ABII_PERF_COLLECTION: "1", ABII_PERF_MONGODB_URI: replica.getUri("abii_performance_ui_fixture"),
    CRON_SECRET: randomBytes(32).toString("hex"),
    MONGODB_URI: uri, AUTH_SECRET: secret, AUTH_OTP_SECRET: randomBytes(32).toString("hex"),
    ADMIN_MFA_KEY_ID: "fixture", ADMIN_MFA_KEYS: JSON.stringify({ fixture: randomBytes(32).toString("base64") }),
    BREVO_API_KEY: "", BREVO_SENDER_EMAIL: "",
  };
  process.env.ADMIN_MFA_KEY_ID = env.ADMIN_MFA_KEY_ID;
  process.env.ADMIN_MFA_KEYS = env.ADMIN_MFA_KEYS;
  process.env.AUTH_OTP_SECRET = env.AUTH_OTP_SECRET;
  let server;
  let browser;
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const performance = mongoose.connection.getClient().db("abii_performance_ui_fixture");
    const metrics = performance.collection(metricCollection);
    const jobs = performance.collection(reminderCollection);
    await metrics.createIndex({ bucket: -1 }, { name: metricTimeIndex });
    await jobs.createIndex({ startedAt: -1 }, { name: reminderTimeIndex });
    for (const collection of [metrics, jobs]) await collection.createIndex({ expiresAt: 1 }, { name: expiryIndex, expireAfterSeconds: 0 });
    const now = Math.floor(Date.now() / minute) * minute;
    for (const minutesAgo of [4, 9, 14, 19, 24, 29]) {
      const at = now - minutesAgo * minute;
      const database = emptyDatabase();
      recordLatency(database.queries, 22);
      const rows = Array.from({ length: 105 }, (_, index) => ({
        route: index < 100 ? "quiz.answer" : "quiz.finish",
        status: index % 10 === 0 ? 500 : index % 4 === 0 ? 400 : 200,
        ms: index % 10 === 0 ? 250 : 30 + minutesAgo * 2, at, database,
      }));
      await metrics.insertMany(buildMetricBatches(rows));
    }
    const slot = new Date(Math.floor((now - 16 * minute) / (15 * minute)) * 15 * minute);
    await jobs.insertOne({ _id: "fixture-job", source: "scheduled", scheduledAt: slot, startedAt: new Date(+slot + 5000),
      finishedAt: new Date(+slot + 6800), expiresAt: new Date(+slot + retentionMs),
      completion: { outcome: "completed", summary: { examined: 11, created: 3, errors: 0, existing: 8, suppressed: 0, hasMore: false, busy: false, batches: 1 } } });
    await Promise.all([Announcement.syncIndexes(), AnnouncementReceipt.syncIndexes(), Notification.syncIndexes()]);
    const users = db.collection("users");
    const admin = { _id: "primary", name: "Fixture Admin", email: "ui-admin@example.invalid" };
    const learner = { _id: new mongoose.Types.ObjectId(), role: "user", name: "Fixture Learner", email: "ui-learner@example.invalid", profileImage: "https://res.cloudinary.com/abii/image/upload/fixture.png" };
    const password = randomBytes(24).toString("hex");
    const passwordHash = await bcrypt.hash(password, 4);
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    const dayBefore = days => new Date(+midnight - days * 86_400_000);
    const olderId = new mongoose.Types.ObjectId();
    await users.insertMany([
      { ...learner, passwordHash, emailVerifiedAt: new Date(), sessionVersion: 0, createdAt: dayBefore(2) },
      { _id: olderId, name: "Older fixture", role: "user", createdAt: dayBefore(16) },
    ]);
    await db.collection("flashcards").insertOne({ userId: learner._id, flashcardType: "standard", question: "private fixture prompt", createdAt: dayBefore(2) });
    await db.collection("subjects").insertOne({ userId: learner._id, name: "Private analytics subject", createdAt: dayBefore(2) });
    await db.collection("reviewrecords").insertMany([
      { userId: learner._id, reviewedAt: dayBefore(2), result: "correct" },
      { userId: olderId, reviewedAt: dayBefore(16), result: "wrong" },
    ]);
    const quizTime = new Date(+midnight - 1000);
    await db.collection("quizsessions").insertOne({ userId: learner._id, status: "completed", type: "random",
      completedAt: quizTime, expiresAt: new Date(+quizTime + 86_400_000),
      questions: [{ type: "multiple-choice", prompt: "Private analytics quiz" }] });
    const { encryptedSeed, seed } = prepareEnrollment("admin:primary");
    await db.collection("admins").insertOne({
      ...admin, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date(), updatedAt: new Date(),
      status: "active", sessionVersion: 0, recoveryCodes: Array.from({ length: 8 }, (_, index) => digest(String(index))),
      mfa: { encryptedSeed, lastStep: Math.floor(Date.now() / 30_000) - 2, completedChallenges: [] },
    });
    await db.createCollection("adminauditlogs");
    await db.createCollection("adminsecurityevents");
    await db.collection("adminsecurityevents").insertOne({ _id: "fixture-recovery", kind: "recovery-denied", occurredAt: dayBefore(2) });
    const auditLogs = db.collection("adminauditlogs");
    const securityEvents = db.collection("adminsecurityevents");
    for (const collection of [auditLogs, securityEvents]) await collection.createIndex({ occurredAt: -1, _id: -1 }, { name: securityTimelineIndex });
    await auditLogs.createIndex({ correlationId: 1 }, { name: securityCorrelationIndex });
    await securityEvents.createIndex({ occurredAt: 1 }, { expireAfterSeconds: 90 * 86400 });
    const auditAt = new Date(Date.now() - 20 * minute);
    const securityCorrelation = "61db623c-dc64-4c6b-9d92-f27e02ab688e";
    await auditLogs.insertMany(Array.from({ length: 23 }, (_, index) => ({
      action: index === 0 ? "user.restore" : "user.suspend", actorId: "admin:primary",
      targetId: "61db623cdc644c6b9d92f27e", outcome: "committed", occurredAt: auditAt,
      ...(index === 0 ? { correlationId: securityCorrelation } : {}), reason: "restricted fixture reason",
    })));
    const securitySlot = new Date(Math.floor(Date.now() / (5 * minute)) * 5 * minute - 10 * minute);
    await securityEvents.insertOne({ ...securityEvidence({ kind: "rate-limited", scope: "login" }, securitySlot), count: 27 });

    const outageUri = replica.getUri("abii_telemetry_outage_learner_fixture");
    const outageDb = mongoose.connection.getClient().db("abii_telemetry_outage_learner_fixture");
    const quizLearner = new mongoose.Types.ObjectId();
    const quizSubject = new mongoose.Types.ObjectId();
    await outageDb.collection("users").insertOne({ _id: quizLearner, role: "user", name: "Outage fixture",
      email: "phase7-outage@example.invalid", emailVerifiedAt: new Date(), sessionVersion: 0 });
    await outageDb.collection("subjects").insertOne({ _id: quizSubject, userId: quizLearner, name: "Outage fixture" });
    await outageDb.collection("flashcards").insertOne({ userId: quizLearner, subjectId: quizSubject, flashcardType: "standard",
      question: "Fixture prompt", answer: "Durable" });
    server = await startServer({ ...env, MONGODB_URI: outageUri, ABII_ADMIN_UI_ENABLED: "",
      ABII_PERF_MONGODB_URI: "mongodb://127.0.0.1:1/abii_unreachable_fixture" }, process.env.ABII_TEST_PRODUCTION_GATE === "1");
    for (const suffix of ["", "/settings", "/analytics", "/performance", "/security", "/announcements"]) {
      const closed = await fetch(server.base + "/admin" + suffix);
      assert.equal(closed.status, 404);
      assert.match(closed.headers.get("cache-control"), /private.*no-store/);
    }
    if (!focusedTargets.length) {
    const learnerToken = await new SignJWT({ sv: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(String(quizLearner))
      .setIssuedAt().setExpirationTime("10m").setIssuer("abii").setAudience("abii-web").sign(new TextEncoder().encode(secret));
    const quizPost = (path, body) => fetch(server.base + path, {
      method: "POST", headers: { Cookie: `abii_session=${learnerToken}`, Origin: server.base, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const startedQuiz = await quizPost("/api/quiz/start", { scope: "all", type: "identification" });
    assert.equal(startedQuiz.status, 201);
    const { sessionId } = await startedQuiz.json();
    const sessionPath = `/api/quiz/${sessionId}`;
    for (let round = 1; round <= 3; round++) {
      const answer = await quizPost(sessionPath + "/answer", { questionIndex: round - 1, answer: "Durable" });
      assert.equal(answer.status, 200);
      assert.equal((await answer.json()).result.correct, true);
      const finished = await quizPost(sessionPath + "/finish", {});
      assert.equal(finished.status, 200);
      const result = await finished.json();
      assert.equal(round < 3 ? result.retry : result.transitioned, true);
    }
    assert.equal(await outageDb.collection("quizsessions").countDocuments({ userId: quizLearner, status: "completed" }), 1);
    const outageReminder = await fetch(server.base + "/api/internal/notifications/reminders", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    assert.equal(outageReminder.status, 200);
    for (let attempt = 0; attempt < 32 && !server.telemetryDropped(); attempt++) await delay(250);
    assert.equal(server.telemetryDropped(), true);
    }

    const learnerDetailPath = `/api/admin/users/${learner._id}`;
    assert.equal((await fetch(server.base + learnerDetailPath)).status, 404);
    await server.stop();
    server = await startServer({ ...env, ABII_ADMIN_UI_ENABLED: "true" }, process.env.ABII_TEST_ADMIN_PRODUCTION === "1");
    const base = server.base;
    const denied = async (suffix, message, cookie, rsc = false) => {
      const response = await fetch(base + "/admin" + suffix, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...(rsc ? { RSC: "1", "Next-Router-Prefetch": "1" } : {}) } });
      const body = await response.text();
      // Next's development renderer can replace the middleware header with its own no-store policy.
      assert.match(response.headers.get("cache-control"), /\bno-store\b/);
      assert.ok(body.includes(message), `Expected ${message} on /admin${suffix}`);
      for (const [, , headline, region, asset] of destinations) {
        assert.ok(!body.includes(headline));
        assert.ok(!body.includes(region));
        assert.ok(!body.includes(`admin-${asset}.png`));
      }
      assert.ok(!body.includes(admin.name));
    };
    for (const [suffix] of destinations) await denied(suffix, "Sign in to continue");
    await denied("/security", "Sign in to continue", undefined, true);

    const executablePath = [
      chromium.executablePath(), process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ].find(path => path && existsSync(path));
    browser = await chromium.launch({ headless: true, executablePath });
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const pageErrors = [];
    const networkErrors = [];
    page.on("pageerror", error => pageErrors.push(`${error.message} at ${new URL(page.url()).pathname}: ${error.stack ?? "no stack"}`));
    page.on("console", message => { if (message.type() === "error") pageErrors.push(`${message.text()} at ${new URL(page.url()).pathname}`); });
    page.on("requestfailed", request => networkErrors.push(`${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText ?? "failed"}`));
    page.on("response", response => { if (response.status() >= 400 && /_next|admin\/announcements|api\/admin/.test(response.url())) networkErrors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const post = (path, data) => context.request.post(base + path, { data, headers: { Origin: base } });

    const wrong = "fixture wrong password";
    assert.equal((await post("/api/auth/login", { email: learner.email, password: wrong })).status(), 401);
    assert.equal((await post("/api/auth/login", { email: admin.email, password: wrong })).status(), 401);
    const key = createHmac("sha256", env.AUTH_OTP_SECRET).update(JSON.stringify(["login", "limited@example.invalid"])).digest("hex");
    await db.collection("authratelimits").insertOne({ key, window: Math.floor(Date.now() / (60 * minute)), count: 10, expiresAt: new Date(Date.now() + 60 * minute) });
    assert.equal((await post("/api/auth/login", { email: "limited@example.invalid", password: wrong })).status(), 429);
    const login = await post("/api/auth/login", { email: learner.email, password });
    assert.equal(login.status(), 200);
    const learnerCookie = (await context.cookies()).find(cookie => cookie.name === "abii_session");
    const malformedAnswer = await context.request.post(base + "/api/quiz/fixture-invalid-session/answer", {
      headers: { Origin: base, "Content-Type": "application/json" }, data: Buffer.from("{"),
    });
    assert.equal(malformedAnswer.status(), 400);
    assert.match((await malformedAnswer.json()).error, /check your answer/i);
    const privateReminderPath = base + "/api/internal/notifications/reminders";
    assert.equal((await context.request.get(privateReminderPath)).status(), 401);
    assert.equal((await context.request.get(privateReminderPath, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })).status(), 200);
    const malformedMetric = { "rows.0.route": "quiz.answer", "rows.0.requests.clientErrors": 1, "rows.0.requests.latency.count": 1 };
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await metrics.countDocuments(malformedMetric) && await jobs.countDocuments({ source: "private", finishedAt: { $exists: true } })) break;
      await delay(250);
    }
    assert.equal(await metrics.countDocuments(malformedMetric), 1);
    assert.equal(await jobs.countDocuments({ source: "private", finishedAt: { $exists: true } }), 1);
    assert.doesNotMatch(JSON.stringify(await metrics.findOne(malformedMetric)), /fixture-invalid-session|ui-learner@/);
    assert.equal((await fetch(base + learnerDetailPath)).status, 401);
    assert.equal((await context.request.get(base + learnerDetailPath)).status(), 403);
    assert.ok(learnerCookie);
    const previewRequest = { action: "preview", title: "Fixture", message: "Fixture" };
    assert.equal((await post("/api/admin/announcements", previewRequest)).status(), 403);
    for (const [suffix] of destinations) await denied(suffix, "Administrator access required", `abii_session=${learnerCookie.value}`);
    let shellGeometry;
    await context.clearCookies();

    const adminPassword = await post("/api/auth/login", { email: admin.email, password });
    assert.equal(adminPassword.status(), 202);
    const pending = (await context.cookies()).find(cookie => cookie.name === "abii_admin_pending");
    assert.ok(pending);
    for (const [suffix] of destinations) await denied(suffix, "Sign in to continue", `abii_admin_pending=${pending.value}`);
    const signed = (audience, expired) => {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({ sv: 0, amr: ["pwd", "otp"] }).setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" })
        .setSubject("admin:primary").setIssuer("abii").setAudience(audience)
        .setIssuedAt(now - 60).setExpirationTime(now + (expired ? -1 : 300)).sign(new TextEncoder().encode(secret));
    };
    await denied("", "Sign in to continue", `abii_admin=${await signed("abii-web", false)}`);
    await denied("", "Sign in to continue", `abii_admin=${await signed("abii-admin", true)}`);
    await denied("/analytics?period=90", "Sign in to continue", `abii_admin=${await signed("abii-admin", true)}`);

    const incorrect = String((Number(totpAt(seed, Date.now())) + 1) % 1_000_000).padStart(6, "0");
    assert.equal((await post("/api/auth/admin-mfa", { code: incorrect })).status(), 401);
    assert.equal((await post("/api/auth/admin-mfa", { code: totpAt(seed, Date.now()) })).status(), 200);
    const expectedEvidence = ["learner-login", "learner-login-denied", "login-denied", "mfa-denied"];
    for (let attempt = 0; attempt < 40; attempt++) {
      if ((await securityEvents.distinct("kind", { format: 2, kind: { $in: expectedEvidence } })).length === expectedEvidence.length) break;
      await delay(250);
    }
    for (const kind of expectedEvidence) {
      const record = await securityEvents.findOne({ format: 2, kind });
      assert.ok(record, kind);
      assert.equal(record.actorId, kind === "learner-login" ? String(learner._id) : undefined);
      assert.doesNotMatch(JSON.stringify(record), /@example\.invalid|fixture wrong password/);
    }
    assert.ok(await securityEvents.countDocuments({ format: 2, kind: "rate-limited", occurredAt: { $gt: securitySlot } }));
    assert.equal(await auditLogs.countDocuments({ action: "login", actorId: "admin:primary", outcome: "committed" }), 1);
    const adminCookie = (await context.cookies()).find(cookie => cookie.name === "abii_admin");
    assert.ok(adminCookie);
    assert.equal((await fetch(base + "/api/admin/overview?period=30")).status, 401);
    const overviewResponse = await context.request.get(base + "/api/admin/overview?period=7");
    assert.equal(overviewResponse.status(), 200);
    assert.match(overviewResponse.headers()["cache-control"], /private, no-store/);
    assert.equal((await overviewResponse.json()).window.days, 7);
    assert.equal((await context.request.get(base + "/api/admin/overview?period=365")).status(), 400);
    const renderDestinations = focusedTargets.length ? destinations.filter(item => focusedTargets.includes(item[4])) :
      securityOnly || announcementsOnly ? destinations.filter(item => item[4] === (securityOnly ? "security" : "announcements")) : destinations;
    for (const [suffix, label, headline, region, asset] of renderDestinations) {
      await page.setViewportSize({ width: focusedTargets.length && targetWidths.includes(1440) ? 1440 : 1920, height: 951 });
      const response = await page.goto(base + "/admin" + suffix, { waitUntil: "domcontentloaded", timeout: 90_000 });
      assert.equal(response.status(), 200, `${label} route response`);
      assert.match(response.headers()["cache-control"], /\bno-store\b/);
      try { await page.getByRole("heading", { level: 1, name: headline }).waitFor(); }
      catch (error) {
        const serverDiagnostics = server.logs().split(/\r?\n/).filter(line => /Mongo|timeout|timed out|Functions cannot|serializ|Error:/i.test(line))
          .map(line => line.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[database URI redacted]").replace(/[\w.+-]+@[\w.-]+/g, "[email redacted]")).slice(-12);
        const headings = (await page.locator("main h1").allTextContents()).map(value => value.slice(0, 100));
        const headingState = await page.locator("main h1").evaluateAll(nodes => nodes.map(node => {
          const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
          return { text: node.textContent?.trim().slice(0, 100), display: style.display, visibility: style.visibility, opacity: style.opacity,
            rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)], animation: style.animationName };
        }));
        throw new Error(`${label} route shell missing expected heading; response=${response.status()}, headings=${JSON.stringify(headings)}, state=${JSON.stringify(headingState)}, browserErrors=${pageErrors.slice(-6).join(" | ") || "none"}, serverDiagnostics=${serverDiagnostics.join(" | ") || "none"}`, { cause: error });
      }
      await page.getByRole("heading", { name: region, exact: true }).waitFor();
      const shellSurfaces = await page.evaluate(() => [".admin-shell", ".admin-shell__frame", ".admin-shell__sidebar", ".admin-shell__header", ".admin-shell__workspace"]
        .map(selector => getComputedStyle(document.querySelector(selector)).backgroundColor));
      assert.deepEqual(shellSurfaces, ["rgb(255, 244, 248)", ...Array(4).fill("rgb(255, 249, 252)")], `${label} shell surfaces use the admin frame and workspace backgrounds`);
      if (asset === "announcements") {
        await page.getByRole("heading", { name: "No announcement selected", exact: true }).waitFor();
        const panels = await page.evaluate(() => ["Announcement Library", "Announcement Details"].map(title => {
          const panel = [...document.querySelectorAll('[data-admin-panel="true"]')].find(node => [...node.querySelectorAll("h2, h3")].some(heading => heading.textContent?.trim() === title));
          if (!panel) return null;
          const rect = panel.getBoundingClientRect(); return [rect.top, rect.bottom];
        }));
        assert.ok(panels.every(Boolean) && Math.abs(panels[0][0] - panels[1][0]) < 2 && Math.abs(panels[0][1] - panels[1][1]) < 2,
          `Announcement panels align with no selection: ${JSON.stringify(panels)}`);
      }
      if (asset === "support") await page.getByRole("heading", { name: "No ticket selected", exact: true }).waitFor();
      if (asset === "performance") {
        const pairedPanels = await page.evaluate(() => [["API Response Latency", "Service Status"], ["Request Volume", "Latency Distribution"], ["Database Performance", "Reminder Jobs"]].map(pair => pair.map(title => {
          const panel = [...document.querySelectorAll('[data-admin-panel="true"]')].find(node => [...node.querySelectorAll("h2, h3")].some(heading => heading.textContent?.trim() === title));
          if (!panel) return null;
          const rect = panel.getBoundingClientRect(); return [rect.top, rect.bottom];
        })));
        assert.ok(pairedPanels.flat().every(Boolean) && pairedPanels.every(([left, right]) => Math.abs(left[0] - right[0]) < 2 && Math.abs(left[1] - right[1]) < 2),
          `Performance panels stretch to row height: ${JSON.stringify(pairedPanels)}`);
      }
      assert.equal(await page.locator("main summary").filter({ hasText: /view .* data/i }).count(), 0, `${label} has no chart-data disclosure`);
      if (asset === "users") assert.ok(await page.locator("main [role=img]").count() > 0, "the account verification ECharts donut is present");
      if (asset === "analytics") {
        try { await page.locator("#analytics-growth").waitFor(); }
        catch (error) {
          const serialization = server.logs().split(/\r?\n/).filter(line => /Functions cannot be passed|Only plain objects|serializ|Server Components render|Error:/i.test(line)).slice(-12);
          throw new Error(`Analytics report did not render; browser errors: ${pageErrors.slice(-8).join(" | ") || "none"}; server diagnostics: ${serialization.join(" | ") || "no matching server error"}`, { cause: error });
        }
        const charts = await page.locator("main [role=img]").count();
        assert.ok(charts >= 8, `analytics ECharts include KPI trends and statistical panels (found ${charts})`);
        if (page.viewportSize().width >= 1100) {
          const before = await page.evaluate(() => {
            const main = document.querySelector("main"), header = document.querySelector(".admin-shell__header"), sidebar = document.querySelector(".admin-shell__sidebar");
            const box = element => { const rect = element.getBoundingClientRect(); return [rect.left, rect.top, rect.right, rect.bottom]; };
            return { document: [document.documentElement.scrollHeight, document.documentElement.clientHeight], main: [main.clientHeight, main.scrollHeight], header: box(header), sidebar: box(sidebar), maxScroll: main.scrollHeight - main.clientHeight };
          });
          assert.ok(before.document[0] <= before.document[1] + 1, `Analytics document stays within the viewport: ${JSON.stringify(before)}`);
          assert.ok(before.main[1] > before.main[0], "Analytics content uses the internal workspace scroll area");
          const mainBox = await page.locator("main").boundingBox();
          await page.mouse.move(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height / 2);
          await page.mouse.wheel(0, 650);
          await page.waitForFunction(() => document.querySelector("main").scrollTop > 0, undefined, { timeout: 3_000 });
          const after = await page.evaluate(() => {
            const main = document.querySelector("main"), box = element => { const rect = element.getBoundingClientRect(); return [rect.left, rect.top, rect.right, rect.bottom]; };
            return { scrollTop: main.scrollTop, windowScrollY: window.scrollY, header: box(document.querySelector(".admin-shell__header")), sidebar: box(document.querySelector(".admin-shell__sidebar")) };
          });
          assert.ok(after.scrollTop > 0 && after.windowScrollY === 0, `Workspace alone scrolls: ${JSON.stringify(after)}`);
          assert.deepEqual(after.header, before.header, "Analytics header stays stationary while workspace scrolls");
          assert.deepEqual(after.sidebar, before.sidebar, "Analytics sidebar stays stationary while workspace scrolls");
          if (process.env.ABII_ADMIN_SCREENSHOTS) await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "analytics-workspace-scrolled-1440.png"), animations: "disabled" });
          await page.evaluate(() => { const main = document.querySelector("main"); main.scrollTop = main.scrollHeight; });
          await page.mouse.wheel(0, 900);
          await page.waitForTimeout(100);
          assert.equal(await page.evaluate(() => window.scrollY), 0, "Reaching the end of Analytics does not scroll the document");
        }
      }
      if (asset === "overview") {
        await page.waitForTimeout(250);
        const charts = await page.evaluate(() => ["user-growth", "learning-activity"].map(id => {
          const heading = document.getElementById(id), card = heading.parentElement, host = card.querySelector('[role="img"]'), canvas = host?.querySelector("canvas");
          if (!host || !canvas) return { id, host: host && [host.clientWidth, host.clientHeight], canvas: null, pinkMarks: 0, card: null };
          const context = canvas.getContext("2d");
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let pinkMarks = 0;
          for (let index = 0; index < pixels.length; index += 4) if (pixels[index + 3] > 20 && pixels[index] > 190 && pixels[index + 1] > 70 && pixels[index + 1] < pixels[index] && pixels[index + 2] > 120) pinkMarks++;
          const rect = card.getBoundingClientRect();
          return { id, host: [host.clientWidth, host.clientHeight], canvas: [canvas.width, canvas.height], pinkMarks, card: [rect.top, rect.bottom] };
        }));
        for (const chart of charts) {
          assert.ok(chart.host[0] > 0 && chart.host[1] >= 220, `${chart.id} visualization has stable dimensions: ${JSON.stringify(chart)}`);
          assert.ok(chart.canvas[0] > 0 && chart.canvas[1] > 0 && chart.pinkMarks > 10, `${chart.id} canvas renders chart marks: ${JSON.stringify(chart)}`);
        }
        assert.ok(Math.abs(charts[0].card[0] - charts[1].card[0]) < 2 && Math.abs(charts[0].card[1] - charts[1].card[1]) < 2,
          `Overview charts align in the desktop grid: ${JSON.stringify(charts.map(chart => chart.card))}`);
        if (process.env.ABII_ADMIN_SCREENSHOTS && page.viewportSize().width >= 1100) {
          await page.evaluate(() => {
            const main = document.querySelector("main"), card = document.getElementById("user-growth").parentElement;
            main.scrollTop += card.getBoundingClientRect().top - main.getBoundingClientRect().top - 70;
          });
          await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "overview-charts-1440.png"), animations: "disabled" });
        }
      }
      if (["analytics", "performance"].includes(asset)) {
        await page.waitForFunction(() => [...document.querySelectorAll("main [role=img] canvas")].some(canvas => canvas.width > 0 && canvas.height > 0));
      }
      if (asset === "performance") assert.ok(await page.locator("main [role=img]").count() >= 7, "performance ECharts include KPI trends and telemetry panels");
      assert.equal(await page.getByRole("navigation", { name: "Admin navigation" }).locator('[aria-current="page"]').innerText(), label);
      const image = page.locator(`main img[src*="admin-${asset}.png"]`);
      await image.evaluate(element => element.decode());
      const desktopHero = await page.evaluate(adminHeroGeometry);
      assert.equal(desktopHero.variant, "admin-overview", `${label} desktop hero uses the shared component variant`);
      assert.equal(desktopHero.background, "rgb(255, 232, 239)", `${label} hero uses the approved secondary admin surface`);
      assert.ok(desktopHero.height >= 204 && desktopHero.height < 304, `${label} desktop hero height: ${desktopHero.height}`);
      const geometry = await page.evaluate(workspaceGeometry);
      shellGeometry ??= geometry;
      if (asset === "overview") assert.equal(geometry.left, 24, "admin Overview keeps the established workspace inset");
      assert.deepEqual(geometry, shellGeometry, `${label} desktop shell geometry`);
      if (asset === "security") await page.getByRole("heading", { name: "Security & Audit Explorer" }).waitFor();
      if (asset === "performance") await page.getByRole("heading", { name: "Endpoint performance" }).waitFor();
      if (process.env.ABII_ADMIN_SCREENSHOTS && process.env.ABII_TEST_ADMIN_LAYOUT_ONLY !== "1") {
        await screenshotScrollable(page, join(process.env.ABII_ADMIN_SCREENSHOTS, `admin-${asset}-full-1440.png`));
      }
      assert.equal(await image.getAttribute("alt"), "");

      if (!["overview", "users", "analytics", "performance", "security", "announcements", "support", "settings"].includes(asset)) assert.equal(await page.locator("main table, main input, main select").count(), 0);
      assert.ok(!(await page.locator("main").innerText()).includes(admin.email));
      for (const width of routeWidths) {
        await page.setViewportSize({ width, height: 880 });
        if (["overview", "users", "analytics", "performance"].includes(asset)) {
          try {
            await page.waitForFunction(() => [...document.querySelectorAll("main [role=img]")].every(host => {
              const canvas = host.querySelector("canvas");
              return !canvas || Math.abs(canvas.getBoundingClientRect().width - host.clientWidth) < 2;
            }), undefined, { timeout: 5_000 });
          } catch (error) {
            const charts = await page.locator("main [role=img]").evaluateAll(hosts => hosts.map(host => {
              const canvas = host.querySelector("canvas"); const hostRect = host.getBoundingClientRect(); const canvasRect = canvas?.getBoundingClientRect();
              return { label: host.getAttribute("aria-label"), host: [Math.round(hostRect.width), host.clientWidth],
                canvas: canvasRect && [Math.round(canvasRect.width), canvas.width, canvas.height] };
            }));
            throw new Error(`${label} ECharts did not resize to ${width}px: ${JSON.stringify(charts)}`, { cause: error });
          }
        }
        if (asset === "overview" && process.env.ABII_ADMIN_SCREENSHOTS && [320, 390, 768].includes(width)) {
          await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `admin-overview-${width}.png`), animations: "disabled" });
        }
        if (focusedTargets.length && process.env.ABII_ADMIN_SCREENSHOTS) await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `admin-${asset}-${width}.png`), animations: "disabled" });
        const geometry = await page.evaluate(adminHeroGeometry);
        if (!geometry.fits) {
          geometry.overflow = await page.evaluate(() => {
            const main = document.querySelector("main");
            return { viewport: [innerWidth, document.documentElement.scrollWidth, main.clientWidth, main.scrollWidth],
              elements: [...main.querySelectorAll("*")].filter(el => el.scrollWidth > el.clientWidth + 1 &&
                !el.closest("[role=region][tabindex]")).sort((a, b) => (b.scrollWidth - b.clientWidth) - (a.scrollWidth - a.clientWidth)).slice(0, 12).map(el => {
                const ancestors = [];
                for (let node = el; node && node !== main && ancestors.length < 6; node = node.parentElement) {
                  const rect = node.getBoundingClientRect();
                  ancestors.push([node.tagName, String(node.className).slice(0, 80), Math.round(rect.left), Math.round(rect.right), node.scrollWidth, node.clientWidth]);
                }
                return ancestors;
              }) };
          });
        }
        const expectedHeroHeight = width < 640 ? 168 : width < 1024 ? 188 : 204;
        assert.equal(geometry.variant, "admin-overview", `${label} uses the shared admin hero variant`);
        assert.ok(geometry.height >= expectedHeroHeight, `${label} hero height at ${width}px: ${geometry.height}`);
        assert.ok(Object.entries(geometry).every(([key, value]) => key === "bottomGap" ? value >= 0 && value <= 4 : ["height", "variant", "background"].includes(key) || key === "overflow" ? true : value), `${label} at ${width}px: ${JSON.stringify(geometry)}; browserErrors=${pageErrors.slice(-6).join(" | ") || "none"}`);
      }
    }

    if (process.env.ABII_TEST_ADMIN_LAYOUT_ONLY === "1" && focusedTargets.includes("performance")) {
      await metrics.deleteMany({});
      await jobs.deleteMany({});
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(base + "/admin/performance?period=1h", { waitUntil: "domcontentloaded", timeout: 30_000 });
      const monitoring = page.getByRole("region", { name: "System monitoring" });
      await monitoring.getByRole("heading", { name: "API Response Latency", exact: true }).waitFor();
      await monitoring.getByRole("heading", { name: "No telemetry collected for this period.", exact: true }).first().waitFor();
      const pairedPanels = await page.evaluate(() => [["API Response Latency", "Service Status"], ["Request Volume", "Latency Distribution"], ["Database Performance", "Reminder Jobs"]].map(pair => pair.map(title => {
        const panel = [...document.querySelectorAll('[data-admin-panel="true"]')].find(node => [...node.querySelectorAll("h2, h3")].some(heading => heading.textContent?.trim() === title));
        if (!panel) return null;
        const rect = panel.getBoundingClientRect(); return [rect.top, rect.bottom];
      })));
      assert.ok(pairedPanels.flat().every(Boolean) && pairedPanels.every(([left, right]) => Math.abs(left[0] - right[0]) < 2 && Math.abs(left[1] - right[1]) < 2),
        `Empty Performance panels stretch to row height: ${JSON.stringify(pairedPanels)}`);
      if (process.env.ABII_ADMIN_SCREENSHOTS) await screenshotScrollable(page, join(process.env.ABII_ADMIN_SCREENSHOTS, "performance-empty-full-1440.png"));
      assert.deepEqual(pageErrors, []);
      return;
    }
    if (process.env.ABII_TEST_ADMIN_LAYOUT_ONLY === "1") {
      assert.deepEqual(pageErrors, []);
      return;
    }

    if (focusedTargets.length === 1 && focusedTargets[0] === "performance") {
      await page.goto(base + "/admin/performance", { waitUntil: "domcontentloaded" });
      const monitoring = page.getByRole("region", { name: "System monitoring" });
      await monitoring.getByText(/Coverage\./).waitFor();
      for (const title of ["API Response Latency", "Service Status", "Request Volume", "Latency Distribution", "Endpoint performance", "Database Performance", "Reminder Jobs", "Recent Incidents"]) {
        await monitoring.getByRole("heading", { name: title, exact: true }).waitFor();
      }
      await page.waitForFunction(() => [...document.querySelectorAll("main [role=img] canvas")].some(canvas => canvas.width > 0 && canvas.height > 0));
      assert.ok(await monitoring.getByRole("img").count() >= 7, "performance KPIs and statistical panels use ECharts");
      await monitoring.getByRole("rowheader", { name: /Submit answer/ }).waitFor();
      await monitoring.getByText(/11 examined/).waitFor();
      await monitoring.getByText("Elevated server errors").waitFor();
      for (const [period, label] of [["1h", "1 hour"], ["24h", "24 hours"], ["7d", "7 days"]]) {
        await monitoring.getByRole("link", { name: label }).click();
        await page.waitForURL(`**/admin/performance?period=${period}`);
        assert.equal(await monitoring.getByRole("link", { name: label }).getAttribute("aria-current"), "page");
      }
      const slider = monitoring.getByRole("slider", { name: "API latency interval values" });
      await slider.focus();
      await slider.press("End");
      assert.match(await slider.getAttribute("aria-valuetext"), /samples?/);
      for (const width of targetWidths) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= document.querySelector("main").clientWidth), `Performance fits at ${width}px`);
        if (process.env.ABII_ADMIN_SCREENSHOTS && [320, 375, 1440].includes(width)) {
          await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector("main")?.scrollTo(0, 0); });
          await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `performance-${width}.png`), animations: "disabled" });
        }
      }
      assert.deepEqual(pageErrors, []);
      return;
    }

    if (focusedTargets.length === 1 && focusedTargets[0] === "overview") {
      assert.deepEqual(pageErrors, []);
      return;
    }

    if (focusedTargets.length === 1 && focusedTargets[0] === "analytics") {
      const analytics = page.getByRole("region", { name: "Platform insights" });
      const periods = analytics.getByRole("navigation", { name: "Reporting period" });
      const signupChart = analytics.getByRole("slider", { name: "Growth and engagement daily values" });
      const metricValue = label => analytics.locator("dt").filter({ hasText: new RegExp(`^${label}$`, "i") }).locator("..").locator("dd > p").first();
      assert.equal(await periods.getByRole("link", { name: "30 days" }).getAttribute("aria-current"), "page");
      assert.equal(await metricValue("New users").textContent(), "2");
      await periods.getByRole("link", { name: "7 days" }).click();
      await page.waitForURL("**/admin/analytics?period=7");
      assert.equal(await metricValue("New users").textContent(), "1");
      assert.equal(await signupChart.getAttribute("aria-valuemax"), "7");
      await users.insertMany(Array.from({ length: 11 }, (_, index) => {
        const createdAt = dayBefore(8 + index * 7);
        return { _id: new mongoose.Types.ObjectId(), role: "user", email: `retention-${index}@example.invalid`, createdAt, emailVerifiedAt: createdAt };
      }));
      const growth = analytics.getByRole("region", { name: "Growth & Engagement", exact: true });
      const chartCanvas = growth.locator("canvas").first();
      await chartCanvas.scrollIntoViewIfNeeded();
      const canvasBounds = await chartCanvas.boundingBox();
      assert.ok(canvasBounds && canvasBounds.width > 0 && canvasBounds.height > 0, "growth chart canvas has a measurable size");
      await chartCanvas.hover({ position: { x: canvasBounds.width * 0.84, y: canvasBounds.height * 0.5 } });
      const tooltip = growth.locator(".abii-echart-tooltip").first();
      await tooltip.waitFor({ state: "visible", timeout: 5_000 });
      assert.match(await tooltip.innerText(), /UTC/);
      assert.equal(await analytics.locator("summary").filter({ hasText: /view .* data/i }).count(), 0, "chart data disclosure controls are removed");
      await signupChart.focus();
      await signupChart.press("Home");
      await signupChart.press("ArrowRight");
      assert.equal(await signupChart.getAttribute("aria-valuenow"), "2");
      assert.match(await signupChart.getAttribute("aria-valuetext"), /Active learners .* New users/,
        "keyboard inspection continues to expose chart series values");
      await periods.getByRole("link", { name: "90 days" }).click();
      await page.waitForURL("**/admin/analytics?period=90");
      assert.equal(await periods.getByRole("link", { name: "90 days" }).getAttribute("aria-current"), "page");
      assert.equal(await signupChart.getAttribute("aria-valuemax"), "90");
      const retention = analytics.getByRole("region", { name: "Retention cohort matrix" });
      for (const width of targetWidths) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth &&
          document.querySelector("main").scrollWidth <= document.querySelector("main").clientWidth, undefined, { timeout: 3_000 }).catch(() => {});
        const pageFit = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
          main: [document.querySelector("main").clientWidth, document.querySelector("main").scrollWidth],
          overflow: [...document.querySelector("main").querySelectorAll("*")].filter(node => node.scrollWidth > node.clientWidth + 1 && !node.closest("[role=region][tabindex]")).slice(0, 8).map(node => [node.tagName, node.id, String(node.className).slice(0, 70), node.scrollWidth, node.clientWidth]) }));
        assert.ok(pageFit.document <= width && pageFit.main[1] <= pageFit.main[0], `Analytics fits at ${width}px: ${JSON.stringify(pageFit)}`);
        if (width === 375) {
          const matrix = await retention.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth,
            table: element.querySelector("table").getBoundingClientRect().width, page: document.documentElement.scrollWidth, viewport: innerWidth }));
          assert.ok(matrix.scroll === matrix.client, `retention matrix fits at 375px: ${JSON.stringify(matrix)}`);
        }
        if (process.env.ABII_ADMIN_SCREENSHOTS && [375, 1440].includes(width)) {
          await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector("main")?.scrollTo(0, 0); });
          await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `analytics-viewport-${width}.png`), animations: "disabled" });
        }
      }
      assert.equal(/Functions cannot be passed to Client Component props|Only plain objects can be passed to Client Components/i.test(server.logs()), false,
        "server-rendered analytics route does not pass chart callbacks through React Flight");
      assert.deepEqual(pageErrors, []);
      return;
    }

    if (focusedTargets.length === destinations.length) {
      assert.deepEqual(pageErrors, []);
      return;
    }

    if (!securityOnly && !announcementsOnly && !focusedTargets.length) {
      assert.equal((await fetch(base + "/api/admin/settings")).status, 401);
      assert.equal((await context.request.post(base + "/api/admin/settings", { headers: { Origin: "https://outside.invalid" }, data: { action: "profile" } })).status(), 403);
      await page.goto(base + "/admin/settings", { waitUntil: "domcontentloaded" });
      const settingsPost = () => page.waitForResponse(response => response.url().endsWith("/api/admin/settings") && response.request().method() === "POST");
      const displayName = page.getByLabel("Display name");
      await displayName.fill("Settings Fixture Admin");
      const profileRequest = settingsPost();
      await page.getByRole("button", { name: "Save profile" }).click();
      assert.equal((await profileRequest).status(), 200);
      await page.getByText("Saved successfully.").waitFor();
      assert.equal((await db.collection("admins").findOne({ _id: "primary" })).name, "Settings Fixture Admin");
      await page.reload();
      assert.equal(await page.getByLabel("Display name").inputValue(), "Settings Fixture Admin");
      await page.getByLabel("Warn before this session expires").uncheck();
      const preferencesRequest = settingsPost();
      await page.getByRole("button", { name: "Save preferences" }).click();
      assert.equal((await preferencesRequest).status(), 200);
      await page.getByLabel("Server-error threshold").selectOption("10");
      const monitoringRequest = settingsPost();
      await page.getByRole("button", { name: "Save monitoring alerts" }).click();
      assert.equal((await monitoringRequest).status(), 200);
      await displayName.fill("Settings Final Admin");
      const sequentialProfileRequest = settingsPost();
      await page.getByRole("button", { name: "Save profile" }).click();
      assert.equal((await sequentialProfileRequest).status(), 200);
      await page.getByLabel("Show a public support notice").check();
      await page.getByLabel("Notice text").fill("Fixture public support notice.");
      const platformRequest = settingsPost();
      await page.getByRole("button", { name: "Save platform configuration" }).click();
      assert.equal((await platformRequest).status(), 200);
      await page.goto(base + "/support", { waitUntil: "domcontentloaded" });
      await page.getByText("Fixture public support notice.", { exact: true }).waitFor();
      await page.goto(base + "/admin/settings", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Show a public support notice").uncheck();
      await page.getByLabel("Notice text").fill("");
      const clearNoticeRequest = settingsPost();
      await page.getByRole("button", { name: "Save platform configuration" }).click();
      assert.equal((await clearNoticeRequest).status(), 200);
      await page.goto(base + "/support", { waitUntil: "domcontentloaded" });
      assert.equal(await page.getByText("Fixture public support notice.", { exact: true }).count(), 0);
    }

    if (!securityOnly && !focusedTargets.length) {
      // The browser only publishes into this loopback replica-set fixture.
      await page.goto(base + "/admin/announcements", { waitUntil: "domcontentloaded" });
      await page.getByText("No announcements yet. Create a draft to get started.").waitFor({ timeout: 20_000 });
      await page.waitForLoadState("load", { timeout: 10_000 });
      assert.equal((await fetch(base + "/api/admin/announcements", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify(previewRequest) })).status, 401);
      assert.equal((await context.request.post(base + "/api/admin/announcements", { headers: { Origin: "https://outside.invalid" }, data: previewRequest })).status(), 403);
      await page.getByRole("link", { name: "New announcement" }).click();
      const editor = page.getByRole("region", { name: "Create Announcement" });
      try { await editor.locator('[data-editor-ready="true"]').waitFor({ timeout: 30_000 }); }
      catch (error) { throw new Error(`Announcement editor did not hydrate; editor=${(await editor.innerText()).slice(-500)}; browserErrors=${pageErrors.slice(-5).join(" | ") || "none"}; network=${networkErrors.slice(-10).join(" | ") || "none"}; server=${server.logs().slice(-1200)}`, { cause: error }); }
      await editor.getByRole("textbox", { name: "Announcement title" }).fill("Fixture study release");
      await editor.getByRole("textbox", { name: "Message" }).fill("A new way to work through the review queue.");
      const previewCard = editor.locator(".notification-item--unread");
      await previewCard.getByText("Fixture study release", { exact: true }).waitFor({ timeout: 10_000 });
      await previewCard.getByText("A new way to work through the review queue.", { exact: true }).waitFor({ timeout: 10_000 });
      await editor.getByLabel("Destination").selectOption("/review");
      const estimateReply = page.waitForResponse(response => response.url().endsWith("/api/admin/announcements") && response.request().method() === "POST", { timeout: 15_000 });
      await editor.getByRole("button", { name: "Estimate audience" }).click();
      let estimateResponse;
      try { estimateResponse = await estimateReply; }
      catch (error) { throw new Error(`Audience preview did not respond; editor=${(await editor.innerText()).slice(-500)}; browserErrors=${pageErrors.slice(-5).join(" | ") || "none"}; server=${server.logs().slice(-800)}`, { cause: error }); }
      assert.equal(estimateResponse.status(), 200, `Audience preview returned ${estimateResponse.status()}: ${(await estimateResponse.text()).slice(0, 300)}; editor=${(await editor.innerText()).slice(-500)}`);
      await editor.getByText(/estimated recipient/).waitFor({ timeout: 15_000 });
      for (const width of routeWidths) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= innerWidth), `Announcement editor fits at ${width}px`);
        if (process.env.ABII_ADMIN_SCREENSHOTS && [320, 375, 390, 1440].includes(width)) {
          await editor.getByRole("heading", { name: "Create Announcement" }).evaluate(el => el.scrollIntoView({ block: "start" }));
          await screenshotScrollable(page, join(process.env.ABII_ADMIN_SCREENSHOTS, `announcement-editor-${width}.png`));
        }
      }
      await editor.getByRole("link", { name: "Back to announcements" }).click();
      const discard = page.getByRole("dialog", { name: "Discard unsaved changes?" });
      await discard.waitFor();
      await page.keyboard.press("Escape");
      await discard.waitFor({ state: "hidden" });
      assert.equal(await editor.getByRole("textbox", { name: "Announcement title" }).inputValue(), "Fixture study release");
      const saveDraftResponse = page.waitForResponse(response => response.url().endsWith("/api/admin/announcements") && response.request().method() === "POST");
      await editor.getByRole("button", { name: "Save draft" }).click();
      const savedDraft = await saveDraftResponse;
      const savedDraftBody = await savedDraft.json();
      assert.equal(savedDraft.status(), 200, `Draft save failed: ${savedDraft.status()} ${JSON.stringify(savedDraftBody)}`);
      assert.equal(savedDraftBody.announcement?.lastAction, "Draft created");
      await page.waitForURL(url => !url.searchParams.has("editor") && url.searchParams.get("id") === savedDraftBody.announcement.id, { timeout: 15_000 });
      if (process.env.ABII_ADMIN_SCREENSHOTS) await screenshotScrollable(page, join(process.env.ABII_ADMIN_SCREENSHOTS, "announcement-details-1440.png"));
      const details = page.getByRole("region", { name: "Selected announcement" });
      try { await details.getByText("Draft created", { exact: true }).waitFor({ timeout: 20_000 }); }
      catch (error) { throw new Error(`Saved draft did not render at ${new URL(page.url()).pathname}${new URL(page.url()).search}; main=${(await page.locator("main").innerText()).slice(-1400)}`, { cause: error }); }
      const publicationId = await details.getByText(/^admin\.[0-9a-f]{24}$/).textContent();
      await details.getByRole("link", { name: "Edit", exact: true }).click();
      const edit = page.getByRole("region", { name: "Edit announcement" });
      await edit.getByRole("textbox", { name: "Message" }).fill("Organize today's study session in the review queue.");
      const future = new Date(Date.now() + 360_000).toISOString();
      await edit.getByLabel("Date", { exact: true }).fill(future.slice(0, 10));
      await edit.getByLabel("Time", { exact: true }).fill(future.slice(11, 16));
      await edit.getByRole("button", { name: "Schedule", exact: true }).click();
      const scheduleDialog = page.getByRole("dialog", { name: "Confirm publication schedule" });
      await scheduleDialog.getByRole("button", { name: "Confirm schedule" }).click();
      await details.getByText("Schedule created", { exact: true }).waitFor({ timeout: 20_000 });
      assert.equal(await db.collection("notifications").countDocuments({ dedupeKey: `whats-new:${publicationId}` }), 0);
      await details.getByRole("button", { name: "Cancel schedule" }).click();
      await page.getByRole("dialog", { name: "Cancel scheduled publication?" }).getByRole("button", { name: "Confirm cancellation" }).click();
      await details.getByText("Schedule canceled", { exact: true }).first().waitFor({ timeout: 20_000 });
      await details.getByRole("link", { name: "Edit", exact: true }).click();
      await edit.getByRole("button", { name: "Publish now" }).click();
      const confirm = page.getByRole("dialog", { name: "Publish this announcement?" });
      await confirm.getByText(/cannot be recalled/).waitFor({ timeout: 20_000 });
      for (const width of routeWidths) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await confirm.evaluate(dialog => {
          const box = dialog.getBoundingClientRect();
          return box.left >= 0 && box.right <= innerWidth && dialog.scrollWidth <= dialog.clientWidth;
        }), `Publication confirmation fits at ${width}px`);
      }
      await page.keyboard.press("Escape");
      await confirm.waitFor({ state: "hidden" });
      await page.waitForFunction(() => document.activeElement?.textContent === "Publish now", undefined, { timeout: 10_000 });
      await edit.getByRole("button", { name: "Publish now" }).click();
      await confirm.getByText(/cannot be recalled/).waitFor({ timeout: 20_000 });
      if (process.env.ABII_ADMIN_SCREENSHOTS) {
        await page.setViewportSize({ width: 390, height: 900 });
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "announcement-confirm-390.png"), animations: "disabled" });
      }
      assert.equal(await db.collection("notifications").countDocuments({ dedupeKey: `whats-new:${publicationId}` }), 0);
      await db.command({ collMod: "notifications", validator: { dedupeKey: { $ne: `whats-new:${publicationId}` } } });
      try {
        await confirm.getByRole("button", { name: "Confirm publication" }).click();
        await details.getByText("Failed", { exact: true }).waitFor({ timeout: 35_000 });
        await details.getByText(/recipients in the unresolved batch/).waitFor({ timeout: 15_000 });
      } finally {
        await db.command({ collMod: "notifications", validator: {} });
      }
      await details.getByRole("button", { name: "Retry delivery" }).click();
      await page.getByRole("dialog", { name: "Retry delivery?" }).getByRole("button", { name: "Confirm retry" }).click();
      await details.getByText("Delivered", { exact: true }).waitFor({ timeout: 35_000 });
      assert.equal(await db.collection("notifications").countDocuments({ dedupeKey: `whats-new:${publicationId}`, userId: learner._id }), 1);
      for (const width of routeWidths) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= innerWidth), `Delivery detail fits at ${width}px`);
      }
      if (process.env.ABII_ADMIN_SCREENSHOTS) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await details.evaluate(el => el.scrollIntoView({ block: "start" }));
        await screenshotScrollable(page, join(process.env.ABII_ADMIN_SCREENSHOTS, "announcement-delivery-1440.png"));
      }
      const filter = page.getByRole("form", { name: "Filter announcements" });
      await filter.getByRole("searchbox").fill(publicationId);
      await filter.getByRole("button", { name: "Apply" }).click();
      await page.waitForURL(url => url.searchParams.get("q") === publicationId, { timeout: 20_000 });
      await page.getByRole("link", { name: /Fixture study release/ }).waitFor({ timeout: 20_000 });
      await db.collection("announcements").dropIndex("announcement_updated");
      await page.goto(base + "/admin/announcements", { waitUntil: "domcontentloaded" });
      await page.getByRole("alert").filter({ hasText: "Announcement storage is unavailable." }).waitFor({ timeout: 20_000 });
      await db.collection("announcements").createIndex({ updatedAt: -1, _id: -1 }, { name: "announcement_updated" });
      if (announcementsOnly) {
        assert.deepEqual(pageErrors, []);
        return;
      }
    }

    await page.goto(base + "/admin/security", { waitUntil: "domcontentloaded" });
    const security = page.getByRole("region", { name: "Security Overview" });
    const sessionSecurity = page.getByRole("region", { name: "Session Security" });
    const explorer = security.getByRole("region", { name: "Security & Audit Explorer" });
    await sessionSecurity.getByText("Session lifetime").waitFor();
    await sessionSecurity.getByText("Password + Google Authenticator · MFA verified").waitFor();
    assert.match(await sessionSecurity.locator("article").first().locator("p.tabular-nums").innerText(), /^\d{2}:\d{2}:\d{2}$/);
    assert.equal(await sessionSecurity.getByRole("progressbar").count(), 3);
    await sessionSecurity.getByRole("link", { name: "Reauthenticate" }).waitFor();
    await security.getByText("Elevated rate limiting").waitFor();
    const activity = security.getByRole("slider", { name: "Authentication activity interval values" });
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[aria-label="Authentication activity interval values"] canvas');
      return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0;
    });
    await activity.focus();
    await page.keyboard.press("End");
    await page.waitForFunction(() => {
      const slider = document.querySelector('[aria-label="Authentication activity interval values"]');
      return slider && slider.getAttribute("aria-valuenow") === slider.getAttribute("aria-valuemax");
    }, undefined, { timeout: 15_000 });
    assert.doesNotMatch(await page.locator("main").innerText(), /restricted fixture reason/);
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => [...document.querySelectorAll("main [role=img] canvas")]
        .every(canvas => Math.abs(canvas.getBoundingClientRect().width - canvas.parentElement.getBoundingClientRect().width) < 2), undefined, { timeout: 5_000 });
      await explorer.getByRole("heading").evaluate(el => el.scrollIntoView({ block: "start" }));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= innerWidth));
      if (width === 1440) {
        const widths = await sessionSecurity.locator("article").evaluateAll(cards => cards.map(card => card.getBoundingClientRect().width));
        assert.ok(widths.every(width => Math.abs(width - widths[0]) < 1), `Session timer cards have equal widths: ${widths}`);
      }
      if (process.env.ABII_ADMIN_SCREENSHOTS) await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `security-explorer-${width}.png`), animations: "disabled" });
      if (process.env.ABII_ADMIN_SCREENSHOTS && [375, 1440].includes(width)) await screenshotScrollable(page, join(process.env.ABII_ADMIN_SCREENSHOTS, `security-full-${width}.png`));
    }
    await explorer.getByRole("link", { name: "Older evidence" }).click();
    await page.waitForURL(url => url.searchParams.has("cursor"), { timeout: 20_000 });
    await explorer.getByRole("link", { name: "First page" }).waitFor({ timeout: 20_000 });
    const filters = explorer.getByRole("form", { name: "Filter security evidence" });
    await filters.getByRole("searchbox").fill(securityCorrelation);
    await filters.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForURL(url => url.searchParams.get("q") === securityCorrelation, { timeout: 20_000 });
    const detailButton = explorer.getByRole("button", { name: "Learner reactivated" });
    await detailButton.focus();
    await detailButton.press("Enter");
    const detail = page.getByRole("dialog", { name: "Learner reactivated" });
    await detail.getByText(securityCorrelation, { exact: true }).waitFor();
    assert.doesNotMatch(await detail.innerText(), /restricted fixture reason/);
    if (process.env.ABII_ADMIN_SCREENSHOTS) await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "security-detail-1440.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await detail.waitFor({ state: "hidden" });
    assert.equal(await detailButton.evaluate(node => document.activeElement === node), true);
    await page.goto(base + "/admin/security?kind=provision", { waitUntil: "domcontentloaded" });
    await explorer.getByText("No matching security or audit events.").waitFor();
    await page.goto(base + "/admin/security?cursor=invalid", { waitUntil: "domcontentloaded" });
    await page.getByRole("alert").getByText(/page link has expired/).waitFor();
    await securityEvents.dropIndex(securityTimelineIndex);
    await page.goto(base + "/admin/security", { waitUntil: "domcontentloaded" });
    await explorer.getByText(/Pagination is paused/).waitFor();
    await securityEvents.createIndex({ occurredAt: -1, _id: -1 }, { name: securityTimelineIndex });
    await db.command({ collMod: "adminsecurityevents", validator: { format: { $ne: 2 } } });
    try {
      assert.equal((await fetch(base + "/api/auth/login", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ email: learner.email, password }) })).status, 200);
      for (let attempt = 0; attempt < 32 && !server.securityDropped(); attempt++) await delay(250);
      assert.equal(server.securityDropped(), true);
    } finally {
      await db.command({ collMod: "adminsecurityevents", validator: {} });
    }

    if (securityOnly) return;

    if (focusedTargets.length === 1 && focusedTargets[0] === "settings") {
      mkdirSync(process.env.ABII_ADMIN_SCREENSHOTS || ".tmp-admin-grid-stability", { recursive: true });
      const screenshotDir = process.env.ABII_ADMIN_SCREENSHOTS || ".tmp-admin-grid-stability";
      let delayedSettingsRead = true;
      await page.route("**/api/admin/settings", async route => {
        if (route.request().method() === "GET" && delayedSettingsRead) {
          delayedSettingsRead = false;
          await delay(1200);
        }
        await route.continue();
      });
      await page.goto(base + "/admin/settings", { waitUntil: "domcontentloaded" });
      await page.getByRole("status", { name: "Loading administrator settings" }).waitFor();
      await page.screenshot({ path: join(screenshotDir, "admin-settings-skeleton-1440.png"), animations: "disabled" });
      await page.getByRole("heading", { name: "Administrator Settings" }).waitFor();
      await page.unrouteAll({ behavior: "wait" });

      let failSettingsRead = true;
      await page.route("**/api/admin/settings", async route => {
        if (route.request().method() === "GET" && failSettingsRead) {
          failSettingsRead = false;
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Settings fixture unavailable." }) });
          return;
        }
        await route.continue();
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText("Settings fixture unavailable.").waitFor();
      await page.getByRole("button", { name: "Retry loading settings" }).click();
      await page.getByRole("heading", { name: "Administrator Settings" }).waitFor();
      await page.unrouteAll({ behavior: "wait" });

      const settingsPost = () => page.waitForResponse(response => response.url().endsWith("/api/admin/settings") && response.request().method() === "POST");
      await page.getByLabel("Display name").fill("Focused Settings Admin");
      const profileRequest = settingsPost();
      await page.getByRole("button", { name: "Save profile" }).click();
      assert.equal((await profileRequest).status(), 200);
      const warning = page.getByLabel("Warn before this session expires");
      await warning.setChecked(!(await warning.isChecked()));
      const preferenceRequest = settingsPost();
      await page.getByRole("button", { name: "Save preferences" }).click();
      assert.equal((await preferenceRequest).status(), 200);
      await page.getByLabel("Server-error threshold").selectOption("10");
      const monitoringRequest = settingsPost();
      await page.getByRole("button", { name: "Save monitoring alerts" }).click();
      assert.equal((await monitoringRequest).status(), 200);
      await page.getByLabel("Show a public support notice").check();
      await page.getByLabel("Notice text").fill("Fixture notice for focused Settings browser check.");
      const platformRequest = settingsPost();
      await page.getByRole("button", { name: "Save platform configuration" }).click();
      assert.equal((await platformRequest).status(), 200);
      await page.goto(base + "/support", { waitUntil: "domcontentloaded" });
      await page.getByText("Fixture notice for focused Settings browser check.", { exact: true }).waitFor();
      await page.goto(base + "/admin/settings", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Administrator Settings" }).waitFor();
      await page.getByRole("button", { name: /Change password/ }).click();
      const passwordDialog = page.getByRole("dialog", { name: "Change administrator password" });
      await passwordDialog.getByLabel("Current password").fill(password);
      await passwordDialog.getByLabel("New password", { exact: true }).fill("Fixture replacement password 456");
      await passwordDialog.getByLabel("Confirm new password").fill("Fixture password mismatch 789");
      await passwordDialog.getByLabel("I understand this signs out every administrator session.").check();
      let passwordMutationCount = 0;
      const countPasswordMutations = request => { if (request.url().endsWith("/api/admin/settings") && request.method() === "POST") passwordMutationCount++; };
      page.on("request", countPasswordMutations);
      await passwordDialog.getByRole("button", { name: "Change password and sign out" }).click();
      await passwordDialog.getByRole("alert").getByText("New passwords must match.").waitFor();
      assert.equal(passwordMutationCount, 0);
      page.off("request", countPasswordMutations);
      await passwordDialog.getByRole("button", { name: "Cancel" }).click();
      assert.deepEqual(pageErrors, []);
      return;
    }

    await page.goto(base + "/admin", { waitUntil: "domcontentloaded" });
    const period = page.getByLabel("Reporting period");
    assert.equal(await period.inputValue(), "30");
    assert.equal(await page.getByRole("slider", { name: "User Growth" }).count(), 0);
    assert.equal(await page.getByText("View daily counts", { exact: true }).count(), 0);
    assert.equal(await page.locator('img[src="https://res.cloudinary.com/abii/image/upload/fixture.png"]').count(), 1);
    assert.equal(await page.getByRole("button", { name: "Apply" }).evaluate(button => getComputedStyle(button).backgroundColor), "rgb(248, 118, 156)");
    const metric = label => page.getByRole("heading", { name: label, exact: true }).locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]").locator("p").first();
    assert.equal(await metric("Total Users").textContent(), "2");
    assert.equal(await metric("New Users").textContent(), "2");
    await period.selectOption("7");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForURL("**/admin?period=7");
    assert.equal(await metric("Total Users").textContent(), "2");
    assert.equal(await metric("New Users").textContent(), "1");
    assert.equal(await metric("Active Learners").textContent(), "1");
    if (process.env.ABII_ADMIN_SCREENSHOTS) {
      for (const width of [1920, 375]) {
        await page.setViewportSize({ width, height: 950 });
        await page.locator("#user-growth").evaluate(element => element.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `overview-trends-${width}.png`), animations: "disabled" });
      }
    }
    assert.equal(await page.getByRole("img", { name: /^User Growth:/ }).count(), 1);
    assert.ok(!(await page.locator("main").innerText()).includes("private fixture prompt"));
    const unauthenticatedReport = await fetch(base + "/admin?period=7");
    assert.doesNotMatch(await unauthenticatedReport.text(), /Older fixture|Active Learners/);

    await page.goto(base + "/admin/analytics", { waitUntil: "domcontentloaded" });
    const analytics = page.getByRole("region", { name: "Platform insights" });
    const periods = analytics.getByRole("navigation", { name: "Reporting period" });
    const signupChart = analytics.getByRole("slider", { name: "Growth and engagement daily values" });
    const metricValue = label => analytics.locator("dt").filter({ hasText: new RegExp(`^${label}$`, "i") }).locator("..").locator("dd > p").first();
    assert.equal(await periods.getByRole("link", { name: "30 days" }).getAttribute("aria-current"), "page");
    assert.equal(await metricValue("New users").textContent(), "2");
    for (const region of ["Email Activation", "Learning Retention", "Review Activity", "Quiz Preferences", "Subjects Created", "Flashcards Created"]) {
      await analytics.getByRole("region", { name: region, exact: true }).waitFor();
    }
    const growth = analytics.locator("#analytics-growth").locator("xpath=..");
    await growth.waitFor();
    await analytics.getByRole("region", { name: "Quiz Preferences" }).getByText("Partial coverage").waitFor();
    const quizPreferences = analytics.getByRole("region", { name: "Quiz Preferences", exact: true });
    await quizPreferences.getByText("1 sessions with known mode", { exact: true }).waitFor();
    assert.match(await quizPreferences.locator("dl").innerText(), /Random\s+1\s*·\s*100%/);
    assert.doesNotMatch(await analytics.innerText(), /private fixture prompt|Private analytics quiz|Private analytics subject|ui-learner@/i);
    await periods.getByRole("link", { name: "7 days" }).click();
    await page.waitForURL("**/admin/analytics?period=7");
    await growth.getByText(/prior/i).first().waitFor();
    assert.equal(await metricValue("New users").textContent(), "1");
    assert.equal(await metricValue("Active learners").textContent(), "1");
    assert.equal(await signupChart.getAttribute("aria-valuemax"), "7");
    await signupChart.press("Home");
    await signupChart.press("ArrowRight");
    assert.equal(await signupChart.getAttribute("aria-valuenow"), "2");
    await signupChart.press("End");
    assert.equal(await signupChart.getAttribute("aria-valuenow"), "7", "End selects the last observed day for accessible chart inspection");
    assert.equal(await growth.locator("summary").filter({ hasText: /view .* data/i }).count(), 0, "chart data disclosure is absent");
    await signupChart.focus();
    await signupChart.press("Home");
    await signupChart.press("ArrowRight");
    assert.match(await signupChart.getAttribute("aria-valuetext"), /Active learners .* New users/);
    await periods.getByRole("link", { name: "90 days" }).click();
    await page.waitForURL("**/admin/analytics?period=90");
    await signupChart.waitFor();
    assert.equal(await signupChart.getAttribute("aria-valuemax"), "90");
    assert.equal(await periods.getByRole("link", { name: "90 days" }).getAttribute("aria-current"), "page");
    const cohort = analytics.getByRole("region", { name: "Retention cohort matrix" });
    const cohortRows = cohort.locator("tbody tr");
    const cohortCount = await cohortRows.count();
    if (cohortCount > 10) {
      assert.equal(cohortCount, 10, "retention matrix is paged at ten rows");
      const paging = analytics.getByRole("navigation", { name: "Retention cohort pages" });
      assert.match(await paging.innerText(), /Showing 1–10 of \d+ cohorts · Page 1 of 2/);
      await paging.getByRole("button", { name: "Next" }).click();
      assert.ok(await cohortRows.count() <= 10 && await cohortRows.count() > 0, "next cohort page renders a bounded set");
      assert.match(await paging.innerText(), /Showing 11–\d+ of \d+ cohorts · Page 2 of 2/);
      assert.equal(await paging.getByRole("button", { name: "Next" }).isDisabled(), true);
      await paging.getByRole("button", { name: "Previous" }).click();
      assert.equal(await cohortRows.count(), 10, "previous returns to the first cohort page");
      await paging.getByRole("button", { name: "Next" }).click();
      await periods.getByRole("link", { name: "7 days" }).click();
      await page.waitForURL("**/admin/analytics?period=7");
      await periods.getByRole("link", { name: "90 days" }).click();
      await page.waitForURL("**/admin/analytics?period=90");
      assert.equal(await cohortRows.count(), 10, "changing the reporting window resets the local table to its first page");
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await cohort.evaluate(element => {
        const main = document.querySelector("main");
        return document.documentElement.scrollWidth <= innerWidth && main.scrollWidth <= main.clientWidth && element.getBoundingClientRect().right <= innerWidth;
      }), `analytics fits at ${width}px`);
      if (width === 375) assert.ok(await cohort.evaluate(element => element.scrollWidth === element.clientWidth), "all cohort columns fit at 375px");
      if (process.env.ABII_ADMIN_SCREENSHOTS && [375, 1440].includes(width)) {
        await analytics.evaluate(element => element.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `analytics-growth-${width}.png`), animations: "disabled" });
        await cohort.evaluate(element => element.closest("section").scrollIntoView({ block: "start" }));
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `analytics-retention-${width}.png`), animations: "disabled" });
        if (width === 1440) {
          await analytics.getByRole("heading", { name: "Learning behavior" }).evaluate(element => element.scrollIntoView({ block: "start" }));
          await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "analytics-behavior-1440.png"), animations: "disabled" });
          await analytics.getByRole("heading", { name: "Content creation" }).evaluate(element => element.scrollIntoView({ block: "start" }));
          await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "analytics-content-1440.png"), animations: "disabled" });
        }
      }
    }
    await page.goto(base + "/admin/performance", { waitUntil: "domcontentloaded", timeout: 90_000 });
    const monitoring = page.getByRole("region", { name: "System monitoring" });
    await monitoring.getByText("Independent availability probes have not been configured.").first().waitFor();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await monitoring.getByRole("heading", { name: "Endpoint performance" }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= document.querySelector("main").clientWidth), `Performance fits at ${width}px`);
      if (process.env.ABII_ADMIN_SCREENSHOTS && [320, 390, 1440].includes(width)) {
        await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector("main")?.scrollTo(0, 0); });
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `performance-${width}.png`), animations: "disabled", fullPage: true });
      }
    }
    await monitoring.getByRole("link", { name: "1 hour" }).click();
    await page.waitForURL("**/admin/performance?period=1h");
    const slider = monitoring.getByRole("slider", { name: "API latency interval values" });
    await slider.focus();
    await slider.press("End");
    assert.match(await slider.getAttribute("aria-valuetext"), /samples?/);
    if (process.env.ABII_ADMIN_SCREENSHOTS) {
      await monitoring.getByRole("heading", { name: "API Response Latency" }).evaluate(node => node.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "performance-trends.png"), animations: "disabled" });
      for (const [heading, filename] of [["Request Volume", "performance-volume.png"], ["Endpoint performance", "performance-endpoints.png"], ["Database Performance", "performance-database.png"], ["Recent Incidents", "performance-incidents.png"]]) {
        await monitoring.getByRole("heading", { name: heading, exact: true }).evaluate(node => node.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, filename), animations: "disabled" });
      }
    }
    const touchContext = await browser.newContext({ reducedMotion: "reduce", hasTouch: true, viewport: { width: 390, height: 900 },
      storageState: await context.storageState() });
    try {
      const touchPage = await touchContext.newPage();
      await touchPage.goto(base + "/admin/performance?period=1h");
      const touchSlider = touchPage.getByRole("slider", { name: "API latency interval values" });
      await touchSlider.tap({ position: { x: 25, y: 35 } });
      assert.match(await touchSlider.getAttribute("aria-valuetext"), /samples?/);
      assert.notEqual(await touchSlider.getAttribute("aria-valuenow"), await touchSlider.getAttribute("aria-valuemax"));
    } finally {
      await touchContext.close();
    }
    await monitoring.getByRole("rowheader", { name: /Submit answer/ }).waitFor();
    await monitoring.getByText(/11 examined/).waitFor();
    await monitoring.getByText("Elevated server errors").waitFor();
    const deniedPerformance = await fetch(base + "/admin/performance?period=7d", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } });
    assert.doesNotMatch(await deniedPerformance.text(), /Endpoint performance|Submit answer/);
    await metrics.dropIndex(metricTimeIndex);
    await page.goto(base + "/admin/performance?period=7d", { waitUntil: "domcontentloaded" });
    await monitoring.getByText("Monitoring storage could not be read.", { exact: true }).first().waitFor();
    await monitoring.getByText(/11 examined/).waitFor();

    const deniedAnalytics = await fetch(base + "/admin/analytics?period=90", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } });
    assert.doesNotMatch(await deniedAnalytics.text(), /Platform insights|Retention cohort matrix/);
    const corruptSubject = await db.collection("subjects").insertOne({ userId: learner._id, createdAt: [dayBefore(2)] });
    try {
      await page.goto(base + "/admin/analytics?period=7", { waitUntil: "domcontentloaded" });
      await analytics.getByText("Subject creation could not be loaded for this period.").waitFor();
      await analytics.getByRole("link", { name: "Reload report" }).waitFor();
      await analytics.getByRole("slider", { name: "Flashcards created daily values" }).waitFor();
    } finally {
      await db.collection("subjects").deleteOne({ _id: corruptSubject.insertedId });
    }

    await users.insertMany(Array.from({ length: 22 }, (_, index) => ({
      role: "user", name: `Directory fixture ${String(index).padStart(2, "0")}`,
      email: `directory-${index}@example.invalid`, createdAt: dayBefore(3),
    })));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + "/admin/users", { waitUntil: "domcontentloaded" });
    const directory = page.getByRole("region", { name: "User Directory" });
    await directory.getByText("Showing 1–20 of 24").waitFor();
    if (process.env.ABII_ADMIN_SCREENSHOTS) {
      await directory.evaluate(node => node.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "users-directory-1440.png"), animations: "disabled" });
      await page.setViewportSize({ width: 375, height: 820 });
      await directory.evaluate(node => node.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "users-directory-375.png"), animations: "disabled" });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    const toolbar = directory.getByRole("form", { name: "Filter learners" });
    await toolbar.getByRole("searchbox").fill("DIRECTORY");
    await toolbar.getByText("Filters", { exact: true }).click();
    await toolbar.getByLabel("Verification").selectOption("unverified");
    await toolbar.getByLabel("Account status").selectOption("active");
    await toolbar.getByLabel("Sort by").selectOption("name-desc");
    await toolbar.getByRole("searchbox").press("Enter");
    await directory.getByText("Showing 1–20 of 22").waitFor();
    assert.equal(new URL(page.url()).searchParams.get("sort"), "name-desc");
    assert.match(await directory.getByRole("row").nth(1).innerText(), /Directory fixture 21/);
    await directory.getByRole("link", { name: "Next" }).click();
    await directory.getByText("Showing 21–22 of 22").waitFor();
    assert.ok(new URL(page.url()).searchParams.has("cursor"));
    assert.equal(new URL(page.url()).searchParams.get("q"), "DIRECTORY");
    await page.reload();
    await directory.getByText("Showing 21–22 of 22").waitFor();
    const previous = directory.getByRole("link", { name: "Previous" });
    const previousHref = await previous.getAttribute("href");
    await previous.click();
    await page.waitForURL(base + previousHref);
    await directory.getByText("Showing 1–20 of 22").waitFor({ timeout: 10_000 }).catch(async error => {
      throw new Error(`Previous page displayed ${await directory.locator("footer").innerText()} at ${new URL(page.url()).pathname}. ${pageErrors.join(" ")}`, { cause: error });
    });
    await toolbar.getByRole("searchbox").fill("missing-fixture");
    await toolbar.getByText("Filters", { exact: true }).click();
    await toolbar.getByRole("button", { name: "Apply" }).click();
    await directory.getByText("No matching users").waitFor();
    await directory.getByRole("link", { name: "Reset filters" }).last().click();
    await directory.getByText("Showing 1–20 of 24").waitFor();
    await page.goto(base + "/admin/users?cursor=invalid", { waitUntil: "domcontentloaded" });
    await directory.getByRole("alert").getByText("This directory page link is invalid or expired.").waitFor();

    await page.goto(base + "/admin/users?q=Fixture&status=active", { waitUntil: "domcontentloaded" });
    const detailsButton = directory.getByRole("button", { name: "View details for Fixture Learner" });
    const sheet = page.getByRole("dialog", { name: "Account details" });
    const endpoint = "**" + learnerDetailPath;
    let detailRequested = false;
    await page.route(endpoint, route => {
      detailRequested = true;
      return route.fulfill({ status: 503, json: { message: "Account details are temporarily unavailable." } });
    });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some(node => node.getAttribute("aria-label") === "View details for Fixture Learner" && !node.disabled && node.offsetWidth > 0));
    await detailsButton.focus();
    await detailsButton.press("Enter");
    await sheet.getByRole("alert").getByText("Account details are temporarily unavailable.").waitFor({ timeout: 10_000 }).catch(async error => {
      const content = await page.locator("dialog[open]").allTextContents();
      throw new Error(`Detail request intercepted: ${detailRequested}. Dialog: ${content.join(" ")}. Page errors: ${pageErrors.join(" ")}`, { cause: error });
    });
    await page.unroute(endpoint);
    let releaseDetail;
    const intercepted = new Promise(resolve => { releaseDetail = resolve; });
    let continueDetail;
    const release = new Promise(resolve => { continueDetail = resolve; });
    await page.route(endpoint, async route => { releaseDetail(); await release; await route.continue(); }, { times: 1 });
    await sheet.getByRole("button", { name: "Try again" }).click();
    await intercepted;
    await sheet.getByRole("status", { name: "Loading account details" }).waitFor();
    continueDetail();
    await sheet.getByRole("heading", { name: "Learning statistics" }).waitFor();
    assert.ok(!(await sheet.innerText()).includes("private fixture prompt"));
    for (const width of widths) {
      await page.setViewportSize({ width, height: 820 });
      assert.ok(await sheet.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return rect.right <= innerWidth && rect.width === (innerWidth < 640 ? innerWidth : 480) && node.scrollWidth <= node.clientWidth;
      }), `detail sheet fits at ${width}px`);
      if (process.env.ABII_ADMIN_SCREENSHOTS && [375, 1440].includes(width)) {
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `users-detail-${width}.png`), animations: "disabled" });
      }
    }
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "hidden" });
    assert.equal(await detailsButton.evaluate(element => element === document.activeElement), true);
    await detailsButton.click();
    await sheet.getByRole("button", { name: "Suspend account" }).click();
    const suspend = page.getByRole("dialog", { name: "Suspend this account?" });
    const reason = suspend.getByRole("textbox", { name: "Reason (required)" });
    assert.equal(await reason.evaluate(element => element === document.activeElement), true);
    await reason.fill("  ");
    await suspend.getByRole("button", { name: "Confirm suspension" }).click();
    await suspend.getByRole("alert").getByText("Enter at least 3 characters.").waitFor();
    await page.keyboard.press("Escape");
    await sheet.getByRole("button", { name: "Suspend account" }).waitFor();
    const detailResponse = await context.request.get(base + learnerDetailPath);
    assert.match(detailResponse.headers()["cache-control"], /private, no-store/);
    const { revision } = await detailResponse.json();
    const patch = (data, headers = { Origin: base }) => context.request.patch(base + learnerDetailPath, { data, headers });
    assert.equal((await patch({ action: "suspend", revision, reason: "Fixture review" }, { Origin: "https://outside.invalid" })).status(), 403);
    assert.equal((await patch({ action: "suspend", revision, reason: "Fixture review", role: "admin" })).status(), 400);
    assert.equal((await patch({ action: "suspend", revision, reason: " " })).status(), 400);
    assert.equal((await patch({ action: "suspend", revision, reason: "x".repeat(4500) })).status(), 413);
    assert.equal((await context.request.get(base + "/api/admin/users/primary")).status(), 400);
    const challengeId = randomBytes(16).toString("hex");
    const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection("authchallenges").insertOne({
      userId: learner._id, challengeId, purpose: "password_reset", expiresAt: new Date(Date.now() + 180_000),
      codeHash: hashOtp(String(learner._id), "password_reset", challengeId, recoveryCode),
      attemptCount: 0, consumedAt: null, lockedAt: null,
    });
    await sheet.getByRole("button", { name: "Suspend account" }).click();
    await reason.fill("Isolated browser fixture review");
    await page.route(endpoint, route => route.request().method() === "PATCH" ? route.abort() : route.continue(), { times: 1 });
    await suspend.getByRole("button", { name: "Confirm suspension" }).click();
    await suspend.getByRole("alert").getByText(/Review the account before confirming again/).waitFor();
    assert.equal(await reason.inputValue(), "Isolated browser fixture review");
    if (process.env.ABII_ADMIN_SCREENSHOTS) {
      await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "users-confirmation-1920.png"), animations: "disabled" });
    }
    await suspend.getByRole("button", { name: "Confirm suspension" }).click();
    await sheet.getByText("Account suspended successfully.").waitFor();
    await detailsButton.waitFor({ state: "hidden" });
    assert.equal((await patch({ action: "suspend", revision, reason: "Repeated request" })).status(), 409);
    const oldSession = { headers: { Cookie: `abii_session=${learnerCookie.value}` } };
    assert.equal((await fetch(base + "/api/quiz/active", oldSession)).status, 401);
    const suspendedLogin = await fetch(base + "/api/auth/login", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ email: learner.email, password }) });
    assert.equal(suspendedLogin.status, 401);
    assert.equal((await post("/api/auth/forgot-password/verify", { email: learner.email, code: recoveryCode })).status(), 400);
    assert.equal((await db.collection("authchallenges").findOne({ challengeId })).consumedAt, null);
    await sheet.getByRole("button", { name: "Reactivate account" }).click();
    const restore = page.getByRole("dialog", { name: "Reactivate this account?" });
    await restore.getByRole("textbox", { name: "Reason (required)" }).fill("Isolated browser fixture restored");
    await restore.getByRole("button", { name: "Confirm reactivation" }).click();
    await sheet.getByText("Account reactivated successfully.").waitFor();
    await sheet.getByRole("button", { name: "Suspend account" }).waitFor();
    assert.equal((await fetch(base + "/api/quiz/active", oldSession)).status, 401);
    const audits = await db.collection("adminauditlogs").find({ targetId: String(learner._id) }).sort({ occurredAt: 1 }).toArray();
    assert.deepEqual(audits.map(audit => [audit.action, audit.reason, audit.outcome]), [
      ["user.suspend", "Isolated browser fixture review", "committed"],
      ["user.restore", "Isolated browser fixture restored", "committed"],
    ]);
    assert.equal((await users.findOne({ _id: learner._id })).sessionVersion, 2);
    assert.equal(await db.collection("flashcards").countDocuments({ userId: learner._id }), 1);
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "hidden" });

    if (focusedTargets.length) return;
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(base + "/admin", { waitUntil: "domcontentloaded" });
    const entrance = await page.locator(".abii-page-hero").evaluate(hero => ["title", "description", "mascot"].map(part => {
      const style = getComputedStyle(hero.querySelector(`.abii-page-hero__${part}`));
      return { name: style.animationName, delay: Number.parseFloat(style.animationDelay) };
    }));
    assert.deepEqual(entrance.map(part => part.name), ["abii-enter", "abii-enter", "abii-enter-art"]);
    assert.ok(entrance[0].delay < entrance[1].delay && entrance[1].delay < entrance[2].delay);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 880 });
      const layout = await page.evaluate(() => {
        const main = document.querySelector("main");
        const image = main.querySelector("img").getBoundingClientRect();
        const title = main.querySelector("h1").getBoundingClientRect();
        return {
          fits: main.scrollWidth <= main.clientWidth && document.documentElement.scrollWidth <= innerWidth,
          separate: title.right <= image.left + 1,
          motion: getComputedStyle(main.querySelector(".abii-enter")).animationName,
        };
      });
      assert.ok(layout.fits && layout.separate, `Admin layout fits without hero overlap at ${width}px`);
      assert.equal(layout.motion, "none");
      if (process.env.ABII_ADMIN_SCREENSHOTS) {
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `admin-${width}.png`), animations: "disabled" });
      }
    }
    await page.setViewportSize({ width: 375, height: 780 });
    const drawerButton = page.getByRole("button", { name: "Open admin navigation" });
    const dialog = page.getByRole("dialog");
    await drawerButton.focus();
    await page.keyboard.press("Enter");
    await dialog.waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Close admin navigation");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await drawerButton.evaluate(element => element === document.activeElement), true);
    await drawerButton.click();
    await dialog.getByRole("link", { name: "Support" }).click();
    await page.getByRole("heading", { level: 1, name: "Here to help, always." }).waitFor();
    assert.equal(await drawerButton.getAttribute("aria-expanded"), "false");

    if (!securityOnly && !announcementsOnly) {
      assert.equal((await context.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email: admin.email, password } })).status(), 202);
      assert.equal((await context.request.post(base + "/api/auth/admin-mfa", { headers: { Origin: base }, data: { code: totpAt(seed, Date.now()) } })).status(), 200);
      await page.goto(base + "/admin/settings", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Change password/ }).click();
      await page.getByLabel("Current password").fill(password);
      await page.getByLabel("New password", { exact: true }).fill("Fixture replacement password 456");
      await page.getByLabel("Confirm new password").fill("Fixture replacement password 456");
      await page.getByLabel("I understand this signs out every administrator session.").check();
      const passwordRequest = page.waitForResponse(response => response.url().endsWith("/api/admin/settings") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Change password and sign out" }).click();
      assert.equal((await passwordRequest).status(), 200);
      await page.waitForURL(base + "/login");
      assert.equal((await context.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email: admin.email, password } })).status(), 401);
      await delay(31_000);
      assert.equal((await context.request.post(base + "/api/auth/login", { headers: { Origin: base }, data: { email: admin.email, password: "Fixture replacement password 456" } })).status(), 202);
      assert.equal((await context.request.post(base + "/api/auth/admin-mfa", { headers: { Origin: base }, data: { code: totpAt(seed, Date.now()) } })).status(), 200);
      await denied("/settings", "Sign in to continue", `abii_admin=${adminCookie.value}`);
    }

    const legacy = (await users.insertOne({ email: "legacy-admin@example.invalid", role: "admin" })).insertedId;
    await denied("/security", "Sign-in verification unavailable", `abii_admin=${adminCookie.value}`, true);
    await users.deleteOne({ _id: legacy });
    await page.goto(base + "/admin/support", { waitUntil: "domcontentloaded" });
    const account = page.getByRole("button", { name: "Account menu" });
    const signOut = page.getByRole("button", { name: "Sign out" });
    await account.press("Enter");
    await signOut.waitFor();
    assert.equal(await signOut.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Escape");
    assert.equal(await account.evaluate(element => element === document.activeElement), true);
    await account.press("Enter");
    await signOut.waitFor();
    await page.getByRole("heading", { level: 1 }).click();
    await signOut.waitFor({ state: "hidden" });
    await account.press("Enter");
    await signOut.click();
    await page.waitForURL(base + "/login");
    await denied("/settings", "Sign in to continue", `abii_admin=${adminCookie.value}`);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser?.close();
    await server?.stop();
    await mongoose.disconnect();
    await replica.stop();
  }
});
