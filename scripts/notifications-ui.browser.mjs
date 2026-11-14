import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { User } from "../models/User.ts";
import { Notification } from "../models/Notification.ts";
import { SESSION_AUDIENCE, SESSION_ISSUER } from "../lib/auth/constants.ts";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

test("notification bell, center, and preferences work in a real authenticated browser", { timeout: 240_000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  const secret = "phase-two-notification-ui-test-secret-isolated-only-0001";
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  let next;
  let browser;
  let serverOutput = "";
  try {
    const uri = mongo.getUri("abii_notifications_ui_test");
    await mongoose.connect(uri);
    const user = await User.create({ name: "UI Learner", email: "phase-two@example.invalid", passwordHash: "test-hash", emailVerifiedAt: new Date() });
    await Notification.syncIndexes();
    await Notification.create([
      { userId: user._id, type: "badge_unlocked", title: "Badge unlocked", message: "Your first review badge is ready.", target: "/badges", dedupeKey: "ui:badge", metadata: { badgeId: "hello-abii" }, readAt: null },
      { userId: user._id, type: "study_streak", title: "Keep your streak going", message: "A short review today keeps your learning rhythm.", target: "/progress", dedupeKey: "ui:streak", metadata: {}, readAt: null },
      { userId: user._id, type: "account_security", title: "Password updated", message: "Your account password was changed.", target: "/settings", dedupeKey: "ui:security", metadata: {}, readAt: new Date(Date.now() - 60_000) },
    ]);
    const token = await new SignJWT({ sv: user.sessionVersion ?? 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(String(user._id)).setIssuedAt().setExpirationTime("10m").setIssuer(SESSION_ISSUER).setAudience(SESSION_AUDIENCE).sign(new TextEncoder().encode(secret));

    next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: process.cwd(), env: { ...process.env, MONGODB_URI: uri, AUTH_SECRET: secret, APP_BASE_URL: baseURL, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    next.stdout.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-6000); });
    next.stderr.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-6000); });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (next.exitCode !== null) throw new Error(`Next.js exited before ready (${next.exitCode}): ${serverOutput}`);
      try { const response = await fetch(`${baseURL}/login`); if (response.status < 500) { ready = true; break; } } catch { /* wait for server startup */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, `Next.js should become ready. Output: ${serverOutput}`);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const page = await context.newPage();
    const pageErrors = [];
    const mutationResponses = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", async (response) => { if (response.url().includes("/api/notifications/") && response.request().method() === "PATCH") mutationResponses.push({ url: response.url(), status: response.status(), body: await response.text().catch(() => "") }); });

    try {
      await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    } catch (error) {
      throw new Error(`Dashboard navigation failed: ${error instanceof Error ? error.message : String(error)}\nNext output: ${serverOutput}`);
    }
    const bell = page.getByRole("button", { name: "Notifications, 2 unread" });
    await bell.waitFor({ state: "visible", timeout: 15_000 });
    await bell.click();
    await page.getByRole("region", { name: "Recent notifications" }).waitFor({ state: "visible" });
    await page.getByText("Badge unlocked").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    assert.equal(await bell.evaluate((element) => element === document.activeElement), true, "Escape returns focus to the bell");
    await bell.click();
    await page.getByRole("link", { name: "View all notifications" }).click();
    await page.waitForURL("**/notifications");
    await page.getByRole("heading", { name: "Your Notifications" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Unread", exact: true }).click();
    assert.equal(await page.getByText("Password updated").count(), 0, "unread filter excludes already-read notices");
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByText("Password updated").waitFor({ state: "visible" });
    await page.getByRole("link", { name: /Badge unlocked/ }).click();
    await page.waitForURL("**/badges");
    const readBadge = await Notification.findOne({ userId: user._id, dedupeKey: "ui:badge" }).lean();
    assert.ok(readBadge?.readAt, `opening an unread item marks it read: ${JSON.stringify({ readAt: readBadge?.readAt, mutationResponses })}`);

    await page.goto(`${baseURL}/settings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Notification Preferences" }).waitFor({ state: "visible" });
    const security = page.getByRole("switch", { name: /Account & Security/ });
    assert.equal(await security.isDisabled(), true, "security preference cannot be toggled");
    const streak = page.getByRole("switch", { name: /Study Streak Reminders/ });
    await streak.click();
    await page.getByRole("button", { name: "Save Notification Preferences" }).click();
    await page.getByRole("status").filter({ hasText: "Notification preferences saved." }).waitFor({ state: "visible" });
    const stored = await User.findById(user._id).select("settings.notifications.study_streak").lean();
    assert.equal(stored?.settings?.notifications?.study_streak, false);

    const countRefresh = page.waitForResponse((response) => response.url().includes("/api/notifications/unread-count") && response.ok());
    await page.goto(`${baseURL}/notifications`, { waitUntil: "domcontentloaded" });
    await countRefresh;
    await page.getByRole("heading", { name: "Your Notifications" }).waitFor({ state: "visible" });
    await page.setViewportSize({ width: 320, height: 700 });
    await page.getByRole("button", { name: /Notifications/ }).click();
    const mobilePanel = page.getByRole("region", { name: "Recent notifications" });
    await mobilePanel.waitFor({ state: "visible", timeout: 6_000 });
    const mobileGeometry = await page.evaluate(() => document.querySelector('[aria-label="Recent notifications"]')?.getBoundingClientRect().toJSON());
    assert.ok(mobileGeometry && mobileGeometry.left >= 0 && mobileGeometry.right <= 320 && mobileGeometry.bottom <= 644, `320px panel stays above mobile nav: ${JSON.stringify(mobileGeometry)}`);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(os.tmpdir(), "abii-notification-center.png"), fullPage: true });
    for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      assert.ok(overflow.width <= overflow.client + 1, `${width}px Notification Center should not overflow horizontally`);
    }
    assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join("; ")}\n${serverOutput}`);
  } finally {
    await browser?.close();
    if (next && next.exitCode === null) { next.kill(); await new Promise((resolve) => next.once("exit", resolve)); }
    await mongoose.disconnect();
    await mongo.stop();
  }
});
