import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SignJWT } from "jose";

const passwordHash = "$2b$12$HUdxSbGT.hyi71fJSD2hr.uO9XngNUp.lzcO4cJUDKgl/Zzw8KCVu";
const testEnvironmentKeys = ["MONGODB_URI", "AUTH_SECRET", "AUTH_OTP_SECRET", "ADMIN_MFA_KEY_ID", "ADMIN_MFA_KEYS", "SUPPORT_TICKET_ENCRYPTION_KEY", "SUPPORT_TICKET_ENCRYPTION_KEY_ID", "SUPPORT_INBOX_EMAIL", "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "APP_BASE_URL", "EMAIL_ASSET_BASE_URL"] as const;
async function bounded<T>(stage: string, operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<T>((_, reject) => { timeout = setTimeout(() => reject(new Error(`Timed out while ${stage}.`)), 10_000); })]); }
  finally { if (timeout) clearTimeout(timeout); }
}

test("isolated support harness uses the application connection lifecycle", { timeout: 45_000 }, async () => {
  const originalEnvironment = new Map(testEnvironmentKeys.map(key => [key, process.env[key]]));
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); const originalFetch = globalThis.fetch;
  const secret = randomBytes(32).toString("hex"); const uri = replica.getUri("support_harness_test"); let calls = 0;
  process.env.MONGODB_URI = uri; process.env.AUTH_SECRET = secret; process.env.AUTH_OTP_SECRET = randomBytes(32).toString("hex"); process.env.ADMIN_MFA_KEY_ID = "harness"; process.env.ADMIN_MFA_KEYS = JSON.stringify({ harness: randomBytes(32).toString("base64") }); process.env.SUPPORT_TICKET_ENCRYPTION_KEY = randomBytes(32).toString("base64"); process.env.SUPPORT_TICKET_ENCRYPTION_KEY_ID = "harness"; process.env.SUPPORT_INBOX_EMAIL = "support@example.invalid"; process.env.BREVO_API_KEY = "harness-key"; process.env.BREVO_SENDER_EMAIL = "sender@example.invalid"; process.env.APP_BASE_URL = "https://app.example.invalid"; process.env.EMAIL_ASSET_BASE_URL = "https://assets.example.invalid";
  const [{ connectToDatabase }, { withRequiredTransaction }, { ADMIN_ID, ADMIN_SUBJECT, Admin }, { AdminAuditLog, AdminSecurityEvent }, { SupportResponseOperation, SupportTicket, SupportTicketActivity }, { createSupportTicket }, { prepareEnrollment, digest }, { validateAdminSession }, { sendSupportResponse }, { SESSION_ISSUER }] = await Promise.all([
    import("@/lib/mongodb"), import("@/lib/mongodb-transaction"), import("@/models/Admin"), import("@/models/AdminAuditLog"), import("@/models/SupportTicket"), import("@/lib/support/tickets"), import("@/lib/auth/admin-factor-crypto"), import("@/lib/auth/admin-session-state"), import("@/lib/admin/support"), import("@/lib/auth/constants"),
  ]);
  globalThis.fetch = async url => { assert.equal(String(url), "https://api.brevo.com/v3/smtp/email"); calls++; return new Response(JSON.stringify({ messageId: "harness-provider-id" }), { status: 201, headers: { "content-type": "application/json" } }); };
  try {
    const first = await bounded("opening the isolated replica set", connectToDatabase()); const second = await bounded("reusing the application connection", connectToDatabase()); assert.equal(first, second); assert.equal(first.connection.db?.databaseName, "support_harness_test"); assert.notEqual(first.connection.host, "localhost");
    await Promise.all([AdminAuditLog.createCollection(), AdminSecurityEvent.createCollection(), SupportTicket.createCollection(), SupportTicketActivity.createCollection(), SupportResponseOperation.createCollection()]); await SupportResponseOperation.collection.createIndex({ ticketId: 1, operationId: 1 }, { unique: true, name: "support_response_operation_unique" });
    const records = mongoose.connection.db!.collection("support_harness_records"); await bounded("committing a test transaction", withRequiredTransaction(async session => { await records.insertOne({ _id: new mongoose.Types.ObjectId("000000000000000000000001") }, { session }); })); await assert.rejects(withRequiredTransaction(async session => { await records.insertOne({ _id: new mongoose.Types.ObjectId("000000000000000000000002") }, { session }); throw new Error("intentional rollback"); })); assert.equal(await records.countDocuments(), 1);
    const { encryptedSeed } = prepareEnrollment(ADMIN_SUBJECT); const authenticatedAt = new Date(); const issuedAt = Math.floor(authenticatedAt.getTime() / 1000); const sessionId = randomBytes(24).toString("base64url"); const environment = process.env.NODE_ENV === "production" ? "production" : "development"; await Admin.create({ _id: ADMIN_ID, name: "Harness Admin", email: "harness-admin@example.invalid", passwordHash, status: "active", sessionVersion: 0, activeSession: { sessionId, version: 0, authenticatedAt, absoluteExpiresAt: new Date((issuedAt + 28_800) * 1000), lastActivityAt: authenticatedAt, environment }, mfa: { encryptedSeed, lastStep: Math.floor(Date.now() / 30_000) - 2 }, recoveryCodes: Array.from({ length: 8 }, (_, index) => digest(String(index))) });
    const token = await new SignJWT({ sv: 0, sid: sessionId, env: environment, amr: ["pwd", "otp"] }).setProtectedHeader({ alg: "HS256", typ: "abii-admin+jwt" }).setAudience("abii-admin").setIssuer(SESSION_ISSUER).setSubject(ADMIN_SUBJECT).setIssuedAt(issuedAt).setExpirationTime(issuedAt + 28_800).sign(new TextEncoder().encode(secret)); assert.equal((await bounded("validating the synthetic administrator", validateAdminSession(token, true))).adminId, ADMIN_SUBJECT);
    const ticket = await createSupportTicket({ submissionKey: "a".repeat(64), payloadHash: "b".repeat(64), name: "Customer", email: "customer@example.invalid", category: "Other", message: "A persistent request." }); await SupportTicket.updateOne({ _id: ticket._id }, { $set: { status: "open" } });
    const result = await bounded("sending a mocked support response", sendSupportResponse(token, { id: String(ticket._id), operationId: "22222222-2222-4222-8222-222222222222", message: "A secure mocked response." })); assert.equal(result.state, "accepted"); assert.equal(calls, 1); assert.equal(await SupportResponseOperation.countDocuments({ ticketId: ticket._id, state: "accepted" }), 1); assert.equal(await SupportTicketActivity.countDocuments({ ticketId: ticket._id, kind: "admin_response" }), 1);
  } finally { globalThis.fetch = originalFetch; for (const [key, value] of originalEnvironment) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } await mongoose.disconnect(); await replica.stop(); }
});
