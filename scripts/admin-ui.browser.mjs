import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
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
  ["/users", "Users", "Every learner matters.", "Learner directory", "users"],
  ["/analytics", "Analytics", "See how learning grows.", "Platform insights", "analytics"],
  ["/performance", "Performance", "Keep things running smoothly.", "System monitoring", "performance"],
  ["/security", "Security", "A safer place to learn.", "Security overview", "security"],
  ["/announcements", "Announcements", "Share what’s new.", "Announcement list", "announcements"],
  ["/support", "Support", "Here to help, always.", "Conversation", "support"],
  ["/settings", "Settings", "Make every detail count.", "Workspace preferences", "settings"],
];
const widths = [320, 375, 390, 768, 1024, 1280, 1440, 1920];

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
  const title = hero.querySelector("h1").getBoundingClientRect();
  const box = hero.getBoundingClientRect();
  const panels = Array.from(hero.parentElement.children).slice(1);
  const scale = Math.min(art.width / image.naturalWidth, art.height / image.naturalHeight);
  const visibleHeight = image.naturalHeight * scale;
  const motion = [...hero.querySelectorAll(".abii-enter, .abii-enter-art")].map(el => getComputedStyle(el));
  return {
    fits: main.scrollWidth <= main.clientWidth && document.documentElement.scrollWidth <= innerWidth,
    separates: title.right <= art.left + 1,
    aligns: panels.every(panel => {
      const rect = panel.getBoundingClientRect();
      return Math.abs(rect.left - box.left) < 1 && Math.abs(rect.right - box.right) < 1;
    }),
    bottomGap: box.bottom - art.bottom,
    preservesFullArtwork: visibleHeight <= art.height + 1 && art.top >= box.top && getComputedStyle(image).objectFit === "contain",
    bottomAligned: getComputedStyle(image).objectPosition.endsWith("100%"),
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
      if (/Ready in/.test(output)) return { base, stop, telemetryDropped: () => telemetryDropped, securityDropped: () => securityDropped };
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
    const learner = { _id: new mongoose.Types.ObjectId(), role: "user", name: "Fixture Learner", email: "ui-learner@example.invalid" };
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

    const learnerDetailPath = `/api/admin/users/${learner._id}`;
    assert.equal((await fetch(server.base + learnerDetailPath)).status, 404);
    await server.stop();
    server = await startServer({ ...env, ABII_ADMIN_UI_ENABLED: "true" });
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
    page.on("pageerror", error => pageErrors.push(error.message));
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
    await page.goto(base + "/dashboard");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Dashboard", exact: true }).waitFor();
    assert.equal(await page.getByRole("navigation", { name: "Admin navigation" }).count(), 0);
    await page.setViewportSize({ width: 1920, height: 951 });
    const learnerGeometry = await page.evaluate(workspaceGeometry);
    assert.equal(learnerGeometry.left, 24);
    if (process.env.ABII_ADMIN_SCREENSHOTS) {
      await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "learner-1920.png"), animations: "disabled" });
    }
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
    for (const [suffix, label, headline, region, asset] of securityOnly || announcementsOnly ? destinations.filter(item => item[4] === (securityOnly ? "security" : "announcements")) : destinations) {
      await page.setViewportSize({ width: 1920, height: 951 });
      const response = await page.goto(base + "/admin" + suffix, { waitUntil: "domcontentloaded", timeout: 90_000 });
      assert.match(response.headers()["cache-control"], /\bno-store\b/);
      await page.getByRole("heading", { level: 1, name: headline }).waitFor();
      await page.getByRole("heading", { name: region, exact: true }).waitFor();
      assert.equal(await page.getByRole("navigation", { name: "Admin navigation" }).locator('[aria-current="page"]').innerText(), label);
      const image = page.locator(`main img[src*="admin-${asset}.png"]`);
      await image.evaluate(element => element.decode());
      assert.deepEqual(await page.evaluate(workspaceGeometry), learnerGeometry, `${label} desktop shell geometry`);
      if (asset === "security") await page.getByRole("heading", { name: "Security & audit explorer" }).waitFor();
      if (asset === "performance") await page.getByRole("heading", { name: "Endpoint performance" }).waitFor();
      if (process.env.ABII_ADMIN_SCREENSHOTS) {
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `admin-${asset}-1920.png`), animations: "disabled" });
      }
      assert.equal(await image.getAttribute("alt"), "");

      if (!["overview", "users", "analytics", "performance", "security", "announcements"].includes(asset)) assert.equal(await page.locator("main table, main input, main select").count(), 0);
      assert.ok(!(await page.locator("main").innerText()).includes(admin.email));
      for (const width of widths) {
        await page.setViewportSize({ width, height: 880 });
        const geometry = await page.evaluate(adminHeroGeometry);
        if (!geometry.fits && asset === "performance") {
          if (process.env.ABII_ADMIN_SCREENSHOTS) {
            await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `performance-overflow-${width}.png`), animations: "disabled" });
          }
          const overflow = await page.evaluate(() => {
            const main = document.querySelector("main");
            return {
              viewport: [innerWidth, document.documentElement.scrollWidth, main.clientWidth, main.scrollWidth],
              elements: [...main.querySelectorAll("*")].filter(el => {
                const edge = el.getBoundingClientRect().right;
                return edge > innerWidth && !el.closest("[role=region][tabindex]");
              }).slice(0, 15).map(el => [el.tagName, el.className, Math.round(el.getBoundingClientRect().right)]),
            };
          });
          assert.fail(`Performance at ${width}px overflows: ${JSON.stringify(overflow)}`);
        }
        assert.ok(Object.entries(geometry).every(([key, value]) => key === "bottomGap" ? value >= 0 && value <= 4 : value), `${label} at ${width}px: ${JSON.stringify(geometry)}`);
      }
    }

    if (!securityOnly) {
      // The browser only publishes into this loopback replica-set fixture.
      await page.goto(base + "/admin/announcements");
      await page.getByText("No announcements yet. Create a draft to get started.").waitFor({ timeout: 20_000 });
      assert.equal((await fetch(base + "/api/admin/announcements", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify(previewRequest) })).status, 401);
      assert.equal((await context.request.post(base + "/api/admin/announcements", { headers: { Origin: "https://outside.invalid" }, data: previewRequest })).status(), 403);
      await page.getByRole("link", { name: "Create new" }).click();
      const editor = page.getByRole("region", { name: "Create announcement" });
      await editor.getByRole("textbox", { name: "Announcement title" }).fill("Fixture study release");
      await editor.getByRole("textbox", { name: "Message" }).fill("A new way to work through the review queue.");
      await editor.getByLabel("Destination").selectOption("/review");
      await editor.getByRole("button", { name: "Estimate audience" }).click();
      await editor.getByText(/estimated recipient/).waitFor({ timeout: 15_000 });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= innerWidth), `Announcement editor fits at ${width}px`);
        if (process.env.ABII_ADMIN_SCREENSHOTS && [320, 390, 1440].includes(width)) {
          await editor.getByRole("heading", { name: "Create announcement" }).evaluate(el => el.scrollIntoView({ block: "start" }));
          await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `announcement-editor-${width}.png`), animations: "disabled" });
        }
      }
      await editor.getByRole("link", { name: "Back to announcements" }).click();
      const discard = page.getByRole("dialog", { name: "Discard unsaved changes?" });
      await discard.waitFor();
      await page.keyboard.press("Escape");
      await discard.waitFor({ state: "hidden" });
      assert.equal(await editor.getByRole("textbox", { name: "Announcement title" }).inputValue(), "Fixture study release");
      await editor.getByRole("button", { name: "Save draft" }).click();
      const details = page.getByRole("region", { name: "Selected announcement" });
      await details.getByText("Draft created", { exact: true }).waitFor({ timeout: 20_000 });
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
      for (const width of widths) {
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
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= innerWidth), `Delivery detail fits at ${width}px`);
      }
      if (process.env.ABII_ADMIN_SCREENSHOTS) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await details.evaluate(el => el.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "announcement-delivery-1440.png"), animations: "disabled" });
      }
      const filter = page.getByRole("form", { name: "Filter announcements" });
      await filter.getByRole("searchbox").fill(publicationId);
      await filter.getByRole("button", { name: "Apply" }).click();
      await page.waitForURL(url => url.searchParams.get("q") === publicationId, { timeout: 20_000 });
      await page.getByRole("link", { name: /Fixture study release/ }).waitFor({ timeout: 20_000 });
      await db.collection("announcements").dropIndex("announcement_updated");
      await page.goto(base + "/admin/announcements");
      await page.getByRole("alert").filter({ hasText: "Announcement storage is unavailable." }).waitFor({ timeout: 20_000 });
      await db.collection("announcements").createIndex({ updatedAt: -1, _id: -1 }, { name: "announcement_updated" });
      if (announcementsOnly) {
        assert.deepEqual(pageErrors, []);
        return;
      }
    }

    await page.goto(base + "/admin/security");
    const security = page.getByRole("region", { name: "Security overview" });
    const explorer = security.getByRole("region", { name: "Security and audit explorer" });
    await security.getByText("Elevated rate limiting").waitFor();
    const activity = security.getByRole("slider", { name: "Authentication activity interval values" });
    await activity.focus();
    await page.keyboard.press("End");
    await page.waitForFunction(() => {
      const slider = document.querySelector('[aria-label="Authentication activity interval values"]');
      return slider && slider.getAttribute("aria-valuenow") === slider.getAttribute("aria-valuemax");
    }, undefined, { timeout: 15_000 });
    assert.doesNotMatch(await page.locator("main").innerText(), /restricted fixture reason/);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await explorer.getByRole("heading").evaluate(el => el.scrollIntoView({ block: "start" }));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= innerWidth));
      if (process.env.ABII_ADMIN_SCREENSHOTS) await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `security-explorer-${width}.png`), animations: "disabled" });
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
    await page.goto(base + "/admin/security?kind=provision");
    await explorer.getByText("No matching security or audit events.").waitFor();
    await page.goto(base + "/admin/security?cursor=invalid");
    await page.getByRole("alert").getByText(/page link has expired/).waitFor();
    await securityEvents.dropIndex(securityTimelineIndex);
    await page.goto(base + "/admin/security");
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

    await page.goto(base + "/admin");
    const period = page.getByLabel("Reporting period");
    assert.equal(await period.inputValue(), "30");
    const metric = label => page.getByRole("heading", { name: label, exact: true }).locator("..").locator("p").first();
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
    const growth = page.getByRole("slider", { name: "User Growth" });
    await growth.press("Home");
    await growth.press("ArrowRight");
    assert.equal(await growth.getAttribute("aria-valuenow"), "2");
    const values = page.locator("details").filter({ has: page.getByRole("table", { name: "User Growth daily counts in UTC", includeHidden: true }) });
    await values.locator("summary").click();
    assert.equal(await values.locator("tbody tr").count(), 7);
    assert.ok(!(await page.locator("main").innerText()).includes("private fixture prompt"));
    const unauthenticatedReport = await fetch(base + "/admin?period=7");
    assert.doesNotMatch(await unauthenticatedReport.text(), /Older fixture|Active Learners/);

    await page.goto(base + "/admin/analytics");
    const analytics = page.getByRole("region", { name: "Platform insights" });
    const periods = analytics.getByRole("navigation", { name: "Reporting period" });
    const signupChart = analytics.getByRole("slider", { name: "User growth daily values" });
    const metricValue = label => analytics.locator("dt").filter({ hasText: new RegExp(`^${label}$`, "i") }).locator("..").locator("dd > p").first();
    assert.equal(await periods.getByRole("link", { name: "30 days" }).getAttribute("aria-current"), "page");
    assert.equal(await metricValue("New users").textContent(), "2");
    for (const region of ["User growth", "Active learners", "Account activation", "Learning retention", "Review activity", "Quiz modes", "Subjects and flashcards"]) {
      await analytics.getByRole("region", { name: region, exact: true }).waitFor();
    }
    await analytics.getByRole("region", { name: "Quiz modes" }).getByText("Partial coverage").waitFor();
    await analytics.getByRole("listitem").filter({ hasText: "Random" }).getByText("100%").waitFor();
    assert.doesNotMatch(await analytics.innerText(), /private fixture prompt|Private analytics quiz|Private analytics subject|ui-learner@/i);
    await periods.getByRole("link", { name: "7 days" }).click();
    await page.waitForURL("**/admin/analytics?period=7");
    await analytics.getByRole("region", { name: "User growth", exact: true }).getByText("Prior period 0").waitFor();
    assert.equal(await metricValue("New users").textContent(), "1");
    assert.equal(await metricValue("Active learners").textContent(), "1");
    assert.equal(await signupChart.getAttribute("aria-valuemax"), "7");
    await signupChart.press("Home");
    await signupChart.press("ArrowRight");
    assert.equal(await signupChart.getAttribute("aria-valuenow"), "2");
    const chartBounds = await signupChart.boundingBox();
    assert.ok(chartBounds);
    await signupChart.dispatchEvent("pointerdown", { pointerType: "touch", clientX: chartBounds.x + chartBounds.width - 1 });
    assert.equal(await signupChart.getAttribute("aria-valuenow"), "7");
    await analytics.getByRole("region", { name: "User growth", exact: true }).locator("summary").click();
    await analytics.getByRole("region", { name: "User growth data table" }).waitFor();
    assert.equal(await analytics.getByRole("region", { name: "User growth data table" }).locator("tbody tr").count(), 7);
    await periods.getByRole("link", { name: "90 days" }).click();
    await page.waitForURL("**/admin/analytics?period=90");
    await signupChart.waitFor();
    assert.equal(await signupChart.getAttribute("aria-valuemax"), "90");
    assert.equal(await periods.getByRole("link", { name: "90 days" }).getAttribute("aria-current"), "page");
    const cohort = analytics.getByRole("region", { name: "Retention cohort matrix" });
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
        await page.evaluate(() => window.scrollTo(0, 0));
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
      await monitoring.getByRole("heading", { name: "API latency trend" }).evaluate(node => node.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, "performance-trends.png"), animations: "disabled" });
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
    await page.goto(base + "/admin/performance?period=7d");
    await monitoring.getByText("Monitoring storage could not be read.", { exact: true }).first().waitFor();
    await monitoring.getByText(/11 examined/).waitFor();

    const deniedAnalytics = await fetch(base + "/admin/analytics?period=90", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } });
    assert.doesNotMatch(await deniedAnalytics.text(), /Platform insights|Retention cohort matrix/);
    const corruptSubject = await db.collection("subjects").insertOne({ userId: learner._id, createdAt: [dayBefore(2)] });
    try {
      await page.goto(base + "/admin/analytics?period=7");
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
    await page.goto(base + "/admin/users");
    const directory = page.getByRole("region", { name: "Learner directory" });
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
    await toolbar.getByRole("button", { name: "Apply" }).click();
    await directory.getByText("No matching users").waitFor();
    await directory.getByRole("link", { name: "Reset filters" }).last().click();
    await directory.getByText("Showing 1–20 of 24").waitFor();
    await page.goto(base + "/admin/users?cursor=invalid");
    await directory.getByRole("alert").getByText("This directory page link is invalid or expired.").waitFor();

    await page.goto(base + "/admin/users?q=Fixture&status=active");
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

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(base + "/admin");
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

    const legacy = (await users.insertOne({ email: "legacy-admin@example.invalid", role: "admin" })).insertedId;
    await denied("/security", "Sign-in verification unavailable", `abii_admin=${adminCookie.value}`, true);
    await users.deleteOne({ _id: legacy });
    await page.goto(base + "/admin/support");
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
