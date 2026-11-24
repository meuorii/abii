import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { digest, prepareEnrollment, totpAt } from "../lib/auth/admin-factor-crypto.ts";

async function startServer(env) {
  const probe = createServer(); await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve)); const { port } = probe.address(); await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`; const child = spawn(process.execPath, ["scripts/topic-test-server.mjs", String(port)], { env: { ...process.env, ...env, APP_BASE_URL: base, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = ""; for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output = (output + chunk).slice(-4000); });
  const stop = async () => { if (child.exitCode !== null) return; const closed = new Promise(resolve => child.once("exit", resolve)); child.kill(); await closed; };
  try { for (let attempt = 0; attempt < 160; attempt++) { if (output.includes("Ready in test server")) return { base, stop }; if (child.exitCode !== null) break; await delay(250); } throw new Error(`Support test server did not start: ${output}`); } catch (error) { await stop(); throw error; }
}

test("support management browser workflow is isolated, accessible, and replay-safe", { timeout: 180_000 }, async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); const uri = replica.getUri("support_browser_fixture"); const secret = randomBytes(32).toString("hex");
  const env = { MONGODB_URI: uri, AUTH_SECRET: secret, AUTH_OTP_SECRET: randomBytes(32).toString("hex"), ADMIN_MFA_KEY_ID: "support-browser", ADMIN_MFA_KEYS: JSON.stringify({ "support-browser": randomBytes(32).toString("base64") }), SUPPORT_TICKET_ENCRYPTION_KEY: randomBytes(32).toString("base64"), SUPPORT_TICKET_ENCRYPTION_KEY_ID: "support-browser", SUPPORT_INBOX_EMAIL: "support@example.invalid", BREVO_API_KEY: "", BREVO_SENDER_EMAIL: "", ABII_ADMIN_UI_ENABLED: "true" };
  Object.assign(process.env, env);
  let browser; let server; let context; let page;
  try {
    const [{ AdminAuditLog, AdminSecurityEvent }, { SupportResponseOperation, SupportTicket, SupportTicketActivity }, { createSupportTicket, encryptSupportBody }, { ADMIN_ID, ADMIN_SUBJECT }] = await Promise.all([import("../models/AdminAuditLog.ts"), import("../models/SupportTicket.ts"), import("../lib/support/tickets.ts"), import("../models/Admin.ts")]);
    await mongoose.connect(uri); assert.equal(mongoose.connection.db.databaseName, "support_browser_fixture");
    await Promise.all([AdminAuditLog.createCollection(), AdminSecurityEvent.createCollection(), SupportTicket.createCollection(), SupportTicketActivity.createCollection(), SupportResponseOperation.createCollection()]);
    await Promise.all([SupportTicket.createIndexes(), SupportTicketActivity.createIndexes(), SupportResponseOperation.createIndexes()]);
    const password = "support browser fixture password"; const { encryptedSeed, seed } = prepareEnrollment(ADMIN_SUBJECT);
    await mongoose.connection.db.collection("admins").insertOne({ _id: ADMIN_ID, name: "Support Fixture Admin", email: "support-admin@example.invalid", passwordHash: await bcrypt.hash(password, 12), status: "active", sessionVersion: 0, mutationVersion: 0, recoveryCodes: Array.from({ length: 8 }, (_, index) => digest(String(index))), mfa: { encryptedSeed, lastStep: Math.floor(Date.now() / 30_000) - 2, completedChallenges: [] }, createdAt: new Date(), updatedAt: new Date() });
    let historyTicket;
    for (let index = 0; index < 41; index++) {
      const name = index === 20 ? "History Customer" : `Fixture Customer ${index}`;
      const row = await createSupportTicket({ submissionKey: (index + 1).toString(16).padStart(64, "0"), payloadHash: (index + 1_000).toString(16).padStart(64, "0"), name, email: `fixture-${index}@example.invalid`, category: "Other", message: `Customer message ${name}` });
      await SupportTicket.updateOne({ _id: row._id }, { $set: { status: index < 20 ? "new" : "open" } }); if (index === 20) historyTicket = row;
    }
    await SupportTicketActivity.insertMany(Array.from({ length: 55 }, (_, index) => ({ ticketId: historyTicket._id, kind: "internal_note", body: encryptSupportBody(`Older private note ${index}`), createdAt: new Date(Date.now() - (55 - index) * 1_000), updatedAt: new Date(Date.now() - (55 - index) * 1_000) })));
    server = await startServer(env); browser = await chromium.launch({ headless: true }); context = await browser.newContext({ reducedMotion: "reduce" }); page = await context.newPage(); const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(server.base + "/admin/support"); await page.getByText("Sign in to continue").waitFor();
    const requestOptions = { headers: { Origin: server.base } }; const login = await context.request.post(server.base + "/api/auth/login", { ...requestOptions, data: { email: "support-admin@example.invalid", password } }); assert.equal(login.status(), 202); const verified = await context.request.post(server.base + "/api/auth/admin-mfa", { ...requestOptions, data: { code: totpAt(seed, Date.now()) } }); assert.equal(verified.status(), 200);
    await page.goto(server.base + "/admin/support"); await page.getByRole("heading", { name: "Ticket directory" }).waitFor(); await page.getByRole("heading", { name: "Conversation" }).waitFor(); assert.equal(await page.getByRole("status").count(), 0);
    const search = page.getByRole("textbox", { name: "Search tickets" }); const status = page.getByRole("combobox", { name: "Ticket status" });
    await status.selectOption("new"); await page.getByRole("button", { name: "Apply" }).click(); await page.waitForURL(url => url.searchParams.get("status") === "new"); assert.equal(await page.getByRole("navigation", { name: "Ticket pages" }).getByRole("link", { name: "Next" }).count(), 0);
    await status.selectOption("all"); await search.fill("History Customer"); await page.getByRole("button", { name: "Apply" }).click(); await page.waitForURL(url => url.searchParams.get("q") === "History Customer"); await page.getByRole("link", { name: /History Customer/ }).click();
    await page.getByText("Customer message History Customer").waitFor(); await page.getByRole("button", { name: "Load older history" }).click(); await page.getByText("Older private note 0").waitFor(); assert.equal(await page.getByText("Older private note 0").count(), 1);
    const note = page.getByLabel("Private note"); await note.fill("A browser-only private note"); await page.getByRole("button", { name: "Save private note" }).click(); await page.getByText("Private note saved.").waitFor(); await page.getByText("A browser-only private note").waitFor(); assert.equal(await note.inputValue(), "");
    await search.fill("Fixture Customer 0"); await page.getByRole("button", { name: "Apply" }).click(); await page.getByRole("link", { name: /Fixture Customer 0/ }).click(); await page.getByText("Open this ticket before sending a customer reply.").waitFor(); assert.equal(await page.getByRole("button", { name: "Send reply" }).count(), 0); const statusRequest = page.waitForResponse(response => response.url().includes("/api/admin/support") && response.request().method() === "POST"); await page.getByRole("button", { name: "Mark Open" }).click(); const statusResponse = await statusRequest; assert.equal(statusResponse.status(), 200, `Status update failed: ${await statusResponse.text()}`); await page.getByRole("status").getByText("Ticket marked open.").waitFor(); await page.getByRole("button", { name: "Send reply" }).waitFor();
    let replyState = "accepted"; await page.route("**/api/admin/support*", async route => { if (route.request().method() === "GET" && new URL(route.request().url()).searchParams.has("operationId")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ operation: { state: "uncertain" } }) }); const data = route.request().postDataJSON(); if (route.request().method() === "POST" && data?.action === "response") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { state: replyState, operationId: "10000000-0000-4000-8000-000000000099" } }) }); return route.continue(); });
    const reply = page.locator("textarea").first(); replyState = "uncertain"; await reply.fill("Keep this uncertain draft"); await page.getByRole("button", { name: "Send reply" }).click(); await page.getByText("Delivery is uncertain. Reconcile this operation before sending another reply.").waitFor(); assert.ok(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith("abii.support.operation.")))); await page.getByText("This response operation requires reconciliation before another reply can be composed.").waitFor(); assert.equal(await page.getByRole("button", { name: "Send reply" }).count(), 0); await page.reload(); await page.getByText("Delivery is uncertain. Reconcile this operation before sending another reply.").waitFor();
    await search.fill("Fixture Customer 1"); await page.getByRole("button", { name: "Apply" }).click(); await page.getByRole("link", { name: /^Fixture Customer 1\b/ }).click(); await page.getByRole("button", { name: "Mark Open" }).click(); await page.getByRole("button", { name: "Send reply" }).waitFor(); replyState = "accepted"; const acceptedReply = page.locator("textarea").first(); await acceptedReply.fill("Browser accepted reply"); await page.getByRole("button", { name: "Send reply" }).click(); await page.getByText("Brevo accepted the response. Inbox delivery is not confirmed.").waitFor();
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector("main").scrollWidth <= innerWidth), `Support layout overflow at ${width}px`); }
    await search.focus(); await page.keyboard.press("Tab"); assert.ok(await page.evaluate(() => document.activeElement instanceof HTMLElement)); assert.deepEqual(errors, []);
  } finally { await context?.close(); await browser?.close(); await server?.stop(); await mongoose.disconnect(); await replica.stop(); }
});
