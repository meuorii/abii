import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";
import { User } from "@/models/User";
import { AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { AdminFactor } from "@/models/AdminFactor";
import { AuthRateLimit } from "@/models/AuthRateLimit";
import { provisionAdmin, verifyOperatorIndexes } from "@/lib/auth/admin-operator";
import { confirmEnrollment, replaceAdminFactor } from "@/lib/auth/admin-factor";
import { totpAt } from "@/lib/auth/admin-factor-crypto";

test("operator rejects standalone topology", async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri("operator_fixture"), { autoIndex: false, autoCreate: false });
    await assert.rejects(verifyOperatorIndexes({ database: "operator_fixture", replicaSet: "expected" }, true), /topology/);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

test("operator verifies effective constraints, provisions once and rehearses factor-loss recovery", { timeout: 120000 }, async () => {
  const rootPassword = randomBytes(24).toString("hex");
  const replica = await MongoMemoryReplSet.create({ replSet: {
    count: 1, auth: { enable: true, customRootName: "fixture-root", customRootPwd: rootPassword },
  } });
  const database = "operator_fixture";
  const uri = replica.getUri(database);
  process.env.MONGODB_URI = uri.replace("mongodb://", `mongodb://fixture-root:${rootPassword}@`) + "&authSource=admin";
  process.env.ADMIN_MFA_KEY_ID = "v1";
  process.env.ADMIN_MFA_KEYS = JSON.stringify({ v1: randomBytes(32).toString("base64") });
  process.env.AUTH_OTP_SECRET = randomBytes(32).toString("hex");
  const key = randomBytes(24).toString("hex");
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });
    const db = mongoose.connection.db!;
    const { setName } = await db.admin().command({ hello: 1 });
    const target = { database, replicaSet: String(setName) };
    const users = await db.createCollection("users");
    await users.createIndex({ email: 1 }, { unique: true, name: "user_email_unique" });
    await users.insertMany([{ email: "legacy@example.invalid" }, { email: "user@example.invalid", role: "user" }, { email: "other@example.invalid", role: "user" }]);
    await assert.rejects(verifyOperatorIndexes({ ...target, database: "wrong" }, true), /database/);
    await assert.rejects(provisionAdmin(target, "admin@example.invalid", key), /index/);
    await users.createIndex({ role: 1 }, { name: "wrong" });
    await assert.rejects(verifyOperatorIndexes(target, true), /mismatched/);
    await users.dropIndex("wrong");
    await users.insertOne({ email: "broken@example.invalid", role: ["user"] });
    await assert.rejects(verifyOperatorIndexes(target, true), /role data/);
    await users.deleteOne({ email: "broken@example.invalid" });
    await verifyOperatorIndexes(target, true);
    await verifyOperatorIndexes(target, true);
    await assert.rejects(provisionAdmin(target, "new@example.invalid", key));
    await Promise.all([AuthRateLimit.createIndexes(), AdminAuditLog.createIndexes(), AdminSecurityEvent.createIndexes(), AdminFactor.createCollection()]);
    await assert.rejects(provisionAdmin(target, "USER@example.invalid", key), /conflict/);
    const index = (await users.indexes()).find(i => i.name === "user_single_admin_unique");
    assert.equal(index?.unique, true);
    assert.deepEqual(index?.partialFilterExpression, { role: "admin" });
    const resource = { db: database, collection: users.collectionName };
    await db.command({ createRole: "fixtureApp", privileges: [{ resource, actions: ["find"] }], roles: [] });
    const appPassword = randomBytes(24).toString("hex");
    await db.command({ createUser: "fixture-app", pwd: appPassword, roles: ["fixtureApp"] });
    const app = new mongoose.mongo.MongoClient(uri, { auth: { username: "fixture-app", password: appPassword } });
    try {
      const appUsers = app.db(database).collection(users.collectionName);
      assert.ok(await appUsers.findOne({ email: "legacy@example.invalid" }));
      await assert.rejects(appUsers.indexes({ readPreference: "primary" }), { code: 13 });
      await db.command({ grantPrivilegesToRole: "fixtureApp", privileges: [{ resource, actions: ["listIndexes"] }] });
      assert.deepEqual((await appUsers.indexes({ readPreference: "primary" })).find(item => item.name === index.name), index);
    } finally { await app.close(); }
    const emails = ["admin@example.invalid", "alternate@example.invalid"];
    const results = await Promise.allSettled(emails.map(email => provisionAdmin(target, email, key)));
    const winner = results.findIndex(result => result.status === "fulfilled");
    assert.notEqual(winner, -1);
    const result = results[winner];
    assert.ok(result.status === "fulfilled" && result.value.status === "created");
    const added = result.value;
    const loser = results[1 - winner];
    assert.ok(loser.status === "rejected" && (loser.reason.code === 11000 || /conflict/i.test(loser.reason.message)));
    await assert.rejects(users.updateOne({ email: "user@example.invalid" }, { $set: { role: "admin" } }), { code: 11000 });
    assert.equal(await users.countDocuments({ role: "admin" }), 1);
    const prior = await users.findOne({ role: "admin" });
    assert.equal((await provisionAdmin(target, emails[winner].toUpperCase(), randomBytes(32).toString("hex"))).status, "already-provisioned");
    assert.deepEqual(await users.findOne({ role: "admin" }), prior);
    await assert.rejects(provisionAdmin(target, "second@example.invalid", key), /conflict/);

    const codes = await confirmEnrollment(added.userId, added.proof, totpAt(added.seed, Date.now()));
    assert.ok(codes && codes.length >= 2);
    const admin = await User.findById(added.userId).lean();
    assert.ok(admin);
    const credential = { recoveryCode: codes[0] };
    const attempts = await Promise.all([replaceAdminFactor(added.userId, credential, admin.sessionVersion), replaceAdminFactor(added.userId, credential, admin.sessionVersion)]);
    const winners = attempts.filter(a => a !== null);
    assert.equal(winners.length, 1);
    const renewed = winners[0]!;
    const changed = await User.findById(added.userId).lean();
    assert.ok(changed && changed.sessionVersion > admin.sessionVersion);
    const newCodes = await confirmEnrollment(added.userId, renewed.proof, totpAt(renewed.seed, Date.now()));
    assert.ok(newCodes && !newCodes.includes(codes[0]));
    const latest = await User.findById(added.userId).lean();
    assert.ok(latest);
    assert.equal(await replaceAdminFactor(added.userId, { recoveryCode: codes[1] }, latest.sessionVersion), null);
  } finally {
    await mongoose.disconnect();
    await replica.stop();
  }
});

