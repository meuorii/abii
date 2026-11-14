import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
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
import { QuizSession } from "../models/QuizSession.ts";
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

function createStreamingProxy(upstreamPort) {
  const gates = new Map();
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://proxy.local");
    if (requestUrl.pathname === "/__abii_test/arm") {
      const pathname = requestUrl.searchParams.get("pathname");
      const marker = requestUrl.searchParams.get("marker");
      assert.ok(pathname?.startsWith("/"), "a route pathname is required");
      assert.ok(marker, "a route skeleton marker is required");
      gates.set(pathname, { marker, held: false, used: false, upstream: null, clientResponse: null, tail: Buffer.alloc(0) });
      response.writeHead(204).end();
      return;
    }
    if (requestUrl.pathname === "/__abii_test/release") {
      const pathname = requestUrl.searchParams.get("pathname");
      const gate = gates.get(pathname);
      if (gate) {
        gate.released = true;
        if (gate.tail.length) gate.clientResponse?.write(gate.tail);
        gate.tail = Buffer.alloc(0);
      }
      if (gate?.upstream) gate.upstream.resume();
      response.writeHead(204).end();
      return;
    }
    if (requestUrl.pathname === "/__abii_test/state") {
      const pathname = requestUrl.searchParams.get("pathname");
      const gate = gates.get(pathname);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ held: gate?.held ?? false, used: gate?.used ?? false }));
      return;
    }

    const pathname = requestUrl.pathname;
    const gate = request.method === "GET" ? gates.get(pathname) : null;
    const upstreamRequest = http.request({
      hostname: "127.0.0.1",
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, host: `127.0.0.1:${upstreamPort}`, "accept-encoding": "identity" },
    }, (upstreamResponse) => {
      const contentType = String(upstreamResponse.headers["content-type"] ?? "");
      const shouldGate = gate && !gate.used && /text\/html/i.test(contentType);
      const headers = { ...upstreamResponse.headers };
      delete headers["content-length"];
      delete headers["content-encoding"];
      response.writeHead(upstreamResponse.statusCode ?? 502, headers);

      if (!shouldGate) {
        upstreamResponse.pipe(response);
        return;
      }

      gate.used = true;
      gate.upstream = upstreamResponse;
      let buffered = Buffer.alloc(0);
      upstreamResponse.on("data", (chunk) => {
        if (gate.released) {
          response.write(chunk);
          return;
        }
        if (gate.held) return;
        buffered = Buffer.concat([buffered, chunk]);
        const markerEnd = buffered.indexOf(Buffer.from(gate.marker));
        const boundaryEnd = markerEnd < 0 ? -1 : buffered.indexOf(Buffer.from("<!--/$-->"), markerEnd + gate.marker.length);
        if (boundaryEnd >= 0) {
          const fallbackEnd = boundaryEnd + "<!--/$-->".length;
          response.write(buffered.subarray(0, fallbackEnd));
          gate.tail = buffered.subarray(fallbackEnd);
          buffered = Buffer.alloc(0);
          response.flushHeaders();
          gate.held = true;
          upstreamResponse.pause();
          gate.clientResponse = response;
        } else if (buffered.length > 1_000_000) {
          response.write(buffered);
          buffered = Buffer.alloc(0);
        }
      });
      upstreamResponse.on("end", () => {
        if (buffered.length) response.write(buffered);
        response.end();
      });
      upstreamResponse.on("error", (error) => response.destroy(error));
    });
    upstreamRequest.on("error", (error) => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      response.writeHead(502).end(error.message);
    });
    request.pipe(upstreamRequest);
  });
  return server;
}

