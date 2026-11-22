import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
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

const destinations = [
  ["", "Overview", "Everything in one view.", "Platform Overview", "overview"],
  ["/users", "Users", "Every learner matters.", "Learner directory", "users"],
  ["/analytics", "Analytics", "See how learning grows.", "Platform insights", "analytics"],
  ["/performance", "Performance", "Keep things running smoothly.", "Endpoint monitoring", "performance"],
  ["/security", "Security", "A safer place to learn.", "Audit history", "security"],
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
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output = (output + chunk).slice(-3000); });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const closed = new Promise(resolve => child.once("exit", resolve));
    child.kill();
    await closed;
  };
  try {
    for (let attempt = 0; attempt < 240; attempt++) {
      if (/Ready in/.test(output)) return { base, stop };
      if (child.exitCode !== null) break;
      await delay(250);
    }
    throw new Error(`Next server did not start: ${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

test("admin routes fail closed, require real MFA, and render the protected workspace", { timeout: 240_000 }, async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const secret = randomBytes(32).toString("hex");
  const uri = replica.getUri("abii_admin_ui_fixture");
  const env = {
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

    server = await startServer({ ...env, ABII_ADMIN_UI_ENABLED: "" }, process.env.ABII_TEST_PRODUCTION_GATE === "1");
    for (const suffix of ["", "/settings", "/analytics"]) {
      const closed = await fetch(server.base + "/admin" + suffix);
      assert.equal(closed.status, 404);
      assert.match(closed.headers.get("cache-control"), /private.*no-store/);
    }
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

    const login = await post("/api/auth/login", { email: learner.email, password });
    assert.equal(login.status(), 200);
    const learnerCookie = (await context.cookies()).find(cookie => cookie.name === "abii_session");
    assert.equal((await fetch(base + learnerDetailPath)).status, 401);
    assert.equal((await context.request.get(base + learnerDetailPath)).status(), 403);
    assert.ok(learnerCookie);
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

    assert.equal((await post("/api/auth/admin-mfa", { code: totpAt(seed, Date.now()) })).status(), 200);
    const adminCookie = (await context.cookies()).find(cookie => cookie.name === "abii_admin");
    assert.ok(adminCookie);
    for (const [suffix, label, headline, region, asset] of destinations) {
      await page.setViewportSize({ width: 1920, height: 951 });
      const response = await page.goto(base + "/admin" + suffix);
      assert.match(response.headers()["cache-control"], /\bno-store\b/);
      await page.getByRole("heading", { level: 1, name: headline }).waitFor();
      await page.getByRole("heading", { name: region, exact: true }).waitFor();
      assert.equal(await page.getByRole("navigation", { name: "Admin navigation" }).locator('[aria-current="page"]').innerText(), label);
      const image = page.locator(`main img[src*="admin-${asset}.png"]`);
      await image.evaluate(element => element.decode());
      assert.deepEqual(await page.evaluate(workspaceGeometry), learnerGeometry, `${label} desktop shell geometry`);
      if (process.env.ABII_ADMIN_SCREENSHOTS) {
        await page.screenshot({ path: join(process.env.ABII_ADMIN_SCREENSHOTS, `admin-${asset}-1920.png`), animations: "disabled" });
      }
      assert.equal(await image.getAttribute("alt"), "");
      if (!["overview", "users", "analytics"].includes(asset)) assert.equal(await page.locator("main table, main input, main select").count(), 0);
      assert.ok(!(await page.locator("main").innerText()).includes(admin.email));
      for (const width of widths) {
        await page.setViewportSize({ width, height: 880 });
        const geometry = await page.evaluate(adminHeroGeometry);
        assert.ok(Object.entries(geometry).every(([key, value]) => key === "bottomGap" ? value >= 0 && value <= 4 : value), `${label} at ${width}px: ${JSON.stringify(geometry)}`);
      }
    }

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
