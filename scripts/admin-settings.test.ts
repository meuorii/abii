import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { SignJWT } from "jose";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { evaluateMonitoringAlerts, SettingsConflict, validateSettingsPatch } from "@/lib/admin/settings-contract";
import { saveAdminProfile, saveSettings, changeAdminPassword } from "@/lib/admin/settings";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "@/models/Admin";
import { AdminSettings } from "@/models/AdminSettings";
import { AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { prepareEnrollment, digest } from "@/lib/auth/admin-factor-crypto";
import { validateAdminSession, AdminAccessError } from "@/lib/auth/admin-session-state";

test("settings contract accepts only bounded allowlisted values", () => {
  assert.deepEqual(validateSettingsPatch({ section: "preferences", revision: 0, values: {
    sessionWarningEnabled: true, sessionWarningLeadMinutes: 5, operationalWarnings: true,
  } }), { section: "preferences", revision: 0, values: {
    sessionWarningEnabled: true, sessionWarningLeadMinutes: 5, operationalWarnings: true,
  } });
  assert.throws(() => validateSettingsPatch({ section: "platform", revision: 1, values: { MONGODB_URI: "no" } }), /unsupported/i);
  assert.throws(() => validateSettingsPatch({ section: "monitoring", revision: 1, values: { serverErrorPercent: 99 } }), /between/i);
  assert.throws(() => validateSettingsPatch({ section: "platform", revision: 0, values: { publicSupportNoticeEnabled: true, publicSupportNoticeText: "   " } }), /required/i);
});

test("settings contract detects stale revisions", () => {
  assert.throws(() => { throw new SettingsConflict(); }, SettingsConflict);
});

test("monitoring alerts remain unknown without sufficient evidence", () => {
  const unknown = evaluateMonitoringAlerts({
    preferences: { monitoringNotices: true, serverErrorPercent: 5, latencyMs: 1000, reminderWarnings: true },
    report: { apiCoverage: "empty", jobCoverage: "empty", totals: { latency: { count: 0 }, serverErrors: 0 }, incidents: [] },
  });
  assert.equal(unknown.state, "unknown");
  const warning = evaluateMonitoringAlerts({
    preferences: { monitoringNotices: true, serverErrorPercent: 5, latencyMs: 1000, reminderWarnings: true },
    report: { apiCoverage: "observed", jobCoverage: "observed", totals: { latency: { count: 30 }, serverErrors: 3 }, p95: 1200,
      incidents: [{ component: "Reminder scheduler", evidence: "1 failed execution" }] },
  });
  assert.equal(warning.state, "warning");
  assert.equal(warning.alerts.length, 3);
});

test("settings mutations are transactional, audited, revision-fenced, and password changes revoke sessions", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const previous = { uri: process.env.MONGODB_URI, secret: process.env.AUTH_SECRET, otp: process.env.AUTH_OTP_SECRET, keyId: process.env.ADMIN_MFA_KEY_ID, keys: process.env.ADMIN_MFA_KEYS };
  process.env.MONGODB_URI = mongo.getUri("admin_settings_test");
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.AUTH_OTP_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_MFA_KEY_ID = "test";
  process.env.ADMIN_MFA_KEYS = JSON.stringify({ test: randomBytes(32).toString("base64") });
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await Promise.all([AdminAuditLog.createCollection(), AdminSecurityEvent.createCollection()]);
    const { encryptedSeed } = prepareEnrollment(ADMIN_SUBJECT);
    const now = Math.floor(Date.now() / 1000);
    const sessionId = randomBytes(24).toString("base64url");
    const environment = process.env.NODE_ENV === "production" ? "production" : "development";
    const authenticatedAt = new Date(now * 1000);
    await Admin.create({ _id: ADMIN_ID, name: "Original Admin", email: "admin@example.invalid", status: "active", sessionVersion: 0,
      passwordHash: await bcrypt.hash("Current password 123", 12), mfa: { encryptedSeed, lastStep: Math.floor(Date.now() / 30_000) - 2 },
      recoveryCodes: Array.from({ length: 8 }, (_, index) => digest(String(index))), activeSession: { sessionId, version: 0, authenticatedAt, absoluteExpiresAt: new Date((now + 28_800) * 1000), lastActivityAt: authenticatedAt, environment }, });
    const token = await new SignJWT({ sv: 0, sid: sessionId, env: environment, amr: ["pwd", "otp"] }).setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" })
      .setIssuer("abii").setAudience("abii-admin").setSubject(ADMIN_SUBJECT).setIssuedAt(now).setExpirationTime(now + 28_800).sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    const preferences = await saveSettings(token, { section: "preferences", revision: 0, values: { sessionWarningEnabled: false, sessionWarningLeadMinutes: 5, operationalWarnings: true } });
    assert.equal(preferences.settings.revision, 1);
    assert.equal((await AdminSettings.findById("primary").lean())?.platform?.publicSupportNoticeText, "");
    const monitoring = await saveSettings(token, { section: "monitoring", revision: 1, values: { serverErrorPercent: 5, latencyMs: 1000, reminderWarnings: true, monitoringNotices: true } });
    assert.equal(monitoring.settings.revision, 2);
    const saved = await saveSettings(token, { section: "platform", revision: 2, values: { publicSupportNoticeEnabled: true, publicSupportNoticeText: "Service updates are posted here." } });
    assert.equal(saved.settings.revision, 3);
    assert.equal((await AdminSettings.findById("primary").lean())?.platform?.publicSupportNoticeText, "Service updates are posted here.");
    const disabled = await saveSettings(token, { section: "platform", revision: 3, values: { publicSupportNoticeEnabled: false, publicSupportNoticeText: "" } });
    assert.equal(disabled.settings.platform.publicSupportNoticeText, "");
    await assert.rejects(saveSettings(token, { section: "platform", revision: 0, values: { publicSupportNoticeEnabled: false, publicSupportNoticeText: "" } }), SettingsConflict);
    assert.deepEqual(await saveAdminProfile(token, { name: "Updated Admin", revision: disabled.profileRevision }), { name: "Updated Admin", revision: disabled.profileRevision + 1 });
    const afterProfile = await saveSettings(token, { section: "preferences", revision: disabled.settings.revision, values: { sessionWarningEnabled: true, sessionWarningLeadMinutes: 10, operationalWarnings: false } });
    assert.deepEqual(await saveAdminProfile(token, { name: "Final Admin", revision: afterProfile.profileRevision }), { name: "Final Admin", revision: afterProfile.profileRevision + 1 });
    await assert.rejects(changeAdminPassword(token, { currentPassword: "Current password 123", newPassword: "å".repeat(37), confirmPassword: "å".repeat(37), confirmed: true }), /72 bytes/i);
    await changeAdminPassword(token, { currentPassword: "Current password 123", newPassword: "New secure password 456", confirmPassword: "New secure password 456", confirmed: true });
    await assert.rejects(validateAdminSession(token), (error: unknown) => error instanceof AdminAccessError && error.status === 401);
    assert.equal(await AdminAuditLog.countDocuments({ action: { $in: ["settings.preferences", "settings.monitoring", "settings.platform", "settings.profile", "settings.password"] } }), 8);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
