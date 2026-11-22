import "server-only";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import mongoose from "mongoose";
import { emptyDatabase, emptyRequests, mergeLatency, recordLatency, requestOutcome, minute, retentionMs, type DatabaseMetrics, type QuizRoute, type ReminderRun, type RequestMetrics } from "./monitoring";

export const metricCollection = "performance_metrics_v1";
export const reminderCollection = "performance_reminder_runs_v1";
export const expiryIndex = "performance_expiry";
export const metricTimeIndex = "performance_bucket";
export const reminderTimeIndex = "performance_started";
export type MetricRow = { bucket: Date; route: QuizRoute; requests: RequestMetrics; database: DatabaseMetrics };
export type MetricBatch = { _id: string; bucket: Date; expiresAt: Date; rows: MetricRow[] };
type Observation = { route: QuizRoute; status: number | null; ms: number; at: number; database: DatabaseMetrics };

export function telemetryEnabled() {
  return process.env.ABII_PERF_COLLECTION === "1";
}

let client: InstanceType<typeof mongoose.mongo.MongoClient> | undefined;
export function telemetryDatabase() {
  const uri = process.env.ABII_PERF_MONGODB_URI;
  if (!uri) throw new Error("Monitoring storage is not configured");
  client ??= new mongoose.mongo.MongoClient(uri, {
    timeoutMS: 1500, serverSelectionTimeoutMS: 1000, connectTimeoutMS: 1000,
    maxPoolSize: 2, maxConnecting: 1, retryWrites: true, writeConcern: { w: "majority" },
  });
  return client.db();
}

type IndexCheck = { until: number; ready: Promise<void> };
const checks = new Map<string, IndexCheck>();
export function requireTelemetryIndexes(collection: string, timeIndex: string, timeField: string) {
  const cached = checks.get(collection);
  if (cached && cached.until > Date.now()) return cached.ready;
  const ready = Promise.resolve().then(async () => {
    const indexes = await telemetryDatabase().collection(collection).listIndexes().toArray();
    const time = indexes.find(index => index.name === timeIndex);
    const ttl = indexes.find(index => index.name === expiryIndex);
    if (time?.key[timeField] !== -1 || Object.keys(time.key).length !== 1 || time.partialFilterExpression || time.sparse ||
        ttl?.key.expiresAt !== 1 || Object.keys(ttl.key).length !== 1 || ttl.expireAfterSeconds !== 0 || ttl.partialFilterExpression) {
      throw new Error("Monitoring indexes have not been provisioned");
    }
  }).catch((error: unknown) => {
    checks.set(collection, { until: Date.now() + 30_000, ready });
    throw error;
  });
  checks.set(collection, { until: Date.now() + 300_000, ready });
  return ready;
}

let lastDiagnostic = 0;
export function telemetryDrop() {
  if (Date.now() - lastDiagnostic < minute) return;
  lastDiagnostic = Date.now();
  try { console.warn("abii.performance.delivery_incomplete"); } catch { /* Logging is optional. */ }
}

export function buildMetricBatches(observations: Observation[]): MetricBatch[] {
  const buckets = new Map<number, Map<QuizRoute, MetricRow>>();
  for (const observation of observations) {
    const time = Math.floor(observation.at / minute) * minute;
    let rows = buckets.get(time);
    if (!rows) buckets.set(time, rows = new Map());
    let row = rows.get(observation.route);
    if (!row) {
      row = { bucket: new Date(time), route: observation.route, requests: emptyRequests(), database: emptyDatabase() };
      rows.set(observation.route, row);
    }
    const { requests, database } = row;
    const outcome = requestOutcome(observation.status);
    requests.clientErrors += Number(outcome === "clientError");
    requests.serverErrors += Number(outcome === "serverError");
    requests.thrown += Number(observation.status === null);
    requests.lastAt = Math.max(requests.lastAt, observation.at);
    recordLatency(requests.latency, observation.ms);
    mergeLatency(database.queries, observation.database.queries);
    mergeLatency(database.writes, observation.database.writes);
    mergeLatency(database.connections, observation.database.connections);
  }
  return [...buckets].map(([time, rows]) => ({
    _id: randomUUID(), bucket: new Date(time), expiresAt: new Date(time + retentionMs), rows: [...rows.values()],
  }));
}

const batchCapacity = 64;
type PendingBatch = { observations: Observation[]; flushed: Promise<void> };
let openBatch: PendingBatch | undefined;
let activeFlushes = 0;

export function enqueueObservation(observation: Observation): Promise<void> | undefined {
  if (openBatch && openBatch.observations.length < batchCapacity) {
    openBatch.observations.push(observation);
    return openBatch.flushed;
  }
  if (activeFlushes >= 2) {
    telemetryDrop();
    return;
  }
  const observations = [observation];
  activeFlushes++;
  const flushed = delay(125).then(async () => {
    if (openBatch?.observations === observations) openBatch = undefined;
    await requireTelemetryIndexes(metricCollection, metricTimeIndex, "bucket");
    const batches = buildMetricBatches(observations);
    await telemetryDatabase().collection<MetricBatch>(metricCollection).insertMany(batches, { ordered: false });
  }).catch(telemetryDrop).finally(() => { activeFlushes--; });
  openBatch = { observations, flushed };
  return flushed;
}

let pendingJobWrites = 0;
export async function writeReminderRun(run: ReminderRun) {
  if (pendingJobWrites >= 4) return telemetryDrop();
  pendingJobWrites++;
  try {
    await requireTelemetryIndexes(reminderCollection, reminderTimeIndex, "startedAt");
    const { _id, finishedAt, completion, ...started } = run;
    await telemetryDatabase().collection<ReminderRun>(reminderCollection).updateOne({ _id }, {
      $setOnInsert: started,
      ...(completion ? { $set: { finishedAt, completion } } : {}),
    }, { upsert: true });
  } catch {
    telemetryDrop();
  } finally {
    pendingJobWrites--;
  }
}
