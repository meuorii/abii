import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SignJWT, decodeJwt } from "jose";
import { setUserSuspended } from "@/lib/auth/suspension";
import { User } from "@/models/User";
import { AdminFactor } from "@/models/AdminFactor";
import { AdminAuditLog } from "@/models/AdminAuditLog";
import { prepareEnrollment, totpAt } from "@/lib/auth/admin-factor-crypto";
import { revokeAdminChallenge, startAdminChallenge } from "@/lib/auth/admin-factor";
import { AdminAccessError, finishAdminLogin, revokeAdminSession, validateAdminSession } from "@/lib/auth/admin-session-state";
import { safeAdminPath, safeNextPath } from "@/lib/auth/redirect";

test("admin redirects accept only exact destinations; ordinary redirects preserve learning navigation", () => {
  assert.equal(safeAdminPath("/admin/security"), "/admin/security");
  for (const value of ["/login", "/admin/nope", "/admin/../subjects", "/%2Fadmin", "/admin?next=foo", "https://example.invalid", "//external", null]) {
    assert.equal(safeAdminPath(value), "/admin");
  }
  for (const value of ["/admin", "/a/../admin/security", "/%61dmin", "/%252fadmin", "/login/mfa", "//external", "/%00", "/%", "/x/..//external.invalid", "/x/%2e%2e//external.invalid"]) {
    assert.equal(safeNextPath(value), "/dashboard");
  }
  assert.equal(safeNextPath("/subjects?sort=name"), "/subjects?sort=name");
});

