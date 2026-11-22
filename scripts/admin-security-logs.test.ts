import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSecurityQuery, projectSecurity, summarizeSecurity } from "@/lib/admin/security";

const now = new Date("2026-11-22T12:00:00Z");

test("restricts date windows, raw search and duplicate filters", () => {
  assert.equal(parseSecurityQuery({}, now).period, "24h");
  assert.throws(() => parseSecurityQuery({ q: "student@example.invalid" }, now));
  assert.throws(() => parseSecurityQuery({ actor: ["learner", "admin"] }, now));
  assert.throws(() => parseSecurityQuery({ from: "2026-01-01", to: "2026-11-22" }, now));
});

test("retains representative history separately and strips arbitrary fields", () => {
  const raw = { _id: "login-denied/1200", kind: "login-denied", actorId: "admin:primary",
    occurredAt: new Date(+now - 60_000), reason: "private", metadata: { password: "secret" } };
  const row = projectSecurity(raw, "event");
  assert.ok(row);
  assert.equal(row.actor, "unknown");
  assert.equal(row.count, null);
  assert.doesNotMatch(JSON.stringify(row), /private|secret/);
  const summary = summarizeSecurity(parseSecurityQuery({}, now), [], [row], false);
  assert.equal(summary.failedLogins, null);
  assert.equal(summary.legacy, 1);
});

import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Types } from "mongoose";
import { persistSecurityEvidence, securityDatabase, securityEvidence } from "@/lib/auth/security-evidence";
import { readSecurity } from "@/lib/admin/security";
import { securityCorrelationIndex, securityTimelineIndex } from "@/lib/admin/security-contract";

test("stores verified observations, merges counts, and paginates only projected evidence", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri("phase8_test_fixture");
  process.env.AUTH_SECRET = "isolated test fixture key with at least 32 characters";
  const db = securityDatabase();
  try {
    const audits = db.collection("adminauditlogs");
    const events = db.collection<{ _id: string; count?: number; kind: string; occurredAt: Date }>("adminsecurityevents");
    await Promise.all([audits.createIndex({ occurredAt: -1, _id: -1 }, { name: securityTimelineIndex }),
      events.createIndex({ occurredAt: -1, _id: -1 }, { name: securityTimelineIndex })]);
    await audits.createIndex({ correlationId: 1 }, { name: securityCorrelationIndex });
    await events.createIndex({ occurredAt: 1 }, { expireAfterSeconds: 90 * 86400 });
    const reference = new Date();
    const at = new Date(Math.floor(+reference / 300_000) * 300_000 - 10 * 60_000);
    const atNext = new Date(+at + 300_000);
    const learner = new Types.ObjectId().toHexString();
    const failure = securityEvidence({ kind: "learner-login-denied" }, at)!;
    const adminFailure = securityEvidence({ kind: "login-denied" }, atNext)!;
    const limited = securityEvidence({ kind: "rate-limited", scope: "login" }, at)!;
    const mfa = securityEvidence({ kind: "mfa-denied" }, at)!;
    const reset = securityEvidence({ kind: "password-reset", learnerId: learner, operation: "private-reset-grant-id" }, at)!;
    const success = securityEvidence({ kind: "learner-login", learnerId: learner }, at)!;
    await Promise.all([
      persistSecurityEvidence([...Array(12).fill(failure), ...Array(6).fill(mfa), ...Array(19).fill(limited), reset, success]),
      persistSecurityEvidence([...Array(11).fill(adminFailure), ...Array(9).fill(limited), reset]),
    ]);
    assert.equal((await events.findOne({ _id: limited._id }))?.count, 28);
    assert.equal(await events.countDocuments({ _id: reset._id }), 1);
    assert.doesNotMatch(JSON.stringify(await events.findOne({ _id: reset._id })), /private-reset-grant-id/);

    const correlation = "75898854-200e-417f-9005-62f8c0000011";
    await audits.insertMany(Array.from({ length: 24 }, (_, index) => ({
      occurredAt: at, action: index === 0 ? "login" : "user.suspend", actorId: "admin:primary", targetId: learner,
      outcome: "committed", reason: "sensitive fixture reason", correlationId: index === 0 ? correlation : undefined,
    })));
    await events.insertOne({ _id: correlation, kind: "login", occurredAt: at });
    const legacyTime = Math.floor(+at / 60000);
    await events.insertOne({ _id: `login-denied/${legacyTime}`, kind: "login-denied", occurredAt: at });
    await events.insertOne({ _id: "recovery-denied/1", kind: "recovery-denied", occurredAt: new Date(+reference - 100 * 86_400_000) });

    const read = (params: Record<string, string> = {}, now = reference) => readSecurity(parseSecurityQuery(params, now));
    const report = await read();
    assert.equal(report.summary.failedLogins, 23);
    assert.equal(report.summary.rateLimited, 28);
    assert.equal(report.summary.actions, 23);
    assert.equal(report.summary.alertCount, 3);
    assert.equal(report.summary.legacy, 1);
    assert.equal(report.summary.chart.reduce((total, bin) => total + bin.success, 0), 2);
    assert.equal(report.rows.length, 20);
    assert.ok(report.next);
    const older = await read({ cursor: report.next });
    assert.equal(new Set([...report.rows, ...older.rows].map(row => row.id)).size, 31);
    assert.equal(older.next, null);
    assert.equal(older.query.token, report.next);
    await assert.rejects(read({ cursor: report.next, actor: "admin" }), /expired or belongs/i);
    await assert.rejects(read({ cursor: report.next }, new Date(+reference + 31 * 60_000)), /expired/i);
    const byCorrelation = await read({ q: correlation });
    assert.equal(byCorrelation.rows.length, 1);
    assert.equal(byCorrelation.rows[0].kind, "login");
    const rejected = await read({ outcome: "failure", actor: "unknown" });
    assert.equal(rejected.rows.length, 3);
    const rateOnly = await read({ category: "rate" });
    assert.equal(rateOnly.rows.length, 1);
    assert.equal(rateOnly.rows[0].scope, "login");
    const isoDay = (date: Date) => date.toISOString().slice(0, 10);
    const oldDay = isoDay(new Date(+reference - 100 * 86_400_000));
    assert.equal((await read({ from: oldDay, to: oldDay })).rows.length, 0);
    assert.doesNotMatch(JSON.stringify([report, older, byCorrelation]), /sensitive fixture reason|private-reset-grant-id/);
    const explain = await events.find({ occurredAt: { $gte: at, $lt: reference } }, { hint: securityTimelineIndex, collation: { locale: "simple" } })
      .sort({ occurredAt: -1, _id: -1 }).limit(21).explain("queryPlanner");
    assert.match(JSON.stringify(explain.queryPlanner.winningPlan), /security_timeline/);
    await events.dropIndex(securityTimelineIndex);
    const partial = await read();
    assert.equal(partial.eventsAvailable, false);
    assert.equal(partial.auditAvailable, true);
    assert.equal(partial.explorerPartial, true);
    assert.equal(partial.summary.failedLogins, null);
  } finally {
    await db.client.close();
    await mongo.stop();
    delete process.env.MONGODB_URI;
    delete process.env.AUTH_SECRET;
  }
});
