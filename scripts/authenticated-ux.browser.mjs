import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { Flashcard } from "../models/Flashcard.ts";
import { Folder } from "../models/Folder.ts";
import { Subject } from "../models/Subject.ts";
import { SubjectFolder } from "../models/SubjectFolder.ts";
import { Topic } from "../models/Topic.ts";
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

async function waitForVisiblePageHeading(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector("main[data-authenticated-motion]");
    let element = main?.querySelector("h1") ?? null;
    if (!main || !element) return false;
    while (element && element !== main) {
      if (Number.parseFloat(getComputedStyle(element).opacity) < 0.99) return false;
      element = element.parentElement;
    }
    return true;
  }, null, { timeout: 10_000 });
}

async function waitForRouteContent(page) {
  await page.locator('main [role="status"][aria-label^="Loading "]').waitFor({ state: "detached" });
}

async function revealScrollableContent(page) {
  await page.evaluate(async () => {
    const root = document.querySelector("main[data-authenticated-motion]");
    if (!root) return;
    const step = Math.max(240, Math.floor(root.clientHeight * 0.75));
    for (let top = 0; top < root.scrollHeight; top += step) {
      root.scrollTop = top;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    root.scrollTop = 0;
  });
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".abii-motion-reveal")).every((element) => Number.parseFloat(getComputedStyle(element).opacity) >= 0.99), null, { timeout: 10_000 }).catch(async (error) => {
    const hidden = await page.locator(".abii-motion-reveal").evaluateAll((elements) => elements.filter((element) => Number.parseFloat(getComputedStyle(element).opacity) < 0.99).map((element) => {
      const bounds = element.getBoundingClientRect();
      return { text: element.textContent?.trim().slice(0, 90), opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform, top: Math.round(bounds.top), height: Math.round(bounds.height), className: element.className };
    }));
    throw new Error(`ScrollReveal content remained hidden after a full root scroll: ${JSON.stringify(hidden)}` , { cause: error });
  });
}

