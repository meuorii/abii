import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { connect, createServer } from "node:tls";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose, { type mongo } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

test("the single guided setup command is exposed without a separate schema command", () => {
  const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(scripts["admin:setup"] ?? "", /scripts\/bootstrap-admin\.ts$/);
  assert.equal(scripts["admin:prepare"], undefined);
});
import { approvedAtlasTarget, bootstrapAdmin, BootstrapStop, safeSetupError, type BootstrapTerminal, type SetupStage, validateBootstrapUri } from "@/lib/auth/admin-bootstrap";
import { verifyOperatorStorage } from "@/lib/auth/admin-operator";
import { atlasIdentityCheck } from "@/lib/auth/admin-operator-topology";
import { startAdminChallenge } from "@/lib/auth/admin-factor";
import { totpAt } from "@/lib/auth/admin-factor-crypto";
import { finishAdminLogin, validateAdminSession } from "@/lib/auth/admin-session-state";
import { AuthRateLimit } from "@/models/AuthRateLimit";
import { AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { Admin, ADMIN_ID, ADMIN_SUBJECT } from "@/models/Admin";

test("bootstrap pins the Atlas seed hosts and database before connecting", () => {
  const uri = "mongodb+srv://fixture.example.mongodb.net/abii";
  const target = approvedAtlasTarget("REPLICASET", "member.example.mongodb.net:27017");
  assert.equal(validateBootstrapUri(uri, "fixture.example.mongodb.net", target), uri);
  for (const candidate of [
    uri.replace("/abii", "/abii_admin_dev"),
    uri.replace("fixture.example", "other.example"),
    uri + "?tls=false",
    uri + "?tlsAllowInvalidHostnames=true",
    uri + "?tlsCAFile=alternate.pem",
    uri + "?directConnection=true",
    uri + "?replicaSet=wrong",
  ]) assert.throws(() => validateBootstrapUri(candidate, "fixture.example.mongodb.net", target), BootstrapStop);
  assert.throws(() => validateBootstrapUri(uri, undefined, target), BootstrapStop);
  assert.throws(() => approvedAtlasTarget("SHARDED", "member.example.mongodb.net:27017"), BootstrapStop);
  assert.throws(() => approvedAtlasTarget("REPLICASET", undefined), BootstrapStop);
  const standard = "mongodb://member.example.mongodb.net:27017/abii?tls=true";
  assert.equal(validateBootstrapUri(standard, "member.example.mongodb.net:27017", target), standard);
  assert.throws(() => validateBootstrapUri(standard.replace("member.", "other."), "other.example.mongodb.net:27017", target), BootstrapStop);
});

test("bootstrap CLI refuses redirected input before loading local configuration", () => {
  for (const args of [[], ["rotate"], ["recover"]]) {
    const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "./scripts/register-typescript.mjs", "scripts/bootstrap-admin.ts", ...args], {
      encoding: "utf8", windowsHide: true, timeout: 15_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /private interactive terminal/i);
  }
});

test("build and development scripts do not invoke the bootstrap", () => {
  const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  for (const name of ["dev", "build", "start"]) {
    for (const prefix of ["", "pre", "post"]) assert.doesNotMatch(scripts[prefix + name] ?? "", /admin:setup|bootstrap-admin/);
  }
});

