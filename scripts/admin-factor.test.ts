import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "../models/Admin";
import { AdminAuditLog, AdminSecurityEvent } from "../models/AdminAuditLog";
import { AuthRateLimit } from "../models/AuthRateLimit";
import { connectToDatabase } from "../lib/mongodb";
import { totpAt, acceptedStep, digest, prepareEnrollment, readSeed } from "../lib/auth/admin-factor-crypto";
import { readActiveAdmin } from "../lib/auth/admin-identity";
import { recordAdminDenial } from "../lib/auth/admin-audit";
import {
  confirmEnrollment, pendingFactor, replaceAdminFactor,
  startAdminChallenge, verifyAdminChallenge, restartPendingEnrollment, AdminFactorRateLimitError,
} from "../lib/auth/admin-factor";

test("TOTP follows the six-digit truncation of the RFC 6238 SHA-1 vector", () => {
  assert.equal(totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59000), "287082");
});

test("isolated factor lifecycle, replay protection and audit atomicity", async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    process.env.MONGODB_URI = replica.getUri("abii_admin_factor_test");
    process.env.AUTH_OTP_SECRET = randomBytes(32).toString("hex");
    process.env.ADMIN_MFA_KEY_ID = "test";
    const keyMap = JSON.stringify({ test: randomBytes(32).toString("base64") });
    process.env.ADMIN_MFA_KEYS = keyMap;
    await connectToDatabase();
    await AuthRateLimit.init();
    await Promise.all([AdminAuditLog.createCollection(), AdminSecurityEvent.createCollection()]);
    const id = ADMIN_SUBJECT;
    const setup = prepareEnrollment(id);
    await Admin.create({
      _id: ADMIN_ID, name: "Operator", email: "operator@example.invalid", status: "pending", sessionVersion: 0,
      passwordHash: "$2b$12$HUdxSbGT.hyi71fJSD2hr.uO9XngNUp.lzcO4cJUDKgl/Zzw8KCVu",
      mfa: pendingFactor(setup),
    });
    assert.equal(await readActiveAdmin(), null);
    assert.equal(await startAdminChallenge(0), null);
    assert.equal(await confirmEnrollment("wrong", "000000"), null);
    const now = Date.now();
    const enrollmentCode = totpAt(setup.seed, now - 30_000);
    assert.throws(() => readSeed(String(new mongoose.Types.ObjectId()), setup.encryptedSeed));
    assert.equal(acceptedStep(id, setup.encryptedSeed, totpAt(setup.seed, now - 120_000), -1), null);
    const codes = await confirmEnrollment(setup.proof, enrollmentCode);
    assert.ok(codes && codes.length === 8);
    assert.deepEqual((await Admin.findById(ADMIN_ID).select("+recoveryCodes").lean())?.recoveryCodes, codes.map(digest));
    assert.equal(await confirmEnrollment(setup.proof, enrollmentCode), null);
    process.env.ADMIN_MFA_KEYS = "{}";
    await assert.rejects(() => readActiveAdmin());
    process.env.ADMIN_MFA_KEYS = keyMap;
    assert.ok(await readActiveAdmin());

    const first = await startAdminChallenge(0);
    assert.ok(first);
    assert.equal(await verifyAdminChallenge(first, enrollmentCode), null);
    await Admin.updateOne({ _id: ADMIN_ID }, { $set: { "mfa.challengeExpiresAt": new Date(0) } });
    assert.equal(await verifyAdminChallenge(first, totpAt(setup.seed, Date.now())), null);
    const second = await startAdminChallenge(0);
    assert.ok(second && second !== first);
    const fresh = totpAt(setup.seed, Date.now());
    const competing = await Promise.all([verifyAdminChallenge(second, fresh), verifyAdminChallenge(second, fresh)]);
    assert.equal(competing.filter(Boolean).length, 1);
    assert.equal(await AdminAuditLog.countDocuments({ action: "login" }), 1);

    const pending = await startAdminChallenge(0);
    assert.ok(pending);
    const clock = Date.now();
    const time = mock.method(Date, "now", () => clock);
    try {
      const validCodes = [-30_000, 0, 30_000].map(offset => Number(totpAt(setup.seed, clock + offset)));
      let invalid = 0;
      while (validCodes.includes(invalid)) invalid++;
      const code = String(invalid).padStart(6, "0");
      assert.equal(await verifyAdminChallenge(pending, code), null);
      await assert.rejects(async () => {
        // Earlier MFA checks may have already used some of this window's budget.
        for (let index = 0; index <= 8; index++) assert.equal(await verifyAdminChallenge(pending, code), null);
      }, AdminFactorRateLimitError);
    } finally { time.mock.restore(); }
    const auditFailure = mock.method(AdminAuditLog, "create", async () => { throw new Error("simulated unavailable audit"); });
    try {
      await assert.rejects(() => replaceAdminFactor({ recoveryCode: codes[0] }, 0));
      assert.equal((await Admin.findById(ADMIN_ID).lean())?.sessionVersion, 0);
      assert.ok(await readActiveAdmin());
    } finally { auditFailure.mock.restore(); }

    process.env.ADMIN_MFA_KEYS = JSON.stringify({ replacement: randomBytes(32).toString("base64") });
    process.env.ADMIN_MFA_KEY_ID = "replacement";
    await assert.rejects(readActiveAdmin, /cannot be decrypted/);
    const recovery = await Promise.all([replaceAdminFactor({ recoveryCode: codes[0] }, 0), replaceAdminFactor({ recoveryCode: codes[0] }, 0)]);
    const replacement = recovery.find(Boolean);
    assert.ok(replacement);
    assert.equal(recovery.filter(Boolean).length, 1);
    assert.equal((await Admin.findById(ADMIN_ID).lean())?.sessionVersion, 1);
    assert.equal(await verifyAdminChallenge(pending, fresh), null);
    assert.equal(await readActiveAdmin(), null);
    const newCodes = await confirmEnrollment(replacement.proof, totpAt(replacement.seed, Date.now() - 30000));
    assert.ok(newCodes);
    assert.equal(await replaceAdminFactor({ recoveryCode: codes[1] }, 1), null);
    assert.equal(await replaceAdminFactor({ recoveryCode: codes[0] }, 1), null);
    assert.equal(await restartPendingEnrollment(1), null);
    const rotated = await replaceAdminFactor({ totp: totpAt(replacement.seed, Date.now()) }, 1);
    assert.ok(rotated);
    await Admin.updateOne({ _id: ADMIN_ID }, { $set: { "mfa.enrollmentExpiresAt": new Date(0) } });
    assert.equal(await confirmEnrollment(rotated.proof, totpAt(rotated.seed, Date.now())), null);
    assert.ok(await restartPendingEnrollment(2));
    assert.equal(await confirmEnrollment(rotated.proof, totpAt(rotated.seed, Date.now())), null);
    const serialized = JSON.stringify([
      await AdminAuditLog.find().lean(),
      await AdminSecurityEvent.find().lean(),
      await Admin.findById(ADMIN_ID).select("+mfa +recoveryCodes").lean(),
    ]);
    for (const secret of [setup.seed, setup.proof, rotated.seed, pending, ...codes, ...newCodes]) assert.equal(serialized.includes(secret), false);
    await Promise.all(Array.from({ length: 4 }, () => recordAdminDenial("access-denied", id)));
    assert.equal(await AdminSecurityEvent.countDocuments({ kind: "access-denied" }), 1);

  } finally {
    await mongoose.disconnect();
    await replica.stop();
  }
});