test("authenticated routes remain accessible and fit the responsive viewport matrix", { timeout: 540_000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  const secret = "authenticated-ux-browser-test-secret-isolated-only-0001";
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  let next;
  let browser;
  let serverOutput = "";
  try {
    process.env.MONGODB_URI = mongo.getUri("abii_authenticated_ux_browser_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.create({ name: "UX Browser Learner", email: "phase-five@example.invalid", passwordHash: "test-hash", emailVerifiedAt: new Date() });
    const subjectFolder = await SubjectFolder.create({ userId: user._id, name: "Science", normalizedName: "science", position: 0 });
    const subject = await Subject.create({ userId: user._id, subjectFolderId: subjectFolder._id, name: "Long form biology subject name for responsive testing" });
    const folder = await Folder.create({ userId: user._id, subjectId: subject._id, name: "Unit one", position: 0 });
    const topic = await Topic.create({ userId: user._id, subjectId: subject._id, folderId: folder._id, name: "Long form topic title for responsive testing", position: 0 });
    await Flashcard.create({ userId: user._id, subjectId: subject._id, topicId: topic._id, question: "What is a cell?", answer: "The basic unit of life." });
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
    const context = await browser.newContext({ reducedMotion: "no-preference" });
    await context.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration|validateDOMNesting/i.test(message.text())) pageErrors.push(`console ${message.type()}: ${message.text()}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 500 && new URL(response.url()).origin === baseURL) pageErrors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    assert.equal(await skipLink.count(), 1, "authenticated pages should provide a keyboard skip link");
    await page.keyboard.press("Tab");
    assert.equal(await skipLink.evaluate((element) => element === document.activeElement), true, "the skip link should be the first keyboard target");
    await page.keyboard.press("Enter");
    assert.equal(await page.getByRole("main", { name: "Application content" }).evaluate((element) => element === document.activeElement), true, "activating the skip link should focus application content");
    const subjectId = String(subject._id);
    const topicId = String(topic._id);
    const folderId = String(folder._id);
    const subjectFolderId = String(subjectFolder._id);
    const routes = [
      "/dashboard", "/subjects", `/subjects/${subjectId}`, `/subjects/${subjectId}/topics/${topicId}`,
      `/subjects/${subjectId}/folders/${folderId}`, `/subjects/${subjectId}/folders/unfiled`,
      `/subjects/folders/${subjectFolderId}`, "/subjects/folders/unfiled", "/favorites", "/review",
      "/review/setup?reviewFilter=due", "/progress", "/badges", "/profile", "/settings",
    ];
    for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 820 });
      for (const route of routes) {
        await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        if (route === "/favorites") await page.waitForURL((url) => url.pathname === "/dashboard");
        await waitForRouteContent(page);
        await page.getByRole("main", { name: "Application content" }).waitFor({ state: "visible" });
        await page.locator("main h1").first().waitFor({ state: "visible", timeout: 45_000 }).catch((error) => {
          throw new Error(`Loaded page heading missing for ${route} at ${width}px (landed at ${page.url()}): ${error.message}`);
        });
        await waitForVisiblePageHeading(page);
        const unlabeledFields = await page.evaluate(() => Array.from(document.querySelectorAll("main input:not([type=hidden]), main select, main textarea"))
          .filter((field) => !field.labels?.length && !field.getAttribute("aria-label") && !field.getAttribute("aria-labelledby"))
          .map((field) => ({ tag: field.tagName, type: field.getAttribute("type"), name: field.getAttribute("name") })));
        assert.deepEqual(unlabeledFields, [], `${route} at ${width}px has unlabeled form controls`);
        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          shell: document.querySelector("main[data-authenticated-motion]")?.scrollWidth
            - document.querySelector("main[data-authenticated-motion]")?.clientWidth,
        }));
        assert.ok(overflow.document <= 1 && overflow.shell <= 1, `${route} at ${width}px overflow: ${JSON.stringify(overflow)}`);
        if (width < 1024) await page.getByRole("navigation", { name: "Mobile bottom navigation" }).waitFor({ state: "visible" });
        else await page.getByRole("navigation", { name: "Main navigation" }).waitFor({ state: "visible" });
        if (width < 1024) {
          const targetSizes = await page.locator('nav[aria-label="Mobile bottom navigation"] a').evaluateAll((links) => links.map((link) => {
            const bounds = link.getBoundingClientRect();
            return { width: bounds.width, height: bounds.height };
          }));
          assert.ok(targetSizes.every((size) => size.width >= 44 && size.height >= 44), `mobile navigation touch targets at ${width}px: ${JSON.stringify(targetSizes)}`);
        }
        if (route === `/subjects/${subjectId}` && width === 320) await page.screenshot({ path: join(tmpdir(), "abii-phase5-subject-320.png") });
        if (route === "/progress" && width === 768) {
          await revealScrollableContent(page);
          await page.screenshot({ path: join(tmpdir(), "abii-phase5-progress-768.png") });
        }
      }
      if (width === 1440) {
        await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
        await page.locator("main h1").first().waitFor({ state: "visible" });
      await waitForVisiblePageHeading(page);
        await page.screenshot({ path: join(tmpdir(), "abii-phase5-dashboard-1440.png") });
      }
    }

    await page.setViewportSize({ width: 390, height: 640 });
    await page.goto(`${baseURL}/subjects`, { waitUntil: "domcontentloaded" });
    await waitForRouteContent(page);
    const main = page.getByRole("main", { name: "Application content" });
    const scrollTopBeforeModal = await main.evaluate((element) => {
      element.scrollTop = Math.min(120, element.scrollHeight - element.clientHeight);
      return element.scrollTop;
    });
    assert.ok(scrollTopBeforeModal > 0, "the mobile subjects page should provide a scroll position to preserve");
    // The shell also exposes an Add Subject shortcut in mobile navigation.
    // Scope to page content so this activates the page's own dialog trigger.
    const addSubject = main.getByRole("button", { name: "Add Subject" }).first();
    assert.equal(await main.getByRole("button", { name: "Add Subject" }).count(), 1, `the subjects page should expose one content-level Add Subject trigger; page content=${JSON.stringify(await main.innerText())}`);
    const addSubjectHandle = await addSubject.elementHandle();
    await page.waitForFunction((element) => Object.keys(element ?? {}).some((key) => key.startsWith("__reactProps$")), addSubjectHandle, { timeout: 15_000 });
    const scrollTopBeforeClick = await main.evaluate((element) => element.scrollTop);
    assert.equal(scrollTopBeforeClick, scrollTopBeforeModal, "the modal trigger click should not move the underlying scroll root");
    await addSubject.click();
    const dialog = page.getByRole("dialog", { name: /create a subject/i });
    await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(async (error) => {
      const state = await page.evaluate(() => ({
        url: location.href,
        title: document.querySelector("main")?.innerText.slice(0, 800),
        overlay: document.querySelector(".abii-modal-overlay")?.outerHTML.slice(0, 500),
        dialogs: Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).map((element) => ({ role: element.getAttribute("role"), name: element.getAttribute("aria-labelledby"), text: element.textContent?.slice(0, 100) })),
      }));
      throw new Error(`Create Subject modal did not open: ${JSON.stringify({ state, pageErrors })}; ${error.message}`);
    });
    assert.equal(await dialog.evaluate((element) => getComputedStyle(element.parentElement).zIndex), "120");
    assert.equal(await main.evaluate((element) => getComputedStyle(element).overflowY), "hidden", "opening a modal should lock the authenticated scroll root");
    const scrollTopAfterOpen = await main.evaluate((element) => element.scrollTop);
    assert.equal(scrollTopAfterOpen, scrollTopBeforeModal, `opening a modal should preserve the underlying scroll offset (before click ${scrollTopBeforeClick}, before modal ${scrollTopBeforeModal}, after open ${scrollTopAfterOpen})`);
    const dialogButtons = dialog.getByRole("button");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialogButtons.last().evaluate((element) => element === document.activeElement), true, "Shift+Tab should wrap to the last control");
    await page.keyboard.press("Tab");
    assert.equal(await dialogButtons.first().evaluate((element) => element === document.activeElement), true, "Tab should wrap to the first control");
    await page.waitForFunction(() => !document.getAnimations().some((animation) => animation.playState === "running"));
    await page.screenshot({ path: join(tmpdir(), "abii-phase5-modal-390.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await main.evaluate((element) => element.scrollTop), scrollTopBeforeModal, "closing a modal should restore the underlying scroll offset");
    assert.equal(await addSubject.evaluate((element) => element === document.activeElement), true, "closing the dialog should restore focus to its trigger");

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await touchContext.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const touchPage = await touchContext.newPage();
    const touchErrors = [];
    touchPage.on("pageerror", (error) => touchErrors.push(error.message));
    await touchPage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await touchPage.locator("main h1").first().waitFor({ state: "visible" });
    await touchPage.getByRole("navigation", { name: "Mobile bottom navigation" }).getByRole("link", { name: "Review" }).tap();
    await touchPage.waitForURL((url) => url.pathname === "/review");
    await touchPage.getByRole("navigation", { name: "Mobile bottom navigation" }).getByRole("link", { name: "Subjects" }).tap();
    await touchPage.waitForURL((url) => url.pathname === "/subjects");
    await waitForRouteContent(touchPage);
    const touchAddSubject = touchPage.getByRole("main", { name: "Application content" }).getByRole("button", { name: "Add Subject" }).first();
    const touchAddSubjectHandle = await touchAddSubject.elementHandle();
    await touchPage.waitForFunction((element) => Object.keys(element ?? {}).some((key) => key.startsWith("__reactProps$")), touchAddSubjectHandle, { timeout: 15_000 });
    await touchAddSubject.tap();
    const touchDialog = touchPage.getByRole("dialog", { name: /create a subject/i });
    await touchDialog.waitFor({ state: "visible" });
    await touchDialog.getByRole("button", { name: "Cancel" }).tap();
    await touchDialog.waitFor({ state: "detached" });
    await touchPage.getByRole("button", { name: "Open account menu" }).tap();
    await touchPage.getByRole("link", { name: "Profile" }).tap();
    await touchPage.waitForURL((url) => url.pathname === "/profile");
    const touchOverflow = await touchPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(touchOverflow <= 1, `390px touch-emulated profile overflows by ${touchOverflow}px`);
    assert.deepEqual(touchErrors, [], `touch-emulated navigation should not produce page errors: ${JSON.stringify(touchErrors)}`);
    await touchContext.close();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${baseURL}/progress`, { waitUntil: "domcontentloaded" });
    await page.locator("main h1").first().waitFor({ state: "visible" });
    const hiddenRevealCount = await page.locator(".abii-motion-reveal").evaluateAll((items) => items.filter((item) => Number.parseFloat(getComputedStyle(item).opacity) < 1).length);
    assert.equal(hiddenRevealCount, 0, "reduced-motion users should see all scroll-reveal content immediately");

    const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
    await fallbackContext.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const fallbackPage = await fallbackContext.newPage();
    await fallbackPage.addInitScript(() => {
      Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined });
    });
    await fallbackPage.goto(`${baseURL}/progress`, { waitUntil: "domcontentloaded" });
    await waitForRouteContent(fallbackPage);
    await fallbackPage.locator("main h1").first().waitFor({ state: "visible" });
    assert.equal(await fallbackPage.evaluate(() => typeof IntersectionObserver), "undefined", "the observer fallback scenario should disable IntersectionObserver");
    const fallbackHiddenCount = await fallbackPage.locator(".abii-motion-reveal").evaluateAll((items) => items.filter((item) => Number.parseFloat(getComputedStyle(item).opacity) < 1).length);
    assert.equal(fallbackHiddenCount, 0, "missing IntersectionObserver must leave all scroll-reveal content visible");
    await fallbackContext.close();

    assert.deepEqual(pageErrors, [], `browser should not report uncaught page errors: ${JSON.stringify(pageErrors)}`);
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
