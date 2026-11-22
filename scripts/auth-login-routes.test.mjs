import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const secret = "isolated-auth-login-test-secret-at-least-32-characters";
const otpSecret = "isolated-auth-otp-test-secret-at-least-32-characters";
const fixturePassword = "Abii-test-password-123";

function cookie(response, name) {
  const rows = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const row = rows.find((value) => value.startsWith(`${name}=`));
  return row ? row.slice(name.length + 1).split(";", 1)[0] : null;
}

test("existing account login routes unverified users through OTP and preserves verified sessions/data", { timeout: 240000 }, async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let child;
  let output = "";
  let parentConnected = false;
  try {
    const uri = mongo.getUri("abii_auth_login_test");
    await mongoose.connect(uri);
    parentConnected = true;
    const db = mongoose.connection.db;
    const unverifiedId = new mongoose.Types.ObjectId();
    const verifiedId = new mongoose.Types.ObjectId();
    const passwordHash = await bcrypt.hash(fixturePassword, 4);
    const now = new Date();
    await db.collection("users").insertMany([
      { _id: unverifiedId, name: "Legacy Student", email: "legacy-auth@example.invalid", passwordHash, emailVerifiedAt: null, sessionVersion: 0, createdAt: now, updatedAt: now },
      { _id: verifiedId, name: "Verified Student", email: "verified-auth@example.invalid", passwordHash, emailVerifiedAt: now, sessionVersion: 0, createdAt: now, updatedAt: now },
    ]);

    const subjectId = new mongoose.Types.ObjectId();
    const folderId = new mongoose.Types.ObjectId();
    const topicId = new mongoose.Types.ObjectId();
    const flashcardId = new mongoose.Types.ObjectId();
    const fixtureCollections = ["subjects", "subjectfolders", "topics", "flashcards", "quizsessions", "reviewrecords", "userbadges", "achievementevents"];
    const dataFixtures = [
      ["subjects", { _id: subjectId, userId: unverifiedId, name: "Preserved subject", createdAt: now, updatedAt: now }],
      ["subjectfolders", { _id: folderId, userId: unverifiedId, name: "Preserved folder", normalizedName: "preserved folder", position: 0, createdAt: now, updatedAt: now }],
      ["topics", { _id: topicId, userId: unverifiedId, subjectId, name: "Preserved topic", normalizedName: "preserved topic", position: 0, createdAt: now, updatedAt: now }],
      ["flashcards", { _id: flashcardId, userId: unverifiedId, subjectId, topicId, flashcardType: "standard", question: "Q", answer: "A", createdAt: now, updatedAt: now }],
      ["quizsessions", { _id: new mongoose.Types.ObjectId(), userId: unverifiedId, subjectId, subjectName: "Preserved subject", type: "identification", status: "completed", questions: [], expiresAt: new Date(Date.now() + 60000), createdAt: now, updatedAt: now }],
      ["reviewrecords", { _id: new mongoose.Types.ObjectId(), userId: unverifiedId, flashcardId, result: "correct", questionType: "identification", reviewedAt: now, nextReviewAt: now, createdAt: now, updatedAt: now }],
      ["userbadges", { _id: new mongoose.Types.ObjectId(), userId: unverifiedId, badgeId: "study-streak-1", unlockedAt: now, verifiedAt: now, source: "live" }],
      ["achievementevents", { _id: new mongoose.Types.ObjectId(), userId: unverifiedId, type: "test-preserved", createdAt: now }],
    ];
    for (const [collection, document] of dataFixtures) await db.collection(collection).insertOne(document);
    const originalData = new Map();
    for (const collection of fixtureCollections) originalData.set(collection, await db.collection(collection).find({ userId: unverifiedId }).sort({ _id: 1 }).toArray());

    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    process.env.ADMIN_MFA_KEY_ID = "test";
    process.env.ADMIN_MFA_KEYS = JSON.stringify({ test: randomBytes(32).toString("base64") });
    child = spawn(process.execPath, [fileURLToPath(new URL("./topic-test-server.mjs", import.meta.url)), String(port)], {
      cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "development", MONGODB_URI: uri, AUTH_SECRET: secret, AUTH_OTP_SECRET: otpSecret, NEXT_TELEMETRY_DISABLED: "1", BREVO_API_KEY: "", BREVO_SENDER_EMAIL: "", APP_BASE_URL: `http://127.0.0.1:${port}` },
    });
    child.stdout.on("data", (data) => { output = (output + data).slice(-12000); });
    child.stderr.on("data", (data) => { output = (output + data).slice(-12000); });
    child.on("error", (error) => { output += error.message; });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      if (output.includes("Ready in")) { ready = true; break; }
      if (child.exitCode !== null) throw new Error(`Next exited: ${output}`);
      await delay(200);
    }
    assert.ok(ready, `Next startup timed out: ${output}`);

    async function post(path, body, cookieHeader) {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
        body: JSON.stringify(body),
        redirect: "manual",
        signal: AbortSignal.timeout(60000),
      });
      const text = await response.text();
      assert.ok(response.headers.get("content-type")?.includes("application/json"), `Expected JSON, got ${text.slice(0, 400)}\n${output}`);
      return { response, body: JSON.parse(text) };
    }
    async function patch(path, body, cookieHeader) {
      const response = await fetch(`${base}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) }, body: JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(60000) });
      return { response, body: await response.json() };
    }
    async function waitForNotification(filter) {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const notification = await db.collection("notifications").findOne(filter);
        if (notification) return notification;
        await delay(100);
      }
      return null;
    }
    async function get(path, cookieHeader) {
      const response = await fetch(`${base}${path}`, { headers: cookieHeader ? { Cookie: cookieHeader } : {}, redirect: "manual", signal: AbortSignal.timeout(60000) });
      return { response, body: await response.json() };
    }

    const wrong = await post("/api/auth/login", { email: "legacy-auth@example.invalid", password: "wrong-password" });
    assert.equal(wrong.response.status, 401);
    assert.equal(wrong.body.code, undefined);
    assert.equal(cookie(wrong.response, "abii_pending_verification"), null);

    const pending = await post("/api/auth/login", { email: "legacy-auth@example.invalid", password: fixturePassword });
    assert.equal(pending.response.status, 202);
    assert.equal(pending.body.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(pending.body.redirectTo, "/verify-email");
    assert.equal(pending.body.deliveryStatus, "unavailable", "provider/config failure must remain in verification flow");
    const pendingTicket = cookie(pending.response, "abii_pending_verification");
    assert.ok(pendingTicket, "restricted pending identity cookie is issued");
    assert.equal(cookie(pending.response, "abii_session"), "", "no authenticated session is issued");
    const pendingCookieHeader = `abii_pending_verification=${pendingTicket}`;
    const pendingInfo = await get("/api/auth/verify-email/pending", pendingCookieHeader);
    assert.equal(pendingInfo.response.status, 200);
    assert.match(pendingInfo.body.email, /^l.*@example\.invalid$/);

    const challengeId = "isolated-test-challenge";
    const testCode = "004219";
    const codeHash = createHmac("sha256", otpSecret).update(JSON.stringify([String(unverifiedId), "email_verification", challengeId, testCode])).digest("hex");
    const resendAvailableAt = new Date(Date.now() + 60_000);
    await db.collection("authchallenges").insertOne({
      userId: unverifiedId, purpose: "email_verification", challengeId, codeHash,
      expiresAt: new Date(Date.now() + 10 * 60_000), resendAvailableAt,
      attemptCount: 0, consumedAt: null, lockedAt: null, createdAt: now, updatedAt: now,
    });
    const cooldownLogin = await post("/api/auth/login", { email: "legacy-auth@example.invalid", password: fixturePassword });
    assert.equal(cooldownLogin.response.status, 202);
    assert.equal(cooldownLogin.body.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(cooldownLogin.body.deliveryStatus, "unavailable");
    const cooldownTicket = cookie(cooldownLogin.response, "abii_pending_verification");
    const cooldownInfo = await get("/api/auth/verify-email/pending", `abii_pending_verification=${cooldownTicket}`);
    assert.ok(cooldownInfo.body.retryAfter > 0 && cooldownInfo.body.retryAfter <= 60);
    assert.equal(await db.collection("authchallenges").countDocuments({ userId: unverifiedId }), 1, "active challenge remains available during cooldown");

    const verified = await post("/api/auth/verify-email", { code: testCode, next: "/dashboard" }, `abii_pending_verification=${cooldownTicket}`);
    assert.equal(verified.response.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.redirectTo, "/dashboard");
    const fullSession = cookie(verified.response, "abii_session");
    assert.ok(fullSession, "full session is issued only after OTP verification");
    assert.equal(cookie(verified.response, "abii_pending_verification"), "");
    const emailVerifiedNotice = await waitForNotification({ userId: unverifiedId, type: "account_security", dedupeKey: "account-security:email_verified:first-verification" });
    assert.equal(emailVerifiedNotice?.target, "/settings", "first verified-email transition generates a mandatory security notice");
    const afterVerification = await db.collection("users").findOne({ _id: unverifiedId });
    assert.equal(String(afterVerification._id), String(unverifiedId));
    assert.ok(afterVerification.emailVerifiedAt instanceof Date);
    assert.equal(await db.collection("users").countDocuments({ email: "legacy-auth@example.invalid" }), 1);
    for (const collection of fixtureCollections) {
      const after = await db.collection(collection).find({ userId: unverifiedId }).sort({ _id: 1 }).toArray();
      assert.deepEqual(after, originalData.get(collection), `${collection} records and ownership remain unchanged`);
    }

    const verifiedLogin = await post("/api/auth/login", { email: "legacy-auth@example.invalid", password: fixturePassword });
    assert.equal(verifiedLogin.response.status, 200);
    assert.equal(verifiedLogin.body.code, "AUTHENTICATED");
    assert.equal(verifiedLogin.body.redirectTo, "/dashboard");
    assert.ok(cookie(verifiedLogin.response, "abii_session"));
    assert.equal(cookie(verifiedLogin.response, "abii_pending_verification"), null);
    const ordinaryLogout = await post("/api/auth/logout", {}, `abii_session=${cookie(verifiedLogin.response, "abii_session")}`);
    assert.equal(ordinaryLogout.response.status, 200);
    assert.ok(ordinaryLogout.response.headers.getSetCookie().some(row => row.startsWith("abii_session=") && /max-age=0/i.test(row)));
    const verifiedLoginAgain = await post("/api/auth/login", { email: "legacy-auth@example.invalid", password: fixturePassword });
    assert.equal(verifiedLoginAgain.response.status, 200, "logout does not reset verification");
    assert.equal(verifiedLoginAgain.body.code, "AUTHENTICATED");

    const verifiedFixtureLogin = await post("/api/auth/login", { email: "verified-auth@example.invalid", password: fixturePassword });
    assert.equal(verifiedFixtureLogin.response.status, 200);
    assert.equal(verifiedFixtureLogin.body.code, "AUTHENTICATED");
    assert.equal(await db.collection("authchallenges").countDocuments({ userId: verifiedId }), 0, "verified login does not create an OTP challenge");
    const verifiedSession = `abii_session=${cookie(verifiedFixtureLogin.response, "abii_session")}`;
    const wrongCurrentPassword = await patch("/api/account/password", { currentPassword: "incorrect-password", newPassword: "Next-password-789", confirmPassword: "Next-password-789" }, verifiedSession);
    assert.equal(wrongCurrentPassword.response.status, 400);
    assert.equal(await db.collection("notifications").countDocuments({ userId: verifiedId, type: "account_security" }), 0, "rejected password changes do not notify");
    const changedPassword = await patch("/api/account/password", { currentPassword: fixturePassword, newPassword: "Next-password-789", confirmPassword: "Next-password-789" }, verifiedSession);
    assert.equal(changedPassword.response.status, 200);
    const passwordChangedNotice = await waitForNotification({ userId: verifiedId, type: "account_security", dedupeKey: "account-security:password_changed:version-1" });
    assert.ok(passwordChangedNotice, "successful password update creates a durable security notice");
    assert.equal(await fetch(`${base}/api/subjects`, { headers: { Cookie: verifiedSession } }).then(response => response.status), 401, "password change still revokes the old session");

    // Seed a test-only recovery challenge; no provider or production data is used.
    const recoveryId = "isolated-recovery-challenge", recoveryCode = "001234";
    const recoveryHash = createHmac("sha256", otpSecret).update(JSON.stringify([String(unverifiedId), "password_reset", recoveryId, recoveryCode])).digest("hex");
    await db.collection("authchallenges").insertOne({ userId: unverifiedId, purpose: "password_reset", challengeId: recoveryId, codeHash: recoveryHash, expiresAt: new Date(Date.now() + 600000), resendAvailableAt: new Date(), attemptCount: 0, consumedAt: null, lockedAt: null });
    const badRecovery = await post("/api/auth/forgot-password/verify", { email: "legacy-auth@example.invalid", code: "999999" });
    assert.equal(badRecovery.response.status, 400);
    assert.equal(cookie(badRecovery.response, "abii_password_reset_v2"), null);
    const recovery = await post("/api/auth/forgot-password/verify", { email: "legacy-auth@example.invalid", code: recoveryCode });
    assert.equal(recovery.response.status, 200);
    const resetToken = cookie(recovery.response, "abii_password_reset_v2");
    assert.ok(resetToken);
    const resetHeaders = recovery.response.headers.getSetCookie();
    assert.ok(resetHeaders.some(row => row.startsWith("abii_password_reset_v2=") && /path=\//i.test(row) && /httponly/i.test(row) && /samesite=strict/i.test(row) && /max-age=300/i.test(row)));
    assert.ok(resetHeaders.some(row => row.startsWith("abii_password_reset=") && /path=\/api\/auth\/forgot-password/i.test(row) && /max-age=0/i.test(row)));
    assert.equal((await post("/api/auth/forgot-password/verify", { email: "legacy-auth@example.invalid", code: recoveryCode })).response.status, 400);
    const noGrantPage = await fetch(`${base}/reset-password`, { redirect: "manual" });
    assert.equal(noGrantPage.status, 307);
    const resetCookie = `abii_password_reset_v2=${resetToken}`;
    const resetPage = await fetch(`${base}/reset-password`, { headers: { Cookie: resetCookie }, redirect: "manual" });
    assert.equal(resetPage.status, 200);
    assert.match(await resetPage.text(), /Create a new password/);
    const newPassword = "New-isolated-password-456";
    const attempts = await Promise.all([1, 2].map(() => post("/api/auth/forgot-password/reset", { password: newPassword, confirmPassword: newPassword }, resetCookie)));
    assert.deepEqual(attempts.map(x => x.response.status).sort(), [200, 401]);
    const success = attempts.find(x => x.response.status === 200);
    assert.equal(cookie(success.response, "abii_password_reset_v2"), "");
    assert.equal((await post("/api/auth/login", { email: "legacy-auth@example.invalid", password: fixturePassword })).response.status, 401);
    assert.equal((await post("/api/auth/login", { email: "legacy-auth@example.invalid", password: newPassword })).response.status, 200);
    const resetNotice = await waitForNotification({ userId: unverifiedId, type: "account_security", title: "Your password was reset" });
    assert.ok(resetNotice, "committed reset transaction creates a security notification");
    assert.doesNotMatch(`${resetNotice.title} ${resetNotice.message} ${resetNotice.dedupeKey}`, /token|grant|otp|secret/i);
    assert.equal((await fetch(`${base}/api/subjects`, { headers: { Cookie: `abii_session=${fullSession}` } })).status, 401, "old session is revoked");
    for (const collection of fixtureCollections) assert.deepEqual(await db.collection(collection).find({ userId: unverifiedId }).sort({ _id: 1 }).toArray(), originalData.get(collection));

    const injectedFields = { role: "admin", suspendedAt: now, sessionVersion: 500, mfa: { enrolled: true } };
    const email = "ordinary-phase-two@example.invalid";
    await post("/api/auth/register", { name: "Ordinary", email, password: fixturePassword, ...injectedFields });
    const users = db.collection("users");
    const registered = await users.findOne({ email });
    assert.equal(registered.role, "user");
    assert.equal(registered.suspendedAt, null);
    assert.equal(registered.sessionVersion, 0);
    assert.equal(registered.mfa, undefined);
    assert.ok(!(await users.indexes()).some(index => index.name === "user_single_admin_unique"),
      "web model initialization must leave admin index deployment to the operator");
    await users.updateOne({ _id: registered._id }, { $set: { emailVerifiedAt: now } });
    const ordinaryLogin = await post("/api/auth/login", { email, password: fixturePassword });
    const ordinaryCookie = `abii_session=${cookie(ordinaryLogin.response, "abii_session")}`;
    assert.equal((await patch("/api/account/profile", { email, name: "Updated", ...injectedFields }, ordinaryCookie)).response.status, 200);
    assert.equal((await patch("/api/settings", { targetSubjects: 6, defaultLandingPage: "/review", subjectLayout: "list", ...injectedFields }, ordinaryCookie)).response.status, 200);
    assert.equal((await users.findOne({ email })).role, "user");
    const exported = await get("/api/data/export", ordinaryCookie);
    assert.equal(exported.response.status, 200);
    assert.doesNotMatch(JSON.stringify(exported.body), /passwordHash|sessionVersion|recoveryHashes|ciphertext|challengeHash/);
    const dashboard = await fetch(`${base}/dashboard`, { headers: { Cookie: ordinaryCookie }, redirect: "manual" });
    assert.equal(dashboard.status, 200);

    async function deleteAccount(header) {
      return fetch(`${base}/api/account`, { method: "DELETE", headers: { Cookie: header, "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
    }
    // Simulate a stale ordinary cookie/grant on a subsequently protected identity.
    await users.updateOne({ _id: registered._id }, { $set: { role: "admin" } });
    assert.equal((await deleteAccount(ordinaryCookie)).status, 401);
    assert.equal((await get("/api/data/export", ordinaryCookie)).response.status, 401);
    const recoveryResponse = await post("/api/auth/forgot-password", { email });
    assert.deepEqual(recoveryResponse.body, (await post("/api/auth/forgot-password", { email: "absent@example.invalid" })).body);
    assert.equal((await post("/api/auth/forgot-password/resend", { email })).response.status, 200);
    assert.equal((await post("/api/auth/forgot-password/verify", { email, code: "123456" })).response.status, 400);
    assert.equal(await db.collection("authchallenges").countDocuments({ userId: registered._id, purpose: "password_reset" }), 0);
    const { SignJWT } = await import("jose");
    const rawGrant = "isolated-protected-account-grant";
    const staleTicket = await new SignJWT({ purpose: "password_reset" }).setProtectedHeader({ alg: "HS256" }).setSubject(rawGrant)
      .setIssuer("abii").setAudience("abii-auth-flow").setExpirationTime("1m").sign(new TextEncoder().encode(secret));
    await db.collection("passwordresetgrants").insertOne({ userId: registered._id, tokenHash: createHash("sha256").update(rawGrant).digest("hex"), expiresAt: new Date(Date.now() + 60000), consumedAt: null });
    assert.equal((await post("/api/auth/forgot-password/reset", { password: newPassword, confirmPassword: newPassword }, `abii_password_reset_v2=${staleTicket}`)).response.status, 401);
    assert.equal((await users.findOne({ email })).passwordHash, registered.passwordHash);
    const { digest, prepareEnrollment, totpAt } = await import("../lib/auth/admin-factor-crypto.ts");
    const enrollment = prepareEnrollment("admin:primary");
    const adminEmail = "separate-administrator@example.invalid";
    const admins = db.collection("admins");
    await db.createCollection("adminauditlogs");
    await db.createCollection("adminsecurityevents");
    await admins.insertOne({
      _id: "primary", name: "Fixture admin", email: adminEmail, passwordHash: await bcrypt.hash(fixturePassword, 12),
      status: "active", sessionVersion: 0, createdAt: now, updatedAt: now,
      mfa: { encryptedSeed: enrollment.encryptedSeed, lastStep: Math.floor(Date.now() / 30_000) - 2, completedChallenges: [] },
      recoveryCodes: Array.from({ length: 8 }, (_, index) => digest(String(index))),
    });
    async function adminPost(path, body, header, origin = base) {
      return fetch(base + path, { method: "POST", headers: { Origin: origin, Cookie: header, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    const oldLogin = await adminPost("/api/auth/login", { email, password: fixturePassword }, "");
    const blockedLogin = await adminPost("/api/auth/login", { email: adminEmail, password: fixturePassword }, "");
    assert.equal(oldLogin.status, 401);
    assert.equal(blockedLogin.status, 401);
    assert.deepEqual(await oldLogin.json(), await blockedLogin.json());
    await users.updateOne({ _id: registered._id }, { $set: { role: "user" } });
    const wrongAdminPassword = await adminPost("/api/auth/login", { email: adminEmail, password: "incorrect" }, "");
    assert.equal(wrongAdminPassword.status, 401);
    assert.deepEqual(await wrongAdminPassword.json(), wrong.body);
    assert.equal((await post("/api/auth/register", { name: "Attempted duplicate", email: adminEmail, password: fixturePassword, role: "admin" })).response.status, 409);
    assert.equal(await users.countDocuments({ email: adminEmail }), 0);
    assert.deepEqual((await post("/api/auth/forgot-password", { email: adminEmail })).body, recoveryResponse.body);
    assert.equal((await post("/api/auth/forgot-password/verify", { email: adminEmail, code: "123456" })).response.status, 400);
    const passwordOnly = await adminPost("/api/auth/login", { email: adminEmail, password: fixturePassword }, ordinaryCookie);
    assert.equal((await passwordOnly.json()).code, "ADMIN_MFA_REQUIRED");
    assert.ok(!cookie(passwordOnly, "abii_admin"));
    assert.equal(cookie(passwordOnly, "abii_session"), "");
    const pendingMfa = cookie(passwordOnly, "abii_admin_pending");
    assert.ok(pendingMfa);
    const challengeCookie = "abii_admin_pending=" + pendingMfa;
    const secondFactor = { code: totpAt(enrollment.seed, Date.now()), next: "/admin/settings" };
    assert.equal((await post("/api/auth/admin-mfa", secondFactor, challengeCookie)).response.status, 403);
    assert.equal((await adminPost("/api/auth/admin-mfa", secondFactor, challengeCookie, "https://other.invalid")).status, 403);
    const authenticated = await adminPost("/api/auth/admin-mfa", secondFactor, challengeCookie);
    assert.equal(authenticated.status, 200);
    assert.match(authenticated.headers.get("cache-control"), /private.*no-store/);
    const adminJwt = cookie(authenticated, "abii_admin");
    assert.ok(adminJwt);
    assert.ok(authenticated.headers.getSetCookie().some(row => row.startsWith("abii_admin=") && /max-age=1800/i.test(row) && /httponly/i.test(row) && /samesite=strict/i.test(row)));
    assert.ok((await adminPost("/api/auth/admin-mfa", secondFactor, challengeCookie)).status >= 400);
    assert.equal((await get("/api/data/export", "abii_session=" + adminJwt)).response.status, 401);
    assert.equal((await get("/api/data/export", "abii_admin=" + adminJwt)).response.status, 401);
    assert.equal((await patch("/api/account/profile", { name: "Changed", email: adminEmail }, "abii_admin=" + adminJwt)).response.status, 401);
    assert.equal((await deleteAccount("abii_admin=" + adminJwt)).status, 401);
    const pendingOnlyLogout = await adminPost("/api/auth/logout", {}, challengeCookie);
    assert.equal(pendingOnlyLogout.status, 200);
    assert.ok(pendingOnlyLogout.headers.getSetCookie().some(row => row.startsWith("abii_admin=") && /max-age=0/i.test(row)));
    assert.equal((await admins.findOne({ _id: "primary" })).sessionVersion, 1);
    assert.equal((await adminPost("/api/auth/logout", {}, "abii_admin=" + adminJwt)).status, 200);
    assert.equal((await admins.findOne({ _id: "primary" })).sessionVersion, 1);
    assert.equal((await users.findOne({ email })).sessionVersion, 0);
    await users.updateOne({ _id: registered._id }, { $set: { role: "user", suspendedAt: new Date() }, $inc: { sessionVersion: 1 } });
    assert.equal((await get("/api/data/export", ordinaryCookie)).response.status, 401);
    assert.ok((await post("/api/auth/login", { email, password: fixturePassword })).response.status >= 400);
    await users.updateOne({ _id: registered._id }, { $set: { suspendedAt: null } });
    assert.equal((await get("/api/data/export", ordinaryCookie)).response.status, 401);
    const restored = await post("/api/auth/login", { email, password: fixturePassword });
    assert.equal((await deleteAccount(`abii_session=${cookie(restored.response, "abii_session")}`)).status, 200);
    assert.equal(await users.countDocuments({ email }), 0);

    const authForm = await readFile(new URL("../components/auth/auth-form.tsx", import.meta.url), "utf8");
    const verificationBranch = authForm.indexOf('if (result.code === "EMAIL_VERIFICATION_REQUIRED")');
    const httpErrorBranch = authForm.indexOf("if (!response.ok)");
    assert.ok(verificationBranch >= 0 && verificationBranch < httpErrorBranch, "verification result is handled before HTTP status");
    assert.match(authForm.slice(verificationBranch, httpErrorBranch), /router\.replace\(`\/verify-email/);
    assert.match(authForm, /result\.code !== "AUTHENTICATED"/);
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5000)]);
    }
    if (parentConnected) await mongoose.disconnect();
    await mongo.stop();
  }
});
