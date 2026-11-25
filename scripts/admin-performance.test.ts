import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { recordLatency, emptyLatency, mergeLatency, percentiles, requestOutcome, monitoringWindow } from "@/lib/performance/monitoring";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { readPerformance, summarizePerformance } from "@/lib/admin/performance";
import { emptyDatabase, reminderCompletion, minute, retentionMs, type ReminderRun } from "@/lib/performance/monitoring";
import { buildMetricBatches, enqueueObservation, expiryIndex, metricCollection, metricTimeIndex,
  reminderCollection, reminderTimeIndex, telemetryDatabase, writeReminderRun, type MetricBatch } from "@/lib/performance/storage";
import { withApiPerformanceTrace } from "@/lib/performance/server-timing";
import { withReminderPerformance } from "@/lib/performance/reminder-timing";

test("merges distributions and qualifies thin tails", () => {
  const fast = emptyLatency();
  const slow = emptyLatency();
  for (let index = 0; index < 95; index++) recordLatency(fast, 21);
  for (let index = 0; index < 5; index++) recordLatency(slow, 490);
  assert.equal(percentiles(fast).p99, null);
  mergeLatency(fast, slow);
  assert.deepEqual(percentiles(fast), { p50: 25, p95: 25, p99: 500 });
});

test("distinguishes client failures, server responses and thrown failures", () => {
  assert.deepEqual([200, 400, 404, 500, 503, null].map(requestOutcome),
    ["success", "clientError", "clientError", "serverError", "serverError", "serverError"]);
});

test("reports exact effective bounds and excludes the leading partial minute", () => {
  const window = monitoringWindow("1h", new Date("2026-11-22T12:34:45Z"));
  assert.equal(window.start.toISOString(), "2026-11-22T11:35:00.000Z");
  assert.equal(window.end.toISOString(), "2026-11-22T12:34:45.000Z");
});

const now = new Date("2026-11-22T12:34:45Z");
const summary = { examined: 12, created: 1, existing: 9, suppressed: 2, errors: 0, hasMore: false, busy: false, batches: 1 };

test("scheduler diagnoses observed overdue starts and keeps missing slots distinct from failed executions", () => {
  const scheduledAt = new Date(+now - 25 * minute);
  const run: ReminderRun = { _id: "execution", source: "scheduled", scheduledAt, startedAt: scheduledAt, expiresAt: new Date(+now + retentionMs) };
  const report = summarizePerformance(monitoringWindow("24h", now), { coverage: "empty", rows: [] }, { coverage: "observed", rows: [run] });
  assert.equal(report.jobs[0].state, "overdue");
  assert.equal(report.incidents[0].severity, "Warning");
  assert.equal(report.availability.status, "unavailable");
  for (const [result, outcome] of [
    [summary, "completed"], [{ ...summary, busy: true, hasMore: true }, "lease_busy"],
    [{ ...summary, errors: 1, hasMore: true }, "partial"], [{ ...summary, hasMore: true }, "partial_batch"],
  ] as const) assert.equal(reminderCompletion(result).outcome, outcome);
  const recovered = summarizePerformance(monitoringWindow("24h", now), { coverage: "empty", rows: [] },
    { coverage: "observed", rows: [{ ...run, _id: "retry", completion: reminderCompletion(summary), finishedAt: new Date(+now - minute) }, run] });
  assert.equal(recovered.incidents.length, 0);
  assert.equal(recovered.completedDue, 1);
});

test("wrapper returns the original response and rethrows the original exception when lifecycle registration is unavailable", async () => {
  process.env.ABII_PERF_COLLECTION = "1";
  try {
    const request = new Request("https://fixture.invalid/");
    const response = Response.json({ answer: "original" }, { status: 500 });
    assert.equal(await withApiPerformanceTrace(request, "quiz.answer", async () => response), response);
    const error = new Error("fixture primary failure");
    await assert.rejects(withApiPerformanceTrace(request, "quiz.finish", async () => { throw error; }), value => value === error);
    assert.equal(await withReminderPerformance({ kind: "private" }, async () => summary), summary);
    await assert.rejects(withReminderPerformance({ kind: "private" }, async () => { throw error; }), value => value === error);
  } finally {
    delete process.env.ABII_PERF_COLLECTION;
  }
});