test("admin sessions require the MFA audience, live factor, current scalar account state and version", async (t) => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri("admin_session_test");
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.AUTH_OTP_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_MFA_KEY_ID = "test";
  process.env.ADMIN_MFA_KEYS = JSON.stringify({ test: randomBytes(32).toString("base64") });
  const rejected = (status: number) => (error: unknown) => error instanceof AdminAccessError && error.status === status;
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.create({ role: "admin", email: "admin@example.invalid", name: "Test", passwordHash: "fixture", emailVerifiedAt: new Date(), sessionVersion: 0 });
    const { seed, encryptedSeed } = prepareEnrollment(user.id);
    await AdminFactor.create({ _id: user._id, state: "active", encryptedSeed });
    const pending = await startAdminChallenge(user.id, 0);
    assert.ok(pending);
    await assert.rejects(validateAdminSession(pending), rejected(401));
    const users = mongoose.connection.db!.collection(User.collection.name);
    const indexName = "user_single_admin_unique";
    const indexOptions = { name: indexName, partialFilterExpression: { role: "admin" } };
    await assert.rejects(finishAdminLogin(pending, totpAt(seed, Date.now())), rejected(503));
    assert.equal(await AdminAuditLog.countDocuments({ action: "login" }), 0);
    await users.createIndex({ role: 1 }, { ...indexOptions, unique: true });
    const token = await finishAdminLogin(pending, totpAt(seed, Date.now()));
    assert.ok(token);
    const claims = decodeJwt(token);
    assert.equal(claims.exp! - claims.iat!, 1800);
    assert.equal((await validateAdminSession(token, true)).userId, user.id);
    await users.dropIndex(indexName);
    await assert.rejects(validateAdminSession(token), rejected(503));
    await users.createIndex({ role: 1 }, indexOptions);
    await assert.rejects(validateAdminSession(token), rejected(503));
    await users.dropIndex(indexName);
    await users.createIndex({ role: 1 }, { ...indexOptions, unique: true });
    const ordinary = await User.create({ email: "ordinary@example.invalid", name: "Test", passwordHash: "fixture", emailVerifiedAt: new Date() });
    assert.equal(await setUserSuspended(user.id, true, token), false);
    assert.equal(await setUserSuspended(ordinary.id, true, token), true);
    assert.equal(await setUserSuspended(ordinary.id, true, token), false);
    assert.ok((await User.findById(ordinary._id).lean())?.suspendedAt instanceof Date);
    assert.equal(await setUserSuspended(ordinary.id, false, token), true);
    assert.equal((await User.findById(ordinary._id).lean())?.sessionVersion, 2);
    assert.equal(await AdminAuditLog.countDocuments({ targetId: ordinary._id }), 2);
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const issue = (changes: object) => new SignJWT({ ...claims, ...changes }).setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" }).sign(key);
    for (const change of [{ aud: "abii-web" }, { amr: ["pwd"] }, { sv: undefined }, { sv: null }, { sv: 2 }, { sv: "0" }, { exp: now - 5 }, { iat: now + 600 }]) {
      await assert.rejects(validateAdminSession(await issue(change)), rejected(401));
    }
    const invalidSignature = await new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" }).sign(randomBytes(32));
    await assert.rejects(validateAdminSession(invalidSignature), rejected(401));
    await assert.rejects(validateAdminSession(await issue({ iat: now - 301, exp: now + 300 }), true), rejected(403));
    for (const state of [{ role: ["admin"] }, { role: "user" }, { role: null }, { emailVerifiedAt: null }, { suspendedAt: new Date() }]) {
      await mongoose.connection.db!.collection("users").updateOne({ _id: user._id }, { $set: state });
      await assert.rejects(validateAdminSession(token), rejected(401));
      await User.collection.updateOne({ _id: user._id }, { $set: { role: "admin", suspendedAt: null, emailVerifiedAt: new Date() } });
    }
    const keys = process.env.ADMIN_MFA_KEYS;
    delete process.env.ADMIN_MFA_KEYS;
    await assert.rejects(validateAdminSession(token), rejected(503));
    process.env.ADMIN_MFA_KEYS = keys;
    await AdminFactor.updateOne({ _id: user._id }, { $set: { state: "pending" } });
    await assert.rejects(validateAdminSession(token), rejected(401));
    await AdminFactor.updateOne({ _id: user._id }, { $set: { state: "active" } });
    await revokeAdminSession(token);
    await assert.rejects(validateAdminSession(token), rejected(401));
    await revokeAdminSession(token);
    await assert.rejects(setUserSuspended(ordinary.id, true, token), rejected(401));
    assert.equal(await AdminAuditLog.countDocuments({ action: "logout" }), 1);
    assert.equal((await User.findById(user._id).lean())?.sessionVersion, 1);

    await t.test("logout wins before MFA consumes the challenge", async () => {
      const pending = await startAdminChallenge(user.id, 1);
      assert.ok(pending);
      const started = Promise.withResolvers<void>();
      const resume = Promise.withResolvers<void>();
      const findOne = AdminFactor.collection.findOne.bind(AdminFactor.collection);
      const barrier = t.mock.method(AdminFactor.collection, "findOne", async (...args: Parameters<typeof findOne>) => {
        started.resolve();
        await resume.promise;
        return findOne(...args);
      });
      const completion = finishAdminLogin(pending, totpAt(seed, Date.now()));
      try {
        await Promise.race([started.promise, completion.then(() => assert.fail("MFA did not reach its read barrier"))]);
        barrier.mock.restore();
        await revokeAdminChallenge(pending);
      } finally { resume.resolve(); }
      assert.equal(await completion, null);
      assert.equal(await finishAdminLogin(pending, totpAt(seed, Date.now())), null);
    });

    await t.test("logout revokes a committed MFA login whose response is still in flight", async () => {
      const pending = await startAdminChallenge(user.id, 1);
      assert.ok(pending);
      // Give this scenario an unused TOTP step without waiting for the clock.
      await AdminFactor.updateOne({ _id: user._id }, { $set: { lastStep: -1 } });
      const signing = Promise.withResolvers<void>();
      const resume = Promise.withResolvers<void>();
      const sign = SignJWT.prototype.sign;
      const barrier = t.mock.method(SignJWT.prototype, "sign", async function (this: SignJWT, ...args: Parameters<typeof sign>) {
        signing.resolve();
        await resume.promise;
        return sign.apply(this, args);
      });
      const completion = finishAdminLogin(pending, totpAt(seed, Date.now()));
      try {
        await Promise.race([signing.promise, completion.then(() => assert.fail("MFA did not reach signing"))]);
        barrier.mock.restore();
        const replacement = await startAdminChallenge(user.id, 1);
        assert.ok(replacement);
        await revokeAdminChallenge(pending);
        assert.equal(await finishAdminLogin(replacement, totpAt(seed, Date.now())), null);
      } finally { resume.resolve(); }
      const lateToken = await completion;
      assert.ok(lateToken);
      await assert.rejects(validateAdminSession(lateToken), rejected(401));
      assert.equal(await finishAdminLogin(pending, totpAt(seed, Date.now())), null);
      assert.equal(await AdminAuditLog.countDocuments({ action: "logout" }), 2);

      await AdminFactor.updateOne({ _id: user._id }, { $set: { lastStep: -1 } });
      const fresh = await startAdminChallenge(user.id, 2);
      assert.ok(fresh);
      const freshToken = await finishAdminLogin(fresh, totpAt(seed, Date.now()));
      assert.ok(freshToken);
      await revokeAdminChallenge(pending);
      assert.equal((await validateAdminSession(freshToken)).version, 2);
      await users.deleteOne({ _id: user._id });
      await assert.rejects(validateAdminSession(freshToken), rejected(401));
    });
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
