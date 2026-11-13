import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { Flashcard } from "../models/Flashcard.ts";
import { ReviewRecord } from "../models/ReviewRecord.ts";
import { Subject } from "../models/Subject.ts";
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

test("browser completes Due Review with persisted retry rounds and does not restart a stale due set", { timeout: 180_000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  const secret = "phase-four-browser-test-secret-keep-this-isolated-0001";
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  let next;
  let browser;
  let serverOutput = "";
  try {
    process.env.MONGODB_URI = mongo.getUri("abii_due_review_browser_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.create({ name: "Browser Learner", email: "phase-four@example.invalid", passwordHash: "test-hash", emailVerifiedAt: new Date() });
    const subject = await Subject.create({ userId: user._id, name: "Recall" });
    const [dueCard, futureCard, distractor] = await Flashcard.create([
      { userId: user._id, subjectId: subject._id, question: "What is the due answer?", answer: "Durable" },
      { userId: user._id, subjectId: subject._id, question: "Future prompt", answer: "Future" },
      { userId: user._id, subjectId: subject._id, question: "Distractor prompt", answer: "Other" },
    ]);
    const dueAt = new Date(Date.now() - 60_000);
    await ReviewRecord.create([
      { userId: user._id, flashcardId: futureCard._id, questionType: "identification", result: "correct", reviewedAt: dueAt, nextReviewAt: new Date(Date.now() + 86_400_000) },
      { userId: user._id, flashcardId: distractor._id, questionType: "identification", result: "correct", reviewedAt: dueAt, nextReviewAt: new Date(Date.now() + 86_400_000) },
    ]);
    const token = await new SignJWT({ sv: user.sessionVersion ?? 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(String(user._id)).setIssuedAt().setExpirationTime("10m").setIssuer(SESSION_ISSUER).setAudience(SESSION_AUDIENCE).sign(new TextEncoder().encode(secret));
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
      } catch { /* wait for the local server */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, "Next.js development server should become ready");

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ reducedMotion: "no-preference" });
    await context.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const page = await context.newPage();
    const pageErrors = [];
    const setupNetwork = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("status of 422")) pageErrors.push(message.text()); });
    page.on("request", (request) => { if (request.url().includes("/review/setup")) setupNetwork.push(`request ${request.url()}`); });
    page.on("response", (response) => { if (response.url().includes("/review/setup")) setupNetwork.push(`response ${response.status()} ${response.url()}`); });

    await page.goto(`${baseURL}/dashboard`, { waitUntil: "load", timeout: 90_000 }).catch((error) => {
      throw new Error(`Dashboard navigation failed: ${error.message}\nNext.js output:\n${serverOutput}`);
    });
    await page.getByRole("link", { name: "Start Due Review" }).click();
    await page.waitForURL((url) => url.pathname === "/review/setup" && url.searchParams.get("reviewFilter") === "due", { timeout: 10_000 }).catch(async (error) => {
      const links = await page.locator("a").evaluateAll((items) => items.map((item) => ({ text: item.textContent?.trim(), href: item.getAttribute("href") })));
      throw new Error(`Dashboard review link did not open due setup. Current URL: ${page.url()}; links: ${JSON.stringify(links)}; browser errors: ${JSON.stringify(pageErrors)}; requests: ${JSON.stringify(setupNetwork)}; server: ${serverOutput}; ${error.message}`);
    });
    await page.getByRole("radio", { name: /Due Review/ }).waitFor();
    await page.getByRole("radio", { name: /question.*Identification Recall and type/ }).click();
    await page.getByRole("button", { name: /Start Review/ }).click();
    await page.waitForURL(/\/review\/quiz\/[a-f\d]+/i);
    await page.getByText("What is the due answer?").waitFor();

    for (let round = 1; round <= 3; round += 1) {
      const answer = page.getByRole("textbox", { name: "Your answer" });
      await answer.fill("Durable");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: /Finish Round/ }).waitFor();
      const recordsForSession = await ReviewRecord.countDocuments({ userId: user._id, flashcardId: dueCard._id, result: "correct" });
      assert.equal(recordsForSession, round, `round ${round} should persist exactly one answer`);
      await page.getByRole("button", { name: /Finish Round/ }).click();
      if (round < 3) await page.getByRole("textbox", { name: "Your answer" }).waitFor();
    }

    await page.getByRole("heading", { name: /You did it!/ }).waitFor();
    const confetti = page.locator("body > div[aria-hidden='true'][class*='pointer-events-none']");
    await confetti.waitFor({ state: "attached" });
    const decoration = confetti.last();
    assert.equal(await decoration.evaluate((element) => getComputedStyle(element).pointerEvents), "none");
    assert.equal(await ReviewRecord.countDocuments({ userId: user._id, flashcardId: dueCard._id }), 3);

    const staleDueResponse = page.waitForResponse((response) => response.url().includes("/api/quiz/start") && response.status() === 422);
    await page.getByRole("button", { name: "Review Again" }).click();
    assert.equal((await staleDueResponse).status(), 422, "a new due-only session must re-evaluate the current schedule");
    await page.getByRole("main").getByRole("alert").filter({ hasText: /no due flashcards eligible/i }).waitFor();
    assert.deepEqual(pageErrors, [], "browser execution should not produce uncaught page errors");
    assert.equal(await ReviewRecord.countDocuments({ userId: user._id, flashcardId: dueCard._id }), 3);

    const reducedCard = await Flashcard.create({ userId: user._id, subjectId: subject._id, question: "Reduced motion prompt", answer: "Calm" });
    const reducedContext = await browser.newContext({ reducedMotion: "reduce" });
    await reducedContext.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto(`${baseURL}/review/setup?reviewFilter=due`, { waitUntil: "load", timeout: 90_000 });
    await reducedPage.getByRole("radio", { name: /question.*Identification Recall and type/ }).click();
    await reducedPage.getByRole("button", { name: /Start Review/ }).click();
    await reducedPage.waitForURL(/\/review\/quiz\/[a-f\d]+/i);
    for (let round = 1; round <= 3; round += 1) {
      const answer = reducedPage.getByRole("textbox", { name: "Your answer" });
      await answer.fill("Calm");
      await answer.press("Enter");
      await reducedPage.getByRole("button", { name: /Finish Round/ }).waitFor();
      await reducedPage.getByRole("button", { name: /Finish Round/ }).click();
      if (round < 3) await reducedPage.getByRole("textbox", { name: "Your answer" }).waitFor();
    }
    await reducedPage.getByRole("heading", { name: /You did it!/ }).waitFor();
    assert.equal(await reducedPage.locator("body > div[aria-hidden='true'][class*='pointer-events-none']").count(), 0, "reduced-motion preference suppresses the confetti effect");
    assert.equal(await ReviewRecord.countDocuments({ userId: user._id, flashcardId: reducedCard._id }), 3);
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
