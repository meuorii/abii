import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SignJWT } from "jose";

const passwordHash = "$2b$12$HUdxSbGT.hyi71fJSD2hr.uO9XngNUp.lzcO4cJUDKgl/Zzw8KCVu";
const environmentKeys = ["MONGODB_URI", "AUTH_SECRET", "AUTH_OTP_SECRET", "ADMIN_MFA_KEY_ID", "ADMIN_MFA_KEYS", "SUPPORT_TICKET_ENCRYPTION_KEY", "SUPPORT_TICKET_ENCRYPTION_KEY_ID", "SUPPORT_INBOX_EMAIL", "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "APP_BASE_URL", "EMAIL_ASSET_BASE_URL"] as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function bounded<T>(stage: string, operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out while ${stage}.`)), 10_000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

test("authenticated support response operations remain safe under contention and failure", { timeout: 120_000 }, async t => {
  const savedEnvironment = new Map(environmentKeys.map(key => [key, process.env[key]]));
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const originalFetch = globalThis.fetch;
  const secret = randomBytes(32).toString("hex");
  const uri = replica.getUri("support_concurrency_test");
  let providerCalls = 0;
  let provider = async () => new Response(JSON.stringify({ messageId: "provider-default" }), { status: 201, headers: { "content-type": "application/json" } });

  process.env.MONGODB_URI = uri;
  process.env.AUTH_SECRET = secret;
  process.env.AUTH_OTP_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_MFA_KEY_ID = "concurrency";
  process.env.ADMIN_MFA_KEYS = JSON.stringify({ concurrency: randomBytes(32).toString("base64") });
  process.env.SUPPORT_TICKET_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.SUPPORT_TICKET_ENCRYPTION_KEY_ID = "concurrency";
  process.env.SUPPORT_INBOX_EMAIL = "support@example.invalid";
  process.env.BREVO_API_KEY = "concurrency-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.invalid";
  process.env.APP_BASE_URL = "https://app.example.invalid";
  process.env.EMAIL_ASSET_BASE_URL = "https://assets.example.invalid";
  globalThis.fetch = async url => {
    assert.equal(String(url), "https://api.brevo.com/v3/smtp/email");
    providerCalls++;
    return provider();
  };

  try {
    const [{ connectToDatabase }, { withRequiredTransaction }, { ADMIN_ID, ADMIN_SUBJECT, Admin }, { AdminAuditLog, AdminSecurityEvent }, { SupportResponseOperation, SupportTicket, SupportTicketActivity }, { createSupportTicket }, { prepareEnrollment, digest }, { sendSupportResponse, readSupportOperation }, { revokeAdminSession, ADMIN_LIFETIME }, { SESSION_ISSUER }] = await Promise.all([
      import("@/lib/mongodb"), import("@/lib/mongodb-transaction"), import("@/models/Admin"), import("@/models/AdminAuditLog"), import("@/models/SupportTicket"), import("@/lib/support/tickets"), import("@/lib/auth/admin-factor-crypto"), import("@/lib/admin/support"), import("@/lib/auth/admin-session-state"), import("@/lib/auth/constants"),
    ]);
    const db = await bounded("connecting to the isolated replica set", connectToDatabase());
    assert.equal(db.connection.db?.databaseName, "support_concurrency_test");
    await Promise.all([AdminAuditLog.createCollection(), AdminSecurityEvent.createCollection(), SupportTicket.createCollection(), SupportTicketActivity.createCollection(), SupportResponseOperation.createCollection()]);
    await SupportResponseOperation.collection.createIndex({ ticketId: 1, operationId: 1 }, { unique: true, name: "support_response_operation_unique" });

    let sequence = 0;
    const sign = async (ageSeconds = 0) => {
      const issuedAt = Math.floor(Date.now() / 1000) - ageSeconds;
      const sessionId = randomBytes(24).toString("base64url");
      const environment = process.env.NODE_ENV === "production" ? "production" : "development";
      const authenticatedAt = new Date(issuedAt * 1000);
      await Admin.updateOne({ _id: ADMIN_ID }, { $set: { activeSession: { sessionId, version: 0, authenticatedAt, absoluteExpiresAt: new Date((issuedAt + ADMIN_LIFETIME) * 1000), lastActivityAt: new Date(), environment } } });
      return new SignJWT({ sv: 0, sid: sessionId, env: environment, amr: ["pwd", "otp"] }).setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" }).setAudience("abii-admin").setIssuer(SESSION_ISSUER).setSubject(ADMIN_SUBJECT).setIssuedAt(issuedAt).setExpirationTime(issuedAt + ADMIN_LIFETIME).sign(new TextEncoder().encode(secret));
    };
    const reset = async () => {
      await Promise.all([AdminAuditLog.deleteMany({}), AdminSecurityEvent.deleteMany({}), SupportResponseOperation.deleteMany({}), SupportTicketActivity.deleteMany({}), SupportTicket.deleteMany({}), Admin.deleteMany({})]);
      const { encryptedSeed } = prepareEnrollment(ADMIN_SUBJECT);
      await Admin.create({ _id: ADMIN_ID, name: "Concurrency Admin", email: "admin@example.invalid", passwordHash, status: "active", sessionVersion: 0, mfa: { encryptedSeed, lastStep: Math.floor(Date.now() / 30_000) - 2 }, recoveryCodes: Array.from({ length: 8 }, (_, index) => digest(String(index))) });
      providerCalls = 0;
      provider = async () => new Response(JSON.stringify({ messageId: `provider-${sequence}` }), { status: 201, headers: { "content-type": "application/json" } });
      return sign();
    };
    const ticket = async () => {
      sequence++;
      const row = await createSupportTicket({ submissionKey: sequence.toString(16).padStart(64, "0"), payloadHash: (sequence + 10_000).toString(16).padStart(64, "0"), name: "Customer", email: `customer-${sequence}@example.invalid`, category: "Other", message: "Customer request." });
      await SupportTicket.updateOne({ _id: row._id }, { $set: { status: "open" } });
      return row;
    };
    const operation = (id: string, operationId: string, message = "A carefully tracked support response.") => ({ id, operationId, message });
    const responseCount = (ticketId: unknown) => SupportTicketActivity.countDocuments({ ticketId, kind: "admin_response" });
    const deliveryCount = (ticketId: unknown) => SupportTicketActivity.countDocuments({ ticketId, kind: "delivery" });

    await t.test("the replica-set transaction driver retries a labeled transient error", async () => {
      const records = mongoose.connection.db!.collection("support_concurrency_retry_records"); let attempts = 0;
      await withRequiredTransaction(async session => {
        attempts++;
        await records.insertOne({ attempt: attempts }, { session });
        if (attempts === 1) {
          const error = new mongoose.mongo.MongoServerError({ message: "injected retryable transaction error", code: 112 });
          error.addErrorLabel("TransientTransactionError");
          throw error;
        }
      });
      assert.equal(attempts, 2); assert.equal(await records.countDocuments(), 1);
    });

    await t.test("concurrent identical responses invoke Brevo once", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000001";
      const started = deferred<void>(); const finish = deferred<Response>();
      provider = async () => { started.resolve(); return finish.promise; };
      const first = sendSupportResponse(token, operation(String(row._id), operationId));
      await bounded("the first provider request", started.promise);
      const second = await bounded("the concurrent replay", sendSupportResponse(token, operation(String(row._id), operationId)));
      assert.equal(second.state, "sending"); assert.equal(providerCalls, 1);
      finish.resolve(new Response(JSON.stringify({ messageId: "one" }), { status: 201, headers: { "content-type": "application/json" } }));
      assert.equal((await first).state, "accepted");
      assert.equal(await SupportResponseOperation.countDocuments({ ticketId: row._id, operationId }), 1);
      assert.equal(await responseCount(row._id), 1); assert.equal(await deliveryCount(row._id), 1);
      const updated = await SupportTicket.findById(row._id).lean() as unknown as { status: string; revision: number; lastResponseAt?: Date } | null;
      assert.equal(updated?.status, "awaiting_reply"); assert.equal(updated?.revision, 1); assert.ok(updated?.lastResponseAt);
      assert.equal(await AdminAuditLog.countDocuments({ action: "support.response" }), 1);
    });

    await t.test("parallel initial creation retains one operation and one provider call", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000010";
      const results = await Promise.all([sendSupportResponse(token, operation(String(row._id), operationId)), sendSupportResponse(token, operation(String(row._id), operationId))]);
      assert.ok(results.every(result => result.state === "accepted" || result.state === "sending"));
      assert.equal(providerCalls, 1); assert.equal(await SupportResponseOperation.countDocuments({ ticketId: row._id, operationId }), 1);
      assert.equal(await responseCount(row._id), 1); assert.equal(await deliveryCount(row._id), 1);
    });

    await t.test("accepted replay remains read-only after ticket resolution", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000002";
      const accepted = await sendSupportResponse(token, operation(String(row._id), operationId)); assert.equal(accepted.state, "accepted");
      await SupportTicket.updateOne({ _id: row._id }, { $set: { status: "resolved" } });
      const before = await SupportTicket.findById(row._id).lean(); const activities = await SupportTicketActivity.countDocuments({ ticketId: row._id });
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "accepted");
      const after = await SupportTicket.findById(row._id).lean(); assert.equal(providerCalls, 1); assert.equal(await SupportTicketActivity.countDocuments({ ticketId: row._id }), activities); assert.equal(after?.revision, before?.revision);
    });

    await t.test("conflicting replay cannot change immutable response content", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000003";
      await sendSupportResponse(token, operation(String(row._id), operationId));
      const saved = await SupportResponseOperation.findOne({ ticketId: row._id, operationId }).lean() as unknown as { body: unknown; recipient: string } | null;
      await assert.rejects(sendSupportResponse(token, operation(String(row._id), operationId, "Different response.")), { name: "SupportConflict" });
      const unchanged = await SupportResponseOperation.findOne({ ticketId: row._id, operationId }).lean() as unknown as { body: unknown; recipient: string } | null;
      assert.deepEqual(unchanged?.body, saved?.body); assert.equal(unchanged?.recipient, saved?.recipient); assert.equal(providerCalls, 1);
    });

    await t.test("known provider rejection records one failed delivery without resend", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000004";
      provider = async () => new Response("{}", { status: 429 });
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "failed");
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "failed");
      assert.equal(providerCalls, 1); assert.equal(await responseCount(row._id), 0); assert.equal(await deliveryCount(row._id), 1);
      assert.equal((await SupportResponseOperation.findOne({ ticketId: row._id, operationId }).lean() as unknown as { state: string } | null)?.state, "failed");
    });

    await t.test("ambiguous provider outcomes remain uncertain and cannot resend", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000005";
      provider = async () => new Response("{}", { status: 503 });
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "uncertain");
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "uncertain");
      assert.equal(providerCalls, 1); assert.equal(await responseCount(row._id), 0); assert.equal(await deliveryCount(row._id), 1);
      assert.equal((await readSupportOperation(String(row._id), operationId))?.state, "uncertain");
    });

    await t.test("provider response classifications remain durable and replay-safe", async () => {
      const known = [400, 401, 403, 429]; const ambiguous = [500, 503];
      for (const [index, status] of [...known, ...ambiguous].entries()) {
        const token = await reset(); const row = await ticket(); const operationId = `10000000-0000-4000-8000-${(20 + index).toString().padStart(12, "0")}`;
        provider = async () => new Response("{}", { status });
        const expected = known.includes(status) ? "failed" : "uncertain";
        assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, expected);
        assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, expected);
        assert.equal(providerCalls, 1); assert.equal(await responseCount(row._id), 0); assert.equal(await deliveryCount(row._id), 1);
      }
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000030";
      provider = async () => { throw new Error("injected network interruption"); };
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "uncertain");
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "uncertain"); assert.equal(providerCalls, 1);
    });

    await t.test("failed-state persistence rolls back atomically without resend", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000031";
      provider = async () => new Response("{}", { status: 400 });
      const target = SupportTicketActivity as unknown as { create: (...args: unknown[]) => unknown };
      const original = target.create;
      target.create = async (...args: unknown[]) => {
        const [documents] = args;
        if (Array.isArray(documents) && documents.some(document => (document as { kind?: string }).kind === "delivery")) throw new Error("injected failure activity error");
        return (original as unknown as (...callArgs: unknown[]) => unknown).apply(SupportTicketActivity, args);
      };
      try { assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "uncertain"); }
      finally { target.create = original; }
      assert.equal(providerCalls, 1); assert.equal(await deliveryCount(row._id), 0);
      assert.equal((await readSupportOperation(String(row._id), operationId))?.state, "sending");
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "sending"); assert.equal(providerCalls, 1);
    });

    await t.test("post-provider finalization failure preserves sending evidence and prevents resend", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000006";
      const original = SupportTicketActivity.create;
      (SupportTicketActivity as unknown as { create: typeof original }).create = (async (documents: unknown[]) => {
        if (Array.isArray(documents) && documents.some(document => (document as { kind?: string }).kind === "admin_response")) throw new Error("injected finalization failure");
        return (original as unknown as (...args: unknown[]) => unknown)(documents);
      }) as typeof original;
      try { assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "uncertain"); }
      finally { (SupportTicketActivity as unknown as { create: typeof original }).create = original; }
      assert.equal(providerCalls, 1); assert.equal(await responseCount(row._id), 0); assert.equal(await deliveryCount(row._id), 0);
      assert.equal((await readSupportOperation(String(row._id), operationId))?.state, "sending");
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "sending"); assert.equal(providerCalls, 1);
    });

    await t.test("lost accepted finalization does not falsely report success", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000007";
      const original = SupportResponseOperation.updateOne;
      (SupportResponseOperation as unknown as { updateOne: typeof original }).updateOne = ((filter: { state?: string }, update: { $set?: { state?: string } }) => {
        if (filter.state === "sending" && update.$set?.state === "accepted") return Promise.resolve({ modifiedCount: 0 });
        return (original as unknown as (...args: unknown[]) => unknown)(filter, update);
      }) as typeof original;
      try { assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "sending"); }
      finally { (SupportResponseOperation as unknown as { updateOne: typeof original }).updateOne = original; }
      assert.equal(providerCalls, 1); assert.equal(await responseCount(row._id), 0); assert.equal(await deliveryCount(row._id), 0);
      assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "sending"); assert.equal(providerCalls, 1);
    });

    await t.test("a pre-send transaction failure cannot duplicate external delivery", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000032";
      const target = SupportResponseOperation as unknown as { create: (...args: unknown[]) => unknown };
      const original = target.create; let attempts = 0;
      target.create = async (...args: unknown[]) => {
        attempts++;
        if (attempts === 1) {
          const error = new mongoose.mongo.MongoServerError({ message: "injected transient write conflict", code: 112 });
          error.addErrorLabel("TransientTransactionError");
          throw error;
        }
        return (original as unknown as (...callArgs: unknown[]) => unknown).apply(SupportResponseOperation, args);
      };
      try { assert.equal((await sendSupportResponse(token, operation(String(row._id), operationId))).state, "accepted"); }
      finally { target.create = original; }
      assert.equal(attempts, 2);
      assert.equal(providerCalls, 1); assert.equal(await responseCount(row._id), 1); assert.equal(await deliveryCount(row._id), 1);
    });

    await t.test("revocation during delivery blocks finalization and a stale MFA session cannot send", async () => {
      const token = await reset(); const row = await ticket(); const operationId = "10000000-0000-4000-8000-000000000008";
      const started = deferred<void>(); const finish = deferred<Response>(); provider = async () => { started.resolve(); return finish.promise; };
      const pending = sendSupportResponse(token, operation(String(row._id), operationId)); await bounded("provider start before revocation", started.promise);
      await revokeAdminSession(token); finish.resolve(new Response(JSON.stringify({ messageId: "revoked" }), { status: 201, headers: { "content-type": "application/json" } }));
      assert.equal((await pending).state, "uncertain"); assert.equal(providerCalls, 1); assert.equal(await responseCount(row._id), 0);
      await assert.rejects(sendSupportResponse(token, operation(String(row._id), operationId)), error => (error as { status?: number }).status === 401);
      const freshToken = await reset(); const freshTicket = await ticket();
      await assert.rejects(sendSupportResponse(await sign(301), operation(String(freshTicket._id), "10000000-0000-4000-8000-000000000009")), error => (error as { status?: number }).status === 403);
      assert.equal(providerCalls, 0); assert.ok(freshToken);
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of savedEnvironment) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await mongoose.disconnect();
    await replica.stop();
  }
});