test("Atlas TLS pinning requires an approved hostname and a matching trusted certificate", async t => {
  const cert = readFileSync(new URL("./fixtures/admin-loopback-cert.pem", import.meta.url));
  const key = readFileSync(new URL("./fixtures/admin-loopback-key.pem", import.meta.url));
  const server = createServer({ cert, key }, socket => socket.end());
  t.after(() => { server.close(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;
  const handshake = (servername: string, approvedHost: string, ca?: Buffer) => new Promise<void>((resolve, reject) => {
    const socket = connect({
      host: "127.0.0.1", port, servername, ca, rejectUnauthorized: true,
      checkServerIdentity: atlasIdentityCheck([`${approvedHost}:${port}`]),
    }, () => { socket.end(); resolve(); });
    socket.once("error", reject);
  });
  await handshake("localhost", "localhost", cert);
  await assert.rejects(handshake("localhost", "other.example", cert), /outside the approved Atlas inventory/);
  await assert.rejects(handshake("other.example", "other.example", cert), { code: "ERR_TLS_CERT_ALTNAME_INVALID" });
  await assert.rejects(handshake("localhost", "localhost"), { code: "DEPTH_ZERO_SELF_SIGNED_CERT" });
});

test("setup provisions and resumes on an authenticated replica set with an Atlas-style denial", { timeout: 120_000 }, async t => {
  const rootPassword = randomBytes(24).toString("hex");
  const replica = await MongoMemoryReplSet.create({ replSet: {
    count: 1,
    auth: { enable: true, customRootName: "fixture-root", customRootPwd: rootPassword },
  } });
  const database = "bootstrap_fixture";
  const uri = replica.getUri(database);
  const operatorPassword = randomBytes(24).toString("hex");
  process.env.MONGODB_URI = uri.replace("mongodb://", `mongodb://fixture-operator:${operatorPassword}@`);
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.AUTH_OTP_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_MFA_KEY_ID = "fixture";
  const keys = JSON.stringify({ fixture: randomBytes(32).toString("base64") });
  const password = randomBytes(24).toString("hex");
  const email = "operator@example.invalid";
  const pause = new Error("fixture interruption");

  function terminal(options: { email?: string; password?: string; stop?: boolean; recoveryCode?: string; authorize?: () => Promise<boolean> } = {}) {
    let seed = "";
    let codes: readonly string[] = [];
    let approvals = 0;
    let stage: SetupStage = "configuration";
    const credentials = options.password ?? password;
    const io: BootstrapTerminal = {
      onStage: currentStage => { stage = currentStage; },
      describe() {},
      name: async () => "Fixture Administrator",
      recoveryCode: async () => options.recoveryCode ?? "",
      email: async () => options.email ?? email.toUpperCase(),
      password: async () => credentials,
      confirmPassword: async () => credentials,
      authorizeWrite: async () => { approvals++; return options.authorize?.() ?? true; },
      showSetupKey: value => { seed = value; },
      code: async () => {
        if (options.stop) throw pause;
        return totpAt(seed, Date.now() - 30_000);
      },
      showRecoveryCodes: value => { codes = value; },
    };
    return { io, codes: () => codes, approvals: () => approvals, seed: () => seed, stage: () => stage };
  }

  try {
    const root = new mongoose.mongo.MongoClient(uri, { auth: { username: "fixture-root", password: rootPassword }, authSource: "admin" });
    try {
      await root.db(database).command({ createUser: "fixture-operator", pwd: operatorPassword, roles: ["readWrite"] });
    } finally { await root.close(); }
    const members = [new URL(uri).host];
    const replicaSet = new URL(uri).searchParams.get("replicaSet")!;
    const checkServerIdentity = atlasIdentityCheck(members);
    const target = { database, replicaSet, atlas: { clusterType: "REPLICASET" as const, members, checkServerIdentity } };
    await mongoose.connect(process.env.MONGODB_URI, { replicaSet, autoCreate: false, autoIndex: false });
    const db = mongoose.connection.db!;
    const admin = db.admin();
    await assert.rejects(admin.command({ getCmdLineOpts: 1 }), { code: 13 });
    await assert.rejects(verifyOperatorStorage({ database, replicaSet }), /topology/);
    await assert.rejects(verifyOperatorStorage(target), /topology/);
    // TLS certificate verification is exercised by the loopback handshake test above.
    const client = mongoose.connection.getClient();
    t.mock.method(mongoose.connection, "getClient", () => Object.create(client, { options: {
      value: { ...client.options, tls: true, rejectUnauthorized: true, checkServerIdentity },
    } }));
    const command = admin.command.bind(admin);
    let helloOverride: mongo.Document = {};
    let commandLine: mongo.Document | undefined;
    let denial = new mongoose.mongo.MongoServerError({ code: 8000, codeName: "AtlasError", errmsg: "insufficient privileges" });
    t.mock.method(db, "admin", () => admin);
    t.mock.method(admin, "command", async (query: mongo.Document, options?: mongo.RunCommandOptions) => {
      if (query.hello) return { ...await command(query, options), ...helloOverride };
      if (!query.getCmdLineOpts) return command(query, options);
      if (commandLine) return commandLine;
      throw denial;
    });
    for (const override of [{ msg: "isdbgrid" }, { configsvr: 2 }, { primary: undefined }, { hosts: [] }]) {
      helloOverride = override;
      await assert.rejects(verifyOperatorStorage(target), /topology/);
    }
    helloOverride = {};
    commandLine = { parsed: { sharding: { clusterRole: "shardsvr" } }, argv: ["mongod"] };
    await assert.rejects(verifyOperatorStorage(target), /topology/);
    commandLine = undefined;
    denial = new mongoose.mongo.MongoServerError({ code: 8000, codeName: "AtlasError", errmsg: "unrelated server failure" });
    await assert.rejects(verifyOperatorStorage(target), /topology/);
    denial = new mongoose.mongo.MongoServerError({ code: 8000, codeName: "AtlasError", errmsg: "insufficient privileges" });
    const users = await db.createCollection("users");
    const learner = { _id: new mongoose.Types.ObjectId(), email: "learner@example.invalid", role: "user" };
    await users.insertOne(learner);
    const subjects = db.collection("subjects");
    const study = await subjects.insertOne({ title: "Fixture subject" });
    await users.createIndex({ email: 1 }, { unique: true });
    const legacyIndex = await users.createIndex({ role: 1 }, { name: "user_single_admin_unique", unique: true, partialFilterExpression: { role: "admin" } });
    await AuthRateLimit.createIndexes();
    const noAdmins = async () => assert.equal(await db.listCollections({ name: "admins" }).hasNext(), false);
    await assert.rejects(bootstrapAdmin(target, terminal().io), /adminauditlogs/);
    await noAdmins();
    assert.equal(await db.listCollections({ name: "adminauditlogs" }).hasNext(), false);
    assert.equal(await db.listCollections({ name: "adminsecurityevents" }).hasNext(), false);
    for (const model of [AdminAuditLog, AdminSecurityEvent]) {
      await model.createCollection();
      await model.createIndexes();
    }
    process.env.ADMIN_MFA_KEYS = "{}";
    await assert.rejects(bootstrapAdmin(target, terminal().io), /keyring/i);
    process.env.ADMIN_MFA_KEYS = keys;

    const denied = terminal({ authorize: async () => false });
    await assert.rejects(bootstrapAdmin(target, denied.io), /approval/i);
    assert.equal(denied.approvals(), 1);
    const collision = terminal({ email: learner.email.toUpperCase() });
    await assert.rejects(bootstrapAdmin(target, collision.io), /dedicated email/i);
    assert.equal(collision.approvals(), 0);
    const legacy = (await users.insertOne({ email: "old@example.invalid", role: "admin" })).insertedId;
    await assert.rejects(bootstrapAdmin(target, terminal().io), /retire the legacy identity/i);
    assert.equal((await users.findOne({ _id: legacy }))?.role, "admin");
    await users.deleteOne({ _id: legacy });
    await noAdmins();
    assert.equal(await AdminAuditLog.countDocuments(), 0);
    assert.equal(await AuthRateLimit.countDocuments(), 0);

    const failedAudit = t.mock.method(AdminAuditLog, "create", async () => { throw Error("fixture audit failure"); });
    try {
      await assert.rejects(bootstrapAdmin(target, terminal().io), /fixture audit failure/);
    } finally { failedAudit.mock.restore(); }
    await noAdmins();

    const ready = Promise.withResolvers<void>();
    let waiting = 0;
    const authorize = async () => {
      if (++waiting === 2) ready.resolve();
      await ready.promise;
      return true;
    };
    const attempts = [terminal({ stop: true, authorize }), terminal({ stop: true, authorize, email: "second@example.invalid" })];
    const results = await Promise.allSettled(attempts.map(entry => bootstrapAdmin(target, entry.io)));
    assert.equal(results.filter(result => result.status === "rejected" && result.reason === pause).length, 1);
    assert.equal(results.filter(result => result.status === "rejected" && /claimed the administrator slot/.test(result.reason.message)).length, 1);
    assert.equal(await Admin.countDocuments(), 1);
    await assert.rejects(db.collection<{ _id: string }>("admins").insertOne({ _id: ADMIN_ID }), { code: 11000 });
    assert.deepEqual((await db.collection("admins").indexes()).map(index => index.name), ["_id_"]);
    const pending = await Admin.findById(ADMIN_ID).select("+mfa").lean().orFail();
    assert.equal(pending.status, "pending");
    assert.equal(await startAdminChallenge(0), null);
    await assert.rejects(bootstrapAdmin(target, terminal().io), /enrollment is pending/i);
    await Admin.updateOne({ _id: ADMIN_ID }, { $set: { "mfa.enrollmentExpiresAt": new Date(0) } });
    await assert.rejects(bootstrapAdmin(target, terminal({ email: pending.email, password: "wrong-but-valid-password" }).io), /credentials/i);

    const beforeRestart = await Admin.findById(ADMIN_ID).select("+mfa").lean().orFail();
    // The approved Atlas deployment accepts exact-name metadata filters only.
    const listCollections = db.listCollections.bind(db);
    let blockAuditLookup = true;
    t.mock.method(db, "listCollections", (filter: mongo.Document, options?: mongo.ListCollectionsOptions) => {
      if (typeof filter.name === "object" && filter.name && "$in" in filter.name ||
          blockAuditLookup && options?.nameOnly && filter.name === AdminAuditLog.collection.name) {
        throw new mongoose.mongo.MongoServerError({ code: 8000, codeName: "AtlasError", errmsg: "Invalid filter with fixture-secret-payload" });
      }
      return listCollections(filter, options);
    });
    const blocked = terminal({ email: pending.email });
    await assert.rejects(bootstrapAdmin(target, blocked.io), error => {
      const output = safeSetupError(error, blocked.stage());
      assert.match(output, /restart audit storage \(Atlas rejected a database command, MongoDB code 8000\)/);
      assert.doesNotMatch(output, /fixture-secret-payload/);
      return true;
    });
    blockAuditLookup = false;
    assert.equal(blocked.approvals(), 1);
    assert.equal(blocked.seed(), "");
    assert.deepEqual(await Admin.findById(ADMIN_ID).select("+mfa").lean(), beforeRestart);

    const blockedAuditWrite = terminal({ email: pending.email });
    const deniedAuditWrite = t.mock.method(AdminSecurityEvent, "create", async () => {
      throw new mongoose.mongo.MongoServerError({ code: 13, errmsg: "Rejected write with fixture-secret-payload" });
    });
    try {
      await assert.rejects(bootstrapAdmin(target, blockedAuditWrite.io), error => {
        const output = safeSetupError(error, blockedAuditWrite.stage());
        assert.match(output, /restart audit write \(database permission denied, MongoDB code 13\)/);
        assert.doesNotMatch(output, /fixture-secret-payload/);
        return true;
      });
    } finally { deniedAuditWrite.mock.restore(); }
    assert.equal(blockedAuditWrite.seed(), "");
    assert.deepEqual(await Admin.findById(ADMIN_ID).select("+mfa").lean(), beforeRestart);
    assert.equal(await AdminAuditLog.countDocuments({ action: "enrollment-restart" }), 0);

    const resume = terminal({ email: pending.email });
    assert.equal(await bootstrapAdmin(target, resume.io), "resumed");
    assert.equal(resume.approvals(), 1);
    assert.match(resume.seed(), /^[A-Z2-7]{32}$/);
    assert.equal(resume.codes().length, 8);
    const activated = await Admin.findById(ADMIN_ID).select("+mfa +recoveryCodes +passwordHash").lean().orFail();
    assert.equal(activated.status, "active");
    assert.equal(activated.sessionVersion, beforeRestart.sessionVersion);
    assert.notEqual(activated.mfa.encryptedSeed, beforeRestart.mfa.encryptedSeed);
    for (const action of ["enrollment-restart", "enroll"]) {
      assert.equal(await AdminAuditLog.countDocuments({ actorId: ADMIN_SUBJECT, action }), 1);
      assert.equal(await AdminSecurityEvent.countDocuments({ actorId: ADMIN_SUBJECT, kind: action }), 1);
    }
    assert.equal(activated.recoveryCodes.length, 8);
    assert.notEqual(activated.mfa.encryptedSeed, resume.seed());
    const rerun = terminal();
    assert.equal(await bootstrapAdmin(target, rerun.io), "already-active");
    assert.equal(rerun.approvals(), 0);
    assert.deepEqual(await Admin.findById(ADMIN_ID).select("+mfa +recoveryCodes +passwordHash").lean(), activated);
    assert.equal(await AdminAuditLog.countDocuments({ actorId: ADMIN_SUBJECT, action: "provision" }), 1);
    const challenge = await startAdminChallenge(activated.sessionVersion);
    assert.ok(challenge);
    const jwt = await finishAdminLogin(challenge, totpAt(resume.seed(), Date.now()));
    assert.ok(jwt);
    assert.equal((await validateAdminSession(jwt)).adminId, ADMIN_SUBJECT);

    const replacementPassword = "fixture-replacement-password";
    const recover = terminal({ email: pending.email, password: replacementPassword, recoveryCode: resume.codes()[0] });
    assert.equal(await bootstrapAdmin(target, recover.io, "recover"), "resumed");
    assert.equal(recover.approvals(), 1);
    const recovered = await Admin.findById(ADMIN_ID).select("+passwordHash").lean().orFail();
    assert.equal(await bcrypt.compare(replacementPassword, recovered.passwordHash), true);
    assert.equal(await bcrypt.compare(password, recovered.passwordHash), false);
    assert.equal(recovered.sessionVersion, activated.sessionVersion + 1);
    await assert.rejects(validateAdminSession(jwt), { status: 401 });
    assert.deepEqual(await users.find().toArray(), [learner]);
    assert.equal((await subjects.findOne({ _id: study.insertedId }))?.title, "Fixture subject");
    assert.equal((await users.indexes()).some(index => index.name === legacyIndex), true);
    assert.equal(await db.listCollections({ name: "adminfactors" }).hasNext(), false);
  } finally {
    await mongoose.disconnect();
    await replica.stop();
  }
});
