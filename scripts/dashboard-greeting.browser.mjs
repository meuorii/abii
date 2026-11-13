import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { User } from "../models/User.ts";
import { SESSION_AUDIENCE, SESSION_ISSUER } from "../lib/auth/constants.ts";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

test("Dashboard greeting follows browser timezone, updates across boundaries, and preserves study timezone", { timeout: 180_000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  const secret = "dashboard-greeting-browser-test-secret-isolated-0001";
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  let next;
  let browser;
  let serverOutput = "";

  try {
    process.env.MONGODB_URI = mongo.getUri("abii_dashboard_greeting_browser_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.create({
      name: "Browser Learner",
      email: "dashboard-greeting@example.invalid",
      passwordHash: "test-hash",
      emailVerifiedAt: new Date(),
      settings: { studyTimezone: "UTC" },
    });
    const token = await new SignJWT({ sv: user.sessionVersion ?? 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(user._id))
      .setIssuedAt()
      .setExpirationTime("10m")
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .sign(new TextEncoder().encode(secret));

    next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: process.cwd(),
      env: { ...process.env, MONGODB_URI: process.env.MONGODB_URI, AUTH_SECRET: secret, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    next.stdout.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-5000); });
    next.stderr.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-5000); });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (next.exitCode !== null) throw new Error(`Next.js exited before ready (${next.exitCode}).`);
      try {
        const response = await fetch(`${baseURL}/login`);
        if (response.status < 500) { ready = true; break; }
      } catch { /* wait for the isolated server */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, `Next.js should become ready. Output: ${serverOutput}`);

    browser = await chromium.launch({ headless: true });
    const pageErrors = [];
    const serverOnlyContext = await browser.newContext({ javaScriptEnabled: false, timezoneId: "Asia/Manila" });
    await serverOnlyContext.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const serverOnlyPage = await serverOnlyContext.newPage();
    await serverOnlyPage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    assert.equal(await serverOnlyPage.getByText("Welcome back, Browser!").count(), 1, "server markup should use the timezone-neutral greeting");
    assert.equal(await serverOnlyPage.getByText(/Good (?:morning|afternoon|evening), Browser!/).count(), 0, "server output must not guess a timezone-specific greeting");
    await serverOnlyContext.close();

    const manila = await browser.newContext({ timezoneId: "Asia/Manila", reducedMotion: "reduce" });
    await manila.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const page = await manila.newPage();
    await page.clock.install({ time: new Date("2026-11-13T10:42:00.000Z") });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration|validateDOMNesting/i.test(message.text())) pageErrors.push(message.text());
    });
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByText("Good evening, Browser!").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), "Asia/Manila");

    await page.clock.setFixedTime(new Date("2026-11-14T09:59:00.000Z"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByText("Good afternoon, Browser!").waitFor({ state: "visible" });
    await page.clock.setFixedTime(new Date("2026-11-14T10:00:00.000Z"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.getByText("Good evening, Browser!").waitFor({ state: "visible" });

    const transitionContext = await browser.newContext({ timezoneId: "Asia/Manila", reducedMotion: "reduce" });
    await transitionContext.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const transitionPage = await transitionContext.newPage();
    await transitionPage.clock.install({ time: new Date("2026-11-13T09:59:00.000Z") });
    await transitionPage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await transitionPage.getByText("Good afternoon, Browser!").waitFor({ state: "visible" });
    await transitionPage.clock.fastForward(60_000);
    await transitionPage.getByText("Good evening, Browser!").waitFor({ state: "visible" });
    await transitionContext.close();

    for (const { timezoneId, greeting } of [
      { timezoneId: "America/New_York", greeting: "Good morning" },
      { timezoneId: "Europe/Paris", greeting: "Good morning" },
    ]) {
      const context = await browser.newContext({ timezoneId, reducedMotion: "reduce" });
      await context.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
      const timezonePage = await context.newPage();
      await timezonePage.clock.install({ time: new Date("2026-11-13T10:42:00.000Z") });
      timezonePage.on("pageerror", (error) => pageErrors.push(error.message));
      timezonePage.on("console", (message) => {
        if (message.type() === "error" || /hydration|validateDOMNesting/i.test(message.text())) pageErrors.push(message.text());
      });
      await timezonePage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await timezonePage.getByText(`${greeting}, Browser!`).waitFor({ state: "visible" });
      assert.equal(await timezonePage.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), timezoneId);
      await context.close();
    }

    const savedUser = await User.findById(user._id).select("settings.studyTimezone").lean();
    assert.equal(savedUser?.settings?.studyTimezone, "UTC", "browser timezone detection must not change the saved study timezone");
    assert.deepEqual(pageErrors, [], `browser should not report greeting or hydration errors: ${JSON.stringify(pageErrors)}`);
    await manila.close();
  } finally {
    await browser?.close();
    if (next && next.exitCode === null) {
      next.kill();
      await Promise.race([once(next, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
    }
    await mongoose.disconnect();
    await mongo.stop();
    delete process.env.MONGODB_URI;
  }
});
