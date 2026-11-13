import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

test("Profile hero and account actions render responsively and announce server outcomes", { timeout: 360_000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  const secret = "profile-actions-browser-test-secret-isolated-only-0001";
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  let next;
  let browser;
  let serverOutput = "";

  try {
    process.env.MONGODB_URI = mongo.getUri("abii_profile_actions_browser_test");
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.create({
      name: "Browser Learner",
      email: "profile-actions@example.invalid",
      passwordHash: "test-hash",
      emailVerifiedAt: new Date(),
      profileImage: "/abii-head.png",
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
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.addCookies([{ name: "abii_session", value: token, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      const text = message.text();
      const expectedMockFailure = /Failed to load resource: the server responded with a status of (400|503)/i.test(text);
      if ((message.type() === "error" && !expectedMockFailure) || /hydration|validateDOMNesting/i.test(text)) pageErrors.push(text);
    });

    let failNameUpdate = true;
    let failPhotoUpdate = true;
    let failPhotoRemoval = true;
    let failPasswordChange = true;
    let failAccountDeletion = true;
    let savedPhotoUrl = "/abii-head.png";

    await page.route("**/api/account/profile", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (failNameUpdate) {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Your name could not be saved." }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { name: body.name }, message: "Name saved." }) });
    });
    await page.route("**/api/account/profile-picture", async (route) => {
      if (route.request().method() === "PATCH") {
        if (failPhotoUpdate) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The photo could not be saved." }) });
          return;
        }
        savedPhotoUrl = savedPhotoUrl.includes("version=") ? "/abii-head.png?version=recropped" : "/abii-head.png?version=updated";
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profileImage: savedPhotoUrl }) });
        return;
      }
      if (failPhotoRemoval) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The photo could not be removed." }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Profile photo removed." }) });
    });
    await page.route("**/api/account/password", async (route) => {
      if (failPasswordChange) {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "The current password is incorrect." }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ redirectTo: "/login" }) });
    });
    await page.route("**/api/account", async (route) => {
      assert.equal(route.request().method(), "DELETE");
      assert.deepEqual(JSON.parse(route.request().postData() ?? "{}"), { confirmation: "DELETE" });
      if (failAccountDeletion) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Your account could not be deleted." }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Account deleted.", redirectTo: "/" }) });
    });

    const routeProfile = async () => {
      await page.goto(`${baseURL}/profile`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.getByRole("heading", { level: 1, name: "Your Profile, Your Space." }).waitFor({ state: "visible", timeout: 45_000 });
      await page.getByLabel("Choose profile photo").waitFor({ state: "visible" });
    };
    const toast = (role, title) => page.getByRole(role).filter({ hasText: title }).last();

    await page.goto(`${baseURL}/profile`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.locator("main h1").first().waitFor({ state: "visible", timeout: 45_000 });
    failNameUpdate = false;
    await page.getByLabel("Full name").fill("Browser Learner Baseline");
    const baselineNameResponse = page.waitForResponse((response) => response.url().includes("/api/account/profile") && response.request().method() === "PATCH", { timeout: 10_000 });
    await page.getByRole("button", { name: "Save name" }).click();
    await baselineNameResponse;
    await toast("status", "Profile updated!").waitFor({ state: "visible", timeout: 1_500 });
    const baselineToast = toast("status", "Profile updated!");
    await baselineToast.getByRole("button", { name: "Dismiss notification" }).click();
    await baselineToast.waitFor({ state: "detached" });

    for (const { width, height } of [
      { width: 320, height: 568 }, { width: 375, height: 820 }, { width: 390, height: 820 }, { width: 430, height: 820 },
      { width: 768, height: 820 }, { width: 1024, height: 820 }, { width: 1280, height: 820 }, { width: 1440, height: 820 },
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => { document.querySelector("main[data-authenticated-motion]").scrollTop = 0; });
      await page.waitForFunction(() => {
        const image = document.querySelector('.abii-page-hero img[alt="Abii the pink otter smiling and waving"]');
        return Boolean(image?.complete && image.naturalWidth > 0);
      }, undefined, { timeout: 10_000 });
      const geometry = await page.evaluate(() => {
        const hero = document.querySelector(".abii-page-hero");
        const overview = document.querySelector('section[aria-label="Account overview"]');
        const heading = document.querySelector(".abii-page-hero h1");
        const mascot = document.querySelector(".abii-page-hero__mascot");
        const box = (element) => {
          const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        const image = document.querySelector('.abii-page-hero img[alt="Abii the pink otter smiling and waving"]');
        return {
          hero: box(hero), overview: box(overview), heading: box(heading), mascot: box(mascot),
          imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          shellOverflow: document.querySelector("main[data-authenticated-motion]").scrollWidth - document.querySelector("main[data-authenticated-motion]").clientWidth,
          headingMascotOverlap: Math.min(box(heading).right, box(mascot).right) > Math.max(box(heading).left, box(mascot).left)
            && Math.min(box(heading).bottom, box(mascot).bottom) > Math.max(box(heading).top, box(mascot).top),
        };
      });
      assert.ok(Math.abs(geometry.hero.left - geometry.overview.left) <= 2 && Math.abs(geometry.hero.right - geometry.overview.right) <= 2,
        `Profile hero and account overview should share page edges at ${width}px: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.imageLoaded, true, `profile mascot should load at ${width}px`);
      assert.ok(geometry.documentOverflow <= 1 && geometry.shellOverflow <= 1, `Profile should not overflow at ${width}px: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.headingMascotOverlap, false, `Profile heading should not overlap its mascot at ${width}px: ${JSON.stringify(geometry)}`);
      assert.equal(await page.locator("main h1").count(), 1, `Profile should have one primary heading at ${width}px`);
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: join(tmpdir(), `abii-profile-hero-${width}.png`), caret: "initial" });
      }
    }

    await page.setViewportSize({ width: 390, height: 820 });
    await routeProfile();
    await page.getByLabel("Choose profile photo").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
    await toast("alert", "Choose a supported photo").waitFor({ state: "visible" });

    const nameInput = page.getByLabel("Full name");
    await nameInput.fill("   ");
    await page.getByRole("button", { name: "Save name" }).click();
    await toast("alert", "Check your name").waitFor({ state: "visible" });
    assert.equal(await nameInput.getAttribute("aria-invalid"), "true");

    failNameUpdate = true;
    await nameInput.fill("Browser Learner Updated");
    const failedNameResponse = page.waitForResponse((response) => response.url().includes("/api/account/profile") && response.request().method() === "PATCH", { timeout: 10_000 });
    await page.getByRole("button", { name: "Save name" }).click();
    assert.equal((await failedNameResponse).status(), 400);
    await toast("alert", "Could not update your profile").waitFor({ state: "visible" });
    failNameUpdate = false;
    await page.getByRole("button", { name: "Save name" }).click();
    await toast("status", "Profile updated!").waitFor({ state: "visible" });
    assert.equal(await page.locator('section[aria-label="Account overview"]').getByText("Browser Learner Updated", { exact: true }).count(), 1, "the Profile name should reflect the confirmed response");

    await page.setViewportSize({ width: 1440, height: 820 });
    await page.getByRole("button", { name: "Open account menu" }).click();
    assert.equal(await page.locator('button[aria-label="Open account menu"] span.truncate').innerText(), "Browser Learner Updated", "AppShell should receive the saved name event");
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.setViewportSize({ width: 390, height: 820 });

    const photoPath = fileURLToPath(new URL("../public/dashboard-hero/profile-hero.png", import.meta.url));
    await page.getByLabel("Choose profile photo").setInputFiles(photoPath);
    let cropDialog = page.getByRole("dialog", { name: "Edit Profile Picture" });
    await cropDialog.waitFor({ state: "visible" });
    await cropDialog.getByRole("button", { name: "Save Photo" }).waitFor({ state: "visible" });
    await cropDialog.getByRole("button", { name: "Save Photo" }).click();
    await toast("alert", "Could not update profile photo").waitFor({ state: "visible" });
    await cropDialog.waitFor({ state: "visible" });
    assert.equal(await page.locator('img[alt="Browser Learner Updated profile photo"]').first().getAttribute("src"), "/abii-head.png", "a failed photo save should preserve the previously saved image");
    failPhotoUpdate = false;
    await cropDialog.getByRole("button", { name: "Save Photo" }).click();
    await cropDialog.waitFor({ state: "detached" });
    const photoUpdatedToast = toast("status", "Profile photo updated!");
    await photoUpdatedToast.waitFor({ state: "visible" });
    assert.equal(await photoUpdatedToast.getByText("Your new profile picture is saved and ready to go.").count(), 1);
    assert.equal(await page.locator('img[alt="Browser Learner Updated profile photo"][src*="version=updated"]').count(), 2, "the confirmed image should update both Profile previews");
    const photoToastBox = await photoUpdatedToast.boundingBox();
    assert.ok(photoToastBox && photoToastBox.x >= 0 && photoToastBox.x + photoToastBox.width <= 390, `photo toast should fit the mobile viewport: ${JSON.stringify(photoToastBox)}`);
    assert.ok(Number(await photoUpdatedToast.evaluate((element) => getComputedStyle(element.parentElement).zIndex)) > 30, "toasts should stack above mobile navigation");

    await page.getByRole("button", { name: "Edit crop" }).click();
    cropDialog = page.getByRole("dialog", { name: "Edit Profile Picture" });
    await cropDialog.waitFor({ state: "visible" });
    await cropDialog.getByRole("button", { name: "Save Photo" }).click();
    await cropDialog.waitFor({ state: "detached" });
    await toast("status", "Profile photo updated!").waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Remove" }).click();
    await toast("alert", "Could not remove profile photo").waitFor({ state: "visible" });
    assert.equal(await page.locator('img[alt="Browser Learner Updated profile photo"]').count(), 2, "a failed removal should preserve the current image");
    failPhotoRemoval = false;
    await page.getByRole("button", { name: "Remove" }).click();
    await toast("status", "Profile photo removed.").waitFor({ state: "visible" });
    assert.equal(await page.locator('img[alt="Browser Learner Updated profile photo"]').count(), 0, "a confirmed removal should clear both Profile previews");

    await page.getByLabel("Current password").fill("IncorrectCurrent123");
    await page.getByLabel("New password", { exact: true }).fill("NewPassword123");
    await page.getByLabel("Confirm new password").fill("NewPassword123");
    await page.getByRole("button", { name: "Change password" }).click();
    await toast("alert", "Could not change password").waitFor({ state: "visible" });
    failPasswordChange = false;
    await page.getByLabel("Current password").fill("CurrentPassword123");
    await page.getByRole("button", { name: "Change password" }).click();
    await toast("status", "Password changed successfully!").waitFor({ state: "visible" });
    await page.waitForURL((url) => url.pathname === "/login");
    await toast("status", "Password changed successfully!").waitFor({ state: "visible" });

    await routeProfile();
    const deleteTrigger = page.getByRole("button", { name: "Delete account" });
    await deleteTrigger.click();
    const deleteDialog = page.getByRole("alertdialog", { name: "Delete your account?" });
    await deleteDialog.waitFor({ state: "visible" });
    assert.equal(await deleteDialog.evaluate((dialog) => dialog.contains(document.activeElement)), true, "the confirmation should receive keyboard focus");
    await page.keyboard.press("Escape");
    await deleteDialog.waitFor({ state: "detached" });
    assert.equal(await deleteTrigger.evaluate((trigger) => document.activeElement === trigger), true, "Escape should restore focus to the delete trigger");
    await deleteTrigger.click();
    await deleteDialog.waitFor({ state: "visible" });
    await deleteDialog.getByLabel("Type DELETE to confirm").fill("DELETE");
    await deleteDialog.getByRole("button", { name: "Delete account" }).click();
    await toast("alert", "Could not delete account").waitFor({ state: "visible" });
    assert.equal(await deleteDialog.isVisible(), true, "a failed deletion should keep the confirmation open for retry");
    assert.equal(await deleteDialog.getByLabel("Type DELETE to confirm").inputValue(), "DELETE", "a failed deletion should preserve confirmation text");
    failAccountDeletion = false;
    await deleteDialog.getByRole("button", { name: "Delete account" }).click();
    await toast("status", "Account deleted.").waitFor({ state: "visible" });
    await page.waitForURL((url) => url.pathname === "/");
    await toast("status", "Account deleted.").waitFor({ state: "visible" });

    assert.deepEqual(pageErrors, [], `Profile workflows should not produce browser errors: ${JSON.stringify(pageErrors)}`);
    await context.close();
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
