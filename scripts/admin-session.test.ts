import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SignJWT, decodeJwt } from "jose";
import { setUserSuspended } from "@/lib/auth/suspension";
import { User } from "@/models/User";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "@/models/Admin";
import { AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { digest, prepareEnrollment, totpAt } from "@/lib/auth/admin-factor-crypto";
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
    await Promise.all([AdminAuditLog.createCollection(), AdminSecurityEvent.createCollection()]);
    const { seed, encryptedSeed } = prepareEnrollment(ADMIN_SUBJECT);
    await Admin.create({
      _id: ADMIN_ID, name: "Admin Test", email: "admin@example.invalid", status: "active", sessionVersion: 0,
      passwordHash: "$2b$12$HUdxSbGT.hyi71fJSD2hr.uO9XngNUp.lzcO4cJUDKgl/Zzw8KCVu",
      mfa: { encryptedSeed, lastStep: Math.floor(Date.now() / 30_000) - 2 },
      recoveryCodes: Array.from({ length: 8 }, (_, index) => digest(String(index))),
    });
    const pending = await startAdminChallenge(0);
    assert.ok(pending);
    await assert.rejects(validateAdminSession(pending), rejected(401));
    const token = await finishAdminLogin(pending, totpAt(seed, Date.now()));
    assert.ok(token);
    const claims = decodeJwt(token);
    assert.equal(claims.exp! - claims.iat!, 1800);
    assert.equal((await validateAdminSession(token, true)).adminId, ADMIN_SUBJECT);
    const users = mongoose.connection.db!.collection("users");
    const ordinary = await User.create({ email: "ordinary@example.invalid", name: "Test", passwordHash: "fixture", emailVerifiedAt: new Date() });
    await assert.rejects(setUserSuspended(ordinary.id, true, "  ", token));
    assert.equal(await setUserSuspended(ADMIN_ID, true, "Account review", token), false);
    assert.equal(await setUserSuspended(ordinary.id, true, "  Account review  ", token), true);
    assert.equal(await setUserSuspended(ordinary.id, true, "Account review", token), false);
    assert.ok((await User.findById(ordinary._id).lean())?.suspendedAt instanceof Date);
    assert.equal(await setUserSuspended(ordinary.id, false, "Review completed", token), true);
    assert.equal((await User.findById(ordinary._id).lean())?.sessionVersion, 2);
    assert.equal(await AdminAuditLog.countDocuments({ targetId: ordinary.id }), 2);
    assert.equal((await AdminAuditLog.findOne({ targetId: ordinary.id, action: "user.suspend" }).lean())?.reason, "Account review");
    const concurrent = await Promise.all([
      setUserSuspended(ordinary.id, true, "Concurrent request one", token, 2),
      setUserSuspended(ordinary.id, true, "Concurrent request two", token, 2),
    ]);
    assert.equal(concurrent.filter(Boolean).length, 1);
    assert.equal((await User.findById(ordinary._id).lean())?.sessionVersion, 3);
    await mongoose.connection.db!.command({ collMod: "adminsecurityevents", validator: { kind: { $ne: "user.restore" } } });
    await assert.rejects(setUserSuspended(ordinary.id, false, "Audit must commit", token, 3), rejected(503));
    assert.ok((await User.findById(ordinary._id).lean())?.suspendedAt instanceof Date);
    assert.equal((await User.findById(ordinary._id).lean())?.sessionVersion, 3);
    assert.equal(await AdminAuditLog.countDocuments({ targetId: ordinary.id }), 3);
    await mongoose.connection.db!.command({ collMod: "adminsecurityevents", validator: {} });
    const restores = await Promise.all([
      setUserSuspended(ordinary.id, false, "Concurrent restore one", token, 3),
      setUserSuspended(ordinary.id, false, "Concurrent restore two", token, 3),
    ]);
    assert.equal(restores.filter(Boolean).length, 1);
    assert.equal((await User.findById(ordinary._id).lean())?.sessionVersion, 4);
    assert.equal(await setUserSuspended(ordinary.id, true, "Stale account revision", token, 2), false);
    assert.equal(await AdminAuditLog.countDocuments({ targetId: ordinary.id }), 4);
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const issue = (changes: object) => new SignJWT({ ...claims, ...changes }).setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" }).sign(key);
    for (const change of [{ aud: "abii-web" }, { sub: ordinary.id }, { sub: "primary" }, { amr: ["pwd"] }, { sv: undefined }, { sv: null }, { sv: 2 }, { sv: "0" }, { exp: now - 5 }, { iat: now + 600 }]) {
      await assert.rejects(validateAdminSession(await issue(change)), rejected(401));
    }
    const invalidSignature = await new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" }).sign(randomBytes(32));
    await assert.rejects(validateAdminSession(invalidSignature), rejected(401));
    await assert.rejects(validateAdminSession(await issue({ iat: now - 301, exp: now + 300 }), true), rejected(403));
    const ordinaryJWT = await new SignJWT({ sv: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(ordinary.id)
      .setIssuer("abii").setAudience("abii-web").setIssuedAt().setExpirationTime("5m").sign(key);
    await assert.rejects(setUserSuspended(ordinary.id, true, "Account review", ordinaryJWT), rejected(401));
    const keys = process.env.ADMIN_MFA_KEYS;
    delete process.env.ADMIN_MFA_KEYS;
    await assert.rejects(validateAdminSession(token), rejected(503));
    process.env.ADMIN_MFA_KEYS = keys;
    await Admin.updateOne({ _id: ADMIN_ID }, { $set: { status: "suspended" } });
    await assert.rejects(validateAdminSession(token), rejected(401));
    await Admin.updateOne({ _id: ADMIN_ID }, { $set: { status: "active" } });
    const legacy = (await users.insertOne({ email: "legacy-admin@example.invalid", role: "admin" })).insertedId;
    await assert.rejects(validateAdminSession(token), rejected(503));
    await users.deleteOne({ _id: legacy });
    const admins = mongoose.connection.db!.collection("admins");
    const unexpected = (await admins.insertOne({ invalid: true })).insertedId;
    await assert.rejects(validateAdminSession(token), rejected(503));
    await admins.deleteOne({ _id: unexpected });
    await revokeAdminSession(token);
    await assert.rejects(validateAdminSession(token), rejected(401));
    await revokeAdminSession(token);
    await assert.rejects(setUserSuspended(ordinary.id, true, "Account review", token), rejected(401));
    assert.equal(await AdminAuditLog.countDocuments({ action: "logout" }), 1);
    assert.equal((await Admin.findById(ADMIN_ID).lean())?.sessionVersion, 1);

    await t.test("logout wins before MFA consumes the challenge", async () => {
      const pending = await startAdminChallenge(1);
      assert.ok(pending);
      const started = Promise.withResolvers<void>();
      const resume = Promise.withResolvers<void>();
      const findOne = Admin.collection.findOne.bind(Admin.collection);
      const barrier = t.mock.method(Admin.collection, "findOne", async (...args: Parameters<typeof findOne>) => {
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
      const pending = await startAdminChallenge(1);
      assert.ok(pending);
      // Give this scenario an unused TOTP step without waiting for the clock.
      await Admin.updateOne({ _id: ADMIN_ID }, { $set: { "mfa.lastStep": Math.floor(Date.now() / 30_000) - 2 } });
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
        const replacement = await startAdminChallenge(1);
        assert.ok(replacement);
        await revokeAdminChallenge(pending);
        assert.equal(await finishAdminLogin(replacement, totpAt(seed, Date.now())), null);
      } finally { resume.resolve(); }
      const lateToken = await completion;
      assert.ok(lateToken);
      await assert.rejects(validateAdminSession(lateToken), rejected(401));
      assert.equal(await finishAdminLogin(pending, totpAt(seed, Date.now())), null);
      assert.equal(await AdminAuditLog.countDocuments({ action: "logout" }), 2);

      await Admin.updateOne({ _id: ADMIN_ID }, { $set: { "mfa.lastStep": Math.floor(Date.now() / 30_000) - 2 } });
      const fresh = await startAdminChallenge(2);
      assert.ok(fresh);
      const freshToken = await finishAdminLogin(fresh, totpAt(seed, Date.now()));
      assert.ok(freshToken);
      await revokeAdminChallenge(pending);
      assert.equal((await validateAdminSession(freshToken)).version, 2);
      await Admin.deleteOne({ _id: ADMIN_ID });
      await assert.rejects(validateAdminSession(freshToken), rejected(401));
    });
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
