import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { User } from "../models/User";
import { AdminFactor } from "../models/AdminFactor";
import { AdminAuditLog, AdminSecurityEvent } from "../models/AdminAuditLog";
import { AuthRateLimit } from "../models/AuthRateLimit";
import { withRequiredTransaction } from "../lib/mongodb-transaction";
import { connectToDatabase } from "../lib/mongodb";
import { totpAt, acceptedStep, readSeed } from "../lib/auth/admin-factor-crypto";
import { recordAdminDenial } from "../lib/auth/admin-audit";
import {
  confirmEnrollment, hasAdminFactor, installPendingEnrollment, prepareEnrollment, replaceAdminFactor,
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
    await Promise.all([AdminAuditLog.init(), AdminSecurityEvent.init(), AdminFactor.init(), AuthRateLimit.init(), User.init()]);
    const user = await User.create({ name: "Operator", email: "operator@example.invalid", role: "admin", emailVerifiedAt: new Date(), passwordHash: "test-fixture" });
    const id = String(user._id);
    const setup = prepareEnrollment(id);
    await withRequiredTransaction(session => installPendingEnrollment(id, setup, session));
    assert.equal(await hasAdminFactor(id), false);
    assert.equal(await startAdminChallenge(id, 0), null);
    assert.equal(await confirmEnrollment(id, "wrong", "000000"), null);
    await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
    assert.equal(await confirmEnrollment(id, setup.proof, totpAt(setup.seed, Date.now())), null);
    await User.updateOne({ _id: user._id }, { $set: { sessionVersion: 0 } });
    const now = Date.now();
    const enrollmentCode = totpAt(setup.seed, now - 30_000);
    assert.throws(() => readSeed(String(new mongoose.Types.ObjectId()), setup.encryptedSeed));
    assert.equal(acceptedStep(id, setup.encryptedSeed, totpAt(setup.seed, now - 120_000), -1), null);
    const codes = await confirmEnrollment(id, setup.proof, enrollmentCode);
    assert.ok(codes && codes.length === 8);
    assert.equal(await confirmEnrollment(id, setup.proof, enrollmentCode), null);
    process.env.ADMIN_MFA_KEYS = "{}";
    await assert.rejects(() => hasAdminFactor(id));
    process.env.ADMIN_MFA_KEYS = keyMap;
    assert.ok(await hasAdminFactor(id));

    const first = await startAdminChallenge(id, 0);
    assert.ok(first);
    assert.equal(await verifyAdminChallenge(first, enrollmentCode), null);
    await AdminFactor.updateOne({ _id: user._id }, { $set: { challengeExpiresAt: new Date(0) } });
    assert.equal(await verifyAdminChallenge(first, totpAt(setup.seed, Date.now())), null);
    const second = await startAdminChallenge(id, 0);
    assert.ok(second && second !== first);
    const fresh = totpAt(setup.seed, Date.now());
    const competing = await Promise.all([verifyAdminChallenge(second, fresh), verifyAdminChallenge(second, fresh)]);
    assert.equal(competing.filter(Boolean).length, 1);
    assert.equal(await AdminAuditLog.countDocuments({ action: "login" }), 1);

    const pending = await startAdminChallenge(id, 0);
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
      await assert.rejects(() => replaceAdminFactor(id, { recoveryCode: codes[0] }, 0));
      assert.equal((await User.findById(id).lean())?.sessionVersion, 0);
      assert.ok(await hasAdminFactor(id));
    } finally { auditFailure.mock.restore(); }

    const recovery = await Promise.all([replaceAdminFactor(id, { recoveryCode: codes[0] }, 0), replaceAdminFactor(id, { recoveryCode: codes[0] }, 0)]);
    const replacement = recovery.find(Boolean);
    assert.ok(replacement);
    assert.equal(recovery.filter(Boolean).length, 1);
    assert.equal((await User.findById(id).lean())?.sessionVersion, 1);
    assert.equal(await verifyAdminChallenge(pending, fresh), null);
    assert.equal(await hasAdminFactor(id), false);
    const newCodes = await confirmEnrollment(id, replacement.proof, totpAt(replacement.seed, Date.now() - 30000));
    assert.ok(newCodes);
    assert.equal(await replaceAdminFactor(id, { recoveryCode: codes[1] }, 1), null);
    assert.equal(await replaceAdminFactor(id, { recoveryCode: codes[0] }, 1), null);
    assert.equal(await restartPendingEnrollment(id, 1), null);
    const rotated = await replaceAdminFactor(id, { totp: totpAt(replacement.seed, Date.now()) }, 1);
    assert.ok(rotated);
    await AdminFactor.updateOne({ _id: user._id }, { $set: { enrollmentExpiresAt: new Date(0) } });
    assert.equal(await confirmEnrollment(id, rotated.proof, totpAt(rotated.seed, Date.now())), null);
    assert.ok(await restartPendingEnrollment(id, 2));
    assert.equal(await confirmEnrollment(id, rotated.proof, totpAt(rotated.seed, Date.now())), null);
    const serialized = JSON.stringify([await AdminAuditLog.find().lean(), await AdminSecurityEvent.find().lean(), await AdminFactor.collection.findOne({ _id: user._id })]);
    for (const secret of [setup.seed, setup.proof, rotated.seed, pending, ...codes, ...newCodes]) assert.equal(serialized.includes(secret), false);
    await Promise.all(Array.from({ length: 4 }, () => recordAdminDenial("access-denied", id)));
    assert.equal(await AdminSecurityEvent.countDocuments({ kind: "access-denied" }), 1);
    await assert.rejects(async () => {
      for (let index = 0; index <= 8; index++) await startAdminChallenge(id, 2);
    }, AdminFactorRateLimitError);
  } finally {
    await mongoose.disconnect();
    await replica.stop();
  }
});