test("indexed storage merges independent writes, protects duplicate IDs, bounds buffering, and expires old fragments", async () => {
  const mongo = await MongoMemoryServer.create({ instance: { args: ["--setParameter", "ttlMonitorSleepSecs=1"] } });
  const client = new mongoose.mongo.MongoClient(mongo.getUri("phase_seven_fixture"));
  process.env.ABII_PERF_MONGODB_URI = mongo.getUri("phase_seven_fixture");
  process.env.ABII_PERF_COLLECTION = "1";
  try {
    const db = client.db();
    const metrics = db.collection<MetricBatch>(metricCollection);
    const jobs = db.collection<ReminderRun>(reminderCollection);
    await metrics.createIndex({ bucket: -1 }, { name: metricTimeIndex });
    await jobs.createIndex({ startedAt: -1 }, { name: reminderTimeIndex });
    for (const collection of [metrics, jobs]) await collection.createIndex({ expiresAt: 1 }, { name: expiryIndex, expireAfterSeconds: 0 });
    const at = Date.now() - 15_000;
    const database = emptyDatabase();
    recordLatency(database.queries, 21);
    recordLatency(database.writes, 31);
    recordLatency(database.connections, 11);
    const observations = ([200, 400, 500, null] as const).map(status => ({ route: "quiz.answer" as const, status, at, ms: 25, database }));
    const workerA = buildMetricBatches(observations.slice(0, 2));
    const workerB = buildMetricBatches(observations.slice(2));
    await Promise.all([metrics.insertMany(workerA), metrics.insertMany(workerB)]);
    await assert.rejects(metrics.insertMany(workerA), { code: 11000 });
    await metrics.insertOne({ ...workerA[0], _id: "expired", expiresAt: new Date(0) });
    const run = { _id: "fixture-job", source: "private" as const, startedAt: new Date(at), expiresAt: new Date(at + retentionMs) };
    await writeReminderRun(run);
    const terminal = { ...run, finishedAt: new Date(at + 300), completion: reminderCompletion(summary) };
    await writeReminderRun(terminal);
    await writeReminderRun(run);
    const report = await readPerformance("1h", new Date());
    assert.equal(report.totals.latency.count, 4);
    assert.equal(report.totals.clientErrors, 1);
    assert.equal(report.totals.serverErrors, 2);
    assert.equal(report.totals.thrown, 1);
    assert.equal(report.database.queries.count, 4);
    assert.equal(report.database.writes.count, 4);
    assert.equal(report.database.connections.count, 4);
    const operationInterval = report.chart.find(point => point.queries.count > 0);
    assert.equal(operationInterval?.queries.count, 4);
    assert.equal(operationInterval?.writes.count, 4);
    assert.equal(operationInterval?.connections.count, 4);
    assert.equal(report.jobCount, 1);
    assert.equal(report.jobs[0].state, "completed");
    for (const [collection, key, name] of [[metrics, "bucket", metricTimeIndex], [jobs, "startedAt", reminderTimeIndex]] as const) {
      const plan = await collection.find({ [key]: { $gte: new Date(at - minute), $lt: new Date() }, expiresAt: { $gt: new Date() } }, { hint: name })
        .sort({ [key]: -1 }).limit(20).explain("queryPlanner");
      assert.match(JSON.stringify(plan.queryPlanner.winningPlan), new RegExp(name));
      assert.doesNotMatch(JSON.stringify(plan.queryPlanner.winningPlan), /COLLSCAN/);
    }
    const writes = Array.from({ length: 140 }, () => enqueueObservation(observations[0]));
    assert.equal(writes.filter(Boolean).length, 128);
    await Promise.all(writes);
    assert.equal((await readPerformance("1h", new Date())).totals.latency.count, 132);
    const interrupted = spawnSync(process.execPath, ["--conditions=react-server", "--import",
      "./scripts/register-typescript.mjs", "--input-type=module", "-e", `
        import { enqueueObservation } from "./lib/performance/storage.ts";
        import { emptyDatabase } from "./lib/performance/monitoring.ts";
        enqueueObservation({ route: "quiz.answer", status: 200, ms: 50, at: Date.now(), database: emptyDatabase() });
        process.exit(0);
      `], { timeout: 10_000 });
    assert.equal(interrupted.status, 0, interrupted.stderr.toString());
    assert.equal((await readPerformance("1h", new Date())).totals.latency.count, 132);

    for (let attempt = 0; attempt < 35 && await metrics.findOne({ _id: "expired" }); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(await metrics.findOne({ _id: "expired" }), null);
    await mongo.stop();
    const failed = await readPerformance("1h", new Date());
    assert.equal(failed.apiCoverage, "read-failed");
    assert.equal(failed.jobCoverage, "read-failed");
    await enqueueObservation(observations[0]);
  } finally {
    delete process.env.ABII_PERF_COLLECTION;
    await telemetryDatabase().client.close();
    delete process.env.ABII_PERF_MONGODB_URI;
    await client.close();
    await mongo.stop();
  }
});

test("incident grouping is stable across chart resolutions and excludes open intervals", () => {
  const anchor = Math.floor(+now / (5 * minute)) * 5 * minute;
  const database = emptyDatabase();
  const rows = buildMetricBatches([0, 5, 10, 15].flatMap(
    minutesAgo => Array.from({ length: 30 }, (_, index) => ({
      route: "quiz.finish", at: anchor - minutesAgo * minute + 1000, database, ms: 40, status: index < 3 ? 500 : 200,
    })),
  )).flatMap(batch => batch.rows);
  const collect = (period: string) => summarizePerformance(monitoringWindow(period, new Date(anchor + minute)),
    { coverage: "observed", rows }, { coverage: "empty", rows: [] }).incidents;
  assert.deepEqual(collect("1h"), collect("7d"));
  assert.equal(collect("1h").length, 1);
  assert.equal(collect("1h")[0].last, anchor);
  assert.match(collect("1h")[0].evidence, /3 server errors in 30 requests/);
});