test("genuine authenticated App Router routes stream their skeletons before loaded content", { timeout: 600_000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  const secret = "abii-phase-four-route-loading-isolated-test-secret-001";
  const nextPort = await freePort();
  const proxyPort = await freePort();
  const baseURL = `http://127.0.0.1:${proxyPort}`;
  const nextCommand = process.env.ABII_SERVER_MODE === "production" ? "start" : "dev";
  let next;
  let browser;
  const proxy = createStreamingProxy(nextPort);
  let serverOutput = "";
  const artifacts = join(tmpdir(), "abii-phase4-skeleton-routes");

  try {
    process.env.MONGODB_URI = mongo.getUri("abii_skeleton_route_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.create({ name: "Loading Test Learner", email: "skeleton-route@example.invalid", passwordHash: "test-hash", emailVerifiedAt: new Date() });
    const subjectFolder = await SubjectFolder.create({ userId: user._id, name: "Science", normalizedName: "science", position: 0 });
    const subject = await Subject.create({ userId: user._id, subjectFolderId: subjectFolder._id, name: "Biology" });
    const folder = await Folder.create({ userId: user._id, subjectId: subject._id, name: "Unit one", position: 0 });
    const topic = await Topic.create({ userId: user._id, subjectId: subject._id, folderId: folder._id, name: "Cells", position: 0 });
    await Flashcard.create({ userId: user._id, subjectId: subject._id, topicId: topic._id, question: "What is a cell?", answer: "The basic unit of life." });
    const token = await new SignJWT({ sv: user.sessionVersion ?? 0 })
      .setProtectedHeader({ alg: "HS256" }).setSubject(String(user._id)).setIssuedAt().setExpirationTime("10m")
      .setIssuer(SESSION_ISSUER).setAudience(SESSION_AUDIENCE).sign(new TextEncoder().encode(secret));

    await new Promise((resolve) => proxy.listen(proxyPort, "127.0.0.1", resolve));
    proxy.unref();
    next = spawn(process.execPath, ["node_modules/next/dist/bin/next", nextCommand, "--hostname", "127.0.0.1", "--port", String(nextPort)], {
      cwd: process.cwd(),
      env: { ...process.env, MONGODB_URI: process.env.MONGODB_URI, AUTH_SECRET: secret, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    next.stdout.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-6000); });
    next.stderr.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-6000); });

    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (next.exitCode !== null) throw new Error(`Next.js exited before ready (${next.exitCode}). ${serverOutput}`);
      try {
        const response = await fetch(`${baseURL}/login`);
        if (response.status < 500) { ready = true; break; }
      } catch { /* wait for the production server */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, `Next.js App Router server should become ready. ${serverOutput}`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
    await context.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const page = await context.newPage();
    await page.addInitScript(() => {
      try { localStorage.setItem("abii-auto-next", JSON.stringify({ on: false, seconds: 2 })); } catch { /* storage may be disabled */ }
      window.__abiiLayoutShifts = [];
      try {
        new PerformanceObserver((entries) => {
          for (const entry of entries.getEntries()) if (!entry.hadRecentInput) window.__abiiLayoutShifts.push(entry.value);
        }).observe({ type: "layout-shift", buffered: true });
      } catch { /* layout-shift entries are not available in every runtime */ }
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration|validateDOMNesting/i.test(message.text())) pageErrors.push(`console ${message.type()}: ${message.text()}`);
    });

    await mkdir(artifacts, { recursive: true });
    const routes = [
      { path: "/dashboard", label: "Loading dashboard page" },
      { path: "/subjects", label: "Loading subjects page", responsive: true },
      { path: "/review", label: "Loading review page" },
      { path: "/progress", label: "Loading progress page" },
      { path: "/badges", label: "Loading badges page" },
      { path: "/settings", label: "Loading settings page" },
      { path: "/profile", label: "Loading profile page" },
    ];
    const geometryRows = [];
    let sessionId = "";

    async function captureRoute(route) {
      const pathname = new URL(route.path, baseURL).pathname;
      const viewport = { width: 1280, height: 900 };
      await page.setViewportSize(viewport);
      const errorOffset = pageErrors.length;
      await fetch(`${baseURL}/__abii_test/arm?pathname=${encodeURIComponent(pathname)}&marker=${encodeURIComponent(`aria-label=\"${route.label}\"`)}`);
      const navigation = page.goto(`${baseURL}${route.path}`, { waitUntil: "commit", timeout: 90_000 });
      const loading = page.getByRole("status", { name: route.label, exact: true });
      try {
        await loading.waitFor({ state: "visible", timeout: 15_000 });
      } catch (error) {
        const gateState = await fetch(`${baseURL}/__abii_test/state?pathname=${encodeURIComponent(pathname)}`).then((response) => response.json());
        throw new Error(`${route.path}: loading region did not become visible. Gate=${JSON.stringify(gateState)} URL=${page.url()} statuses=${JSON.stringify(await page.getByRole("status").allTextContents())} body=${(await page.locator("body").innerText()).slice(0, 800)} ${error.message}`);
      }
      const held = await fetch(`${baseURL}/__abii_test/state?pathname=${encodeURIComponent(pathname)}`).then((response) => response.json());
      assert.deepEqual(held, { held: true, used: true }, `${route.path}: the Next.js document stream should pause only after its actual route fallback markup arrives`);
      assert.equal(await loading.getAttribute("aria-busy"), "true", `${route.path}: pending route region should announce busy`);
      assert.equal(await loading.locator("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])").count(), 0, `${route.path}: placeholders must not be focusable`);
      const key = route.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      await page.screenshot({ path: join(artifacts, `${key}-1280-loading.png`), fullPage: true, caret: "initial" });
      const shimmer = await loading.locator(".abii-skeleton").first().evaluate((element) => {
        const style = getComputedStyle(element, "::after");
        return { name: style.animationName, duration: style.animationDuration, playState: style.animationPlayState, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, className: element.className, stylesheets: [...document.styleSheets].map((sheet) => sheet.href) };
      });
      assert.deepEqual({ name: shimmer.name, duration: shimmer.duration, playState: shimmer.playState }, { name: "skeleton-shimmer", duration: "2s", playState: "running" }, `${route.path}: route skeleton should use the unified shimmer; observed ${JSON.stringify(shimmer)}`);
      if (route.responsive) {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const staticPlaceholder = await loading.locator(".abii-skeleton").first().evaluate((element) => ({
          visible: element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
          animation: getComputedStyle(element, "::after").animationName,
        }));
        assert.deepEqual(staticPlaceholder, { visible: true, animation: "none" }, "real route placeholders remain visible and static under reduced motion");
        await page.emulateMedia({ reducedMotion: "no-preference" });
      }
      const loadingHero = await loading.locator("section[aria-hidden='true']").first().boundingBox();
      assert.ok(loadingHero, `${route.path}: route skeleton should render a major structural section`);
      const skeletonOverflow = [];

      if (route.responsive) {
        for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
          await page.setViewportSize({ width, height: width === 320 ? 568 : 820 });
          const overflow = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            document: document.documentElement.scrollWidth,
            shell: document.querySelector("main[data-authenticated-motion]")?.scrollWidth - document.querySelector("main[data-authenticated-motion]")?.clientWidth,
          }));
          assert.ok(overflow.document - overflow.viewport <= 1 && overflow.shell <= 1, `${route.path} pending at ${width}px overflows: ${JSON.stringify(overflow)}`);
          skeletonOverflow.push({ width, delta: overflow.document - overflow.viewport });
          if ([390, 1280].includes(width)) await page.screenshot({ path: join(artifacts, `subjects-${width}-loading.png`), fullPage: true, caret: "initial" });
        }
        await page.setViewportSize(viewport);
      } else {
        const key = route.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
        await page.screenshot({ path: join(artifacts, `${key}-1280-loading.png`), fullPage: true, caret: "initial" });
      }

      await fetch(`${baseURL}/__abii_test/release?pathname=${encodeURIComponent(pathname)}`);
      await navigation;
      await loading.waitFor({ state: "detached", timeout: 90_000 });
      await page.locator("main h1").first().waitFor({ state: "visible", timeout: 90_000 }).catch(async (error) => {
        throw new Error(`${route.path} did not resolve to page content. URL=${page.url()} body=${(await page.locator("body").innerText()).slice(0, 500)} browserErrors=${JSON.stringify(pageErrors.slice(errorOffset))} ${error.message}`);
      });
      await page.waitForFunction(() => {
        const root = document.querySelector("main[data-authenticated-motion]");
        let element = root?.querySelector("h1") ?? null;
        if (!root || !element) return false;
        while (element && element !== root) {
          if (Number.parseFloat(getComputedStyle(element).opacity) < 0.99) return false;
          element = element.parentElement;
        }
        return true;
      }, null, { timeout: 20_000 });
      await page.evaluate(async () => {
        const root = document.querySelector("main[data-authenticated-motion]");
        if (root) {
          const step = Math.max(240, Math.floor(root.clientHeight * 0.75));
          for (let top = 0; top < root.scrollHeight; top += step) {
            root.scrollTop = top;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }
          root.scrollTop = 0;
        }
      });
      await page.waitForFunction(() => Array.from(document.querySelectorAll(".abii-motion-reveal")).every((element) => Number.parseFloat(getComputedStyle(element).opacity) >= 0.99), null, { timeout: 20_000 });
      const loadedHero = await page.locator("main .abii-page-hero").first().boundingBox().catch(() => null);
      if (route.responsive) {
        for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
          await page.setViewportSize({ width, height: width === 320 ? 568 : 820 });
          const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
          assert.ok(overflow.document - overflow.viewport <= 1, `${route.path} loaded at ${width}px overflows: ${JSON.stringify(overflow)}`);
          if ([390, 1280].includes(width)) await page.screenshot({ path: join(artifacts, `subjects-${width}-loaded.png`), fullPage: true, caret: "initial" });
        }
        await page.setViewportSize(viewport);
      } else {
        const key = route.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
        await page.screenshot({ path: join(artifacts, `${key}-1280-loaded.png`), fullPage: true, caret: "initial" });
      }
      const shiftTotal = await page.evaluate(() => (window.__abiiLayoutShifts ?? []).reduce((sum, value) => sum + value, 0));
      const noRemainingRouteStatus = await loading.count() === 0;
      assert.equal(noRemainingRouteStatus, true, `${route.path}: route loader must be removed after resolution`);
      assert.deepEqual(pageErrors.slice(errorOffset), [], `${route.path} navigation should not produce hydration or browser errors: ${JSON.stringify(pageErrors.slice(errorOffset))}`);

      const diff = loadedHero ? {
        left: Math.round((loadingHero.x - loadedHero.x) * 10) / 10,
        top: Math.round((loadingHero.y - loadedHero.y) * 10) / 10,
        width: Math.round((loadingHero.width - loadedHero.width) * 10) / 10,
        height: Math.round((loadingHero.height - loadedHero.height) * 10) / 10,
      } : null;
      const outcome = loadedHero && Math.abs(diff.height) <= Math.max(20, loadedHero.height * 0.1) ? "PASS" : "PARTIAL";
      assert.equal(outcome, "PASS", `${route.path}: hero height difference ${diff?.height}px exceeds the geometry review tolerance`);
      geometryRows.push({
        route: route.path,
        viewport,
        skeletonObserved: true,
        loadedObserved: true,
        heroDifference: diff,
        skeletonHero: loadingHero,
        loadedHero,
        skeletonOverflow,
        layoutShiftTotal: Math.round(shiftTotal * 10000) / 10000,
        remainingRouteStatus: noRemainingRouteStatus,
        outcome,
      });

    }

    if (process.env.ABII_SKIP_ROUTE_MATRIX !== "1") {
      for (const route of routes) await captureRoute(route);
    }
    if (process.env.ABII_SKIP_ROUTE_MATRIX !== "1") {
      await page.goto(`${baseURL}/subjects/folders/${subjectFolder._id}`, { waitUntil: "networkidle", timeout: 90_000 });
      const subjectLink = page.getByRole("link", { name: "Biology", exact: true });
      await subjectLink.waitFor({ state: "visible", timeout: 30_000 });
      await subjectLink.evaluate((element, query) => { element.setAttribute("href", `${new URL(element.href).pathname}${query}`); }, `?phase4=${Date.now()}`);
      const detailPath = `/subjects/${subject._id}`;
      let releaseNested;
      const nestedGate = new Promise((resolve) => { releaseNested = resolve; });
      let sawNestedRequest;
      const nestedRequest = new Promise((resolve) => { sawNestedRequest = resolve; });
      const matchesSubjectDetail = (url) => new URL(url).pathname === detailPath;
      await page.route(matchesSubjectDetail, async (route) => {
        if (route.request().headers().rsc === "1") {
          sawNestedRequest();
          await nestedGate;
        }
        await route.continue();
      });
      const nestedLoading = page.getByRole("status", { name: "Loading subject detail page", exact: true });
      const clientNavigation = subjectLink.click({ noWaitAfter: true });
      let nestedSkeletonHero;
      try {
        await Promise.all([
          nestedRequest,
          nestedLoading.waitFor({ state: "visible", timeout: 20_000 }),
        ]);
        assert.equal(await nestedLoading.getAttribute("aria-busy"), "true");
        assert.equal(await nestedLoading.locator("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])").count(), 0);
        nestedSkeletonHero = await nestedLoading.locator("section[aria-hidden='true']").first().boundingBox();
        assert.ok(nestedSkeletonHero, "client navigation should show the Subject Detail skeleton structure");
        await page.screenshot({ path: join(artifacts, "subject-detail-client-navigation-loading.png"), fullPage: true, caret: "initial" });
        const nestedShimmer = await nestedLoading.locator(".abii-skeleton").first().evaluate((element) => {
          const style = getComputedStyle(element, "::after");
          return { name: style.animationName, duration: style.animationDuration };
        });
        assert.deepEqual(nestedShimmer, { name: "skeleton-shimmer", duration: "2s" });
      } finally {
        releaseNested();
      }
      await clientNavigation;
      await nestedLoading.waitFor({ state: "detached", timeout: 30_000 });
      await page.getByRole("heading", { name: "Biology", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForFunction(() => {
        const root = document.querySelector("main[data-authenticated-motion]");
        let element = root?.querySelector("h1") ?? null;
        if (!root || !element) return false;
        while (element && element !== root) {
          if (Number.parseFloat(getComputedStyle(element).opacity) < 0.99) return false;
          element = element.parentElement;
        }
        return true;
      }, null, { timeout: 20_000 });
      await page.evaluate(async () => {
        const root = document.querySelector("main[data-authenticated-motion]");
        if (!root) return;
        const step = Math.max(240, Math.floor(root.clientHeight * 0.75));
        for (let top = 0; top < root.scrollHeight; top += step) {
          root.scrollTop = top;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        root.scrollTop = 0;
      });
      await page.waitForFunction(() => Array.from(document.querySelectorAll(".abii-motion-reveal")).every((element) => Number.parseFloat(getComputedStyle(element).opacity) >= 0.99), null, { timeout: 20_000 });
      const nestedLoadedHero = await page.locator("main .abii-page-hero").first().boundingBox();
      assert.ok(nestedLoadedHero, "Subject Detail should resolve to its actual hero");
      await page.screenshot({ path: join(artifacts, "subject-detail-client-navigation-loaded.png"), fullPage: true, caret: "initial" });
      geometryRows.push({
        route: detailPath,
        navigation: "client-side",
        viewport: { width: 1280, height: 900 },
        skeletonObserved: true,
        loadedObserved: true,
        heroDifference: {
          left: Math.round((nestedSkeletonHero.x - nestedLoadedHero.x) * 10) / 10,
          top: Math.round((nestedSkeletonHero.y - nestedLoadedHero.y) * 10) / 10,
          width: Math.round((nestedSkeletonHero.width - nestedLoadedHero.width) * 10) / 10,
          height: Math.round((nestedSkeletonHero.height - nestedLoadedHero.height) * 10) / 10,
        },
        skeletonHero: nestedSkeletonHero,
        loadedHero: nestedLoadedHero,
        remainingRouteStatus: await nestedLoading.count() === 0,
        outcome: Math.abs(nestedSkeletonHero.height - nestedLoadedHero.height) <= Math.max(20, nestedLoadedHero.height * 0.1) ? "PASS" : "PARTIAL",
      });
      assert.equal(geometryRows.at(-1)?.outcome, "PASS", `Subject Detail client-navigation hero mismatch exceeds 10%: ${JSON.stringify(geometryRows.at(-1)?.heroDifference)}`);
      await page.unroute(matchesSubjectDetail);
    }
    await page.goto(`${baseURL}/review/setup?reviewFilter=all`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.locator("main h1").first().waitFor({ state: "visible", timeout: 30_000 });
    const started = await page.evaluate(async ({ subjectId, topicId }) => {
      const response = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "topic", subjectId, topicId, type: "identification", reviewFilter: "all" }),
      });
      return { status: response.status, body: await response.json() };
    }, { subjectId: String(subject._id), topicId: String(topic._id) });
    assert.equal(started.status, 201, `isolated quiz fixture should start: ${JSON.stringify(started.body)}`);
    assert.equal(typeof started.body.sessionId, "string");
    sessionId = started.body.sessionId;
    const storedSession = await QuizSession.findById(sessionId).select("questions.expectedAnswer").lean();
    const expectedAnswer = storedSession?.questions?.[0]?.expectedAnswer;
    assert.equal(typeof expectedAnswer, "string", "isolated quiz session should have a server-side expected answer");
    assert.ok(sessionId, "Review Setup should create a real isolated session for route and completion checks");
    await page.goto(`${baseURL}/review/quiz/${sessionId}`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.getByLabel("Your answer", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });

    for (let round = 1; round <= 3; round += 1) {
      await page.getByLabel("Your answer", { exact: true }).fill(expectedAnswer);
      await page.getByRole("button", { name: "Submit Answer" }).click();
      await page.getByRole("button", { name: "Finish Round" }).waitFor({ state: "visible", timeout: 20_000 });
      const answeredSession = await QuizSession.findById(sessionId).select("questions.expectedAnswer questions.correct questions.userAnswer").lean();
      assert.equal(answeredSession?.questions?.[0]?.correct, true, `round ${round} expected answer should grade correctly: ${JSON.stringify(answeredSession?.questions?.[0])}`);
      if (round < 3) {
        await page.getByRole("button", { name: "Finish Round" }).click();
        await page.getByLabel("Your answer", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
      }
    }

    let completionRequests = 0;
    let releaseCompletion;
    const completionGate = new Promise((resolve) => { releaseCompletion = resolve; });
    await page.route(`**/api/quiz/${sessionId}/finish`, async (route) => {
      completionRequests += 1;
      await completionGate;
      await route.continue();
    });
    const finishRequest = page.waitForRequest((request) => new URL(request.url()).pathname === `/api/quiz/${sessionId}/finish`);
    await page.getByRole("button", { name: "Finish Round" }).click();
    await finishRequest;
    const finishLoading = page.getByRole("status", { name: "Loading quiz completion page", exact: true });
    await finishLoading.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await page.getByRole("heading", { name: /You did it!/ }).count(), 0, "completed result must remain hidden until the server confirms the finish response");
    assert.equal(await finishLoading.locator(".abii-skeleton").first().evaluate((element) => getComputedStyle(element, "::after").animationName), "skeleton-shimmer");
    await page.screenshot({ path: join(artifacts, "quiz-completion-inline-loading.png"), fullPage: true, caret: "initial" });
    releaseCompletion();
    await page.getByRole("heading", { name: /You did it!/ }).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await finishLoading.count(), 0, "inline completion fallback should disappear after the result is confirmed");
    assert.equal(completionRequests, 1, "one user finish action should issue exactly one finish request");

    await writeFile(join(artifacts, "geometry.json"), JSON.stringify({ routes: geometryRows, inlineCompletion: { skeletonObserved: true, loadedObserved: true, requests: completionRequests }, artifacts }, null, 2));
    assert.deepEqual(pageErrors, [], `route navigation should not produce browser errors: ${JSON.stringify(pageErrors)}`);
    console.log(`Observed and resolved ${geometryRows.length} genuine App Router fallbacks plus inline completion. Geometry report and paired screenshots: ${artifacts}`);
  } catch (error) {
    await fetch(`${baseURL}/__abii_test/release?pathname=%2Fsubjects`).catch(() => {});
    throw new Error(`${error.message}\nNext.js output:\n${serverOutput}`, { cause: error });
  } finally {
    await browser?.close();
    if (next && next.exitCode === null) {
      let treeTerminated = false;
      if (process.platform === "win32" && next.pid) {
        const exitCode = await new Promise((resolve) => {
          const killer = spawn("taskkill", ["/PID", String(next.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
          killer.once("exit", (code) => resolve(code));
          killer.once("error", () => resolve(null));
        });
        treeTerminated = exitCode === 0;
      }
      if (!treeTerminated && next.exitCode === null) {
        next.kill(process.platform === "win32" ? "SIGINT" : "SIGTERM");
      }
      await Promise.race([once(next, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
    }
    const proxyClosed = new Promise((resolve) => proxy.close(() => resolve(true)));
    proxy.closeAllConnections();
    await Promise.race([proxyClosed, new Promise((resolve) => setTimeout(() => resolve(false), 2_000))]);
    await mongoose.disconnect();
    await mongo.stop();
    delete process.env.MONGODB_URI;
  }
});
