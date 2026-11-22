import "server-only";
import {
  emptyDatabase, emptyLatency, emptyRequests, latencyBounds, mergeLatency, mergeRequests, minute, monitoringWindow, percentiles, routeLabels,
  type Availability, type DatabaseMetrics, type HealthState, type MonitoringWindow, type QuizRoute, type ReminderRun,
} from "@/lib/performance/monitoring";
import {
  metricCollection, metricTimeIndex, reminderCollection, reminderTimeIndex, requireTelemetryIndexes, telemetryDatabase, telemetryEnabled,
  type MetricBatch, type MetricRow,
} from "@/lib/performance/storage";

const requestLimit = 12_000;
const jobLimit = 1200;
const cadence = 15 * minute;
const grace = 20 * minute;
const freshness = 30 * minute;
const slowMs = 1000;
const errorThreshold = 0.05;

type Coverage = "observed" | "empty" | "disabled" | "read-failed" | "limited";
type Source<T> = { coverage: Coverage; rows: T[] };
type Health = { component: string; state: HealthState; at: number | null; reason: string };
type Incident = { type: string; component: string; severity: "Warning" | "High"; first: number; last: number; evidence: string };
type Job = { run: ReminderRun; state: "started" | "overdue" | NonNullable<ReminderRun["completion"]>["outcome"] };

function windowQuery(window: MonitoringWindow) {
  return { $gte: window.start, $lt: window.end };
}

async function readMetricRows(window: MonitoringWindow): Promise<Source<MetricRow>> {
  await requireTelemetryIndexes(metricCollection, metricTimeIndex, "bucket");
  const batches = await telemetryDatabase().collection<MetricBatch>(metricCollection)
    .find({ bucket: windowQuery(window), expiresAt: { $gt: window.end } }, { hint: metricTimeIndex })
    .sort({ bucket: -1 }).limit(requestLimit + 1).toArray();
  // The oldest minute may contain more fragments than the read cap included.
  const limited = batches.length > requestLimit;
  const cutoff = limited ? +batches[requestLimit].bucket : -1;
  const rows = batches.filter(batch => +batch.bucket > cutoff).flatMap(batch => batch.rows).filter(row => row.requests.lastAt < +window.end);
  return { coverage: limited ? "limited" : rows.length ? "observed" : "empty", rows };
}

async function readJobs(window: MonitoringWindow): Promise<Source<ReminderRun>> {
  await requireTelemetryIndexes(reminderCollection, reminderTimeIndex, "startedAt");
  const jobs = await telemetryDatabase().collection<ReminderRun>(reminderCollection)
    .find({ startedAt: windowQuery(window), expiresAt: { $gt: window.end } }, { hint: reminderTimeIndex })
    .sort({ startedAt: -1 }).limit(jobLimit + 1).toArray();
  const rows = jobs.slice(0, jobLimit).map(run => run.finishedAt && run.finishedAt >= window.end ?
    { ...run, finishedAt: undefined, completion: undefined } : run);
  return { coverage: jobs.length > jobLimit ? "limited" : jobs.length ? "observed" : "empty", rows };
}

function capturedSource<T>(result: PromiseSettledResult<Source<T>>): Source<T> {
  return result.status === "fulfilled" ? result.value : { coverage: "read-failed", rows: [] };
}

function mergeOperations(target: DatabaseMetrics, source: DatabaseMetrics) {
  mergeLatency(target.queries, source.queries);
  mergeLatency(target.writes, source.writes);
  mergeLatency(target.connections, source.connections);
}

function jobStatus(run: ReminderRun, now: number, completedSlots: Set<number>): Job["state"] {
  if (run.completion) return run.completion.outcome;
  if (run.scheduledAt && now >= +run.scheduledAt + grace && !completedSlots.has(Math.floor(+run.scheduledAt / cadence))) return "overdue";
  return "started";
}

export function summarizePerformance(window: MonitoringWindow, apiSource: Source<MetricRow>, jobSource: Source<ReminderRun>) {
  const end = +window.end;
  const totals = emptyRequests();
  const recent = emptyRequests();
  const database = emptyDatabase();
  const endpoints = new Map<QuizRoute, ReturnType<typeof emptyRequests>>();
  const chart = Array.from({ length: Math.ceil((end - +window.start) / window.resolution) }, (_, index) => ({
    start: +window.start + index * window.resolution,
    end: Math.min(end, +window.start + (index + 1) * window.resolution),
    requests: emptyRequests(), operations: emptyLatency(),
  }));
  const incidentResolution = 5 * minute;
  const incidentBuckets = new Map<number, ReturnType<typeof emptyRequests>>();
  let first = Infinity;
  let databaseAt = 0;
  for (const row of apiSource.rows) {
    if (!endpoints.has(row.route)) endpoints.set(row.route, emptyRequests());
    mergeRequests(endpoints.get(row.route)!, row.requests);
    mergeRequests(totals, row.requests);
    mergeOperations(database, row.database);
    if (row.database.queries.count || row.database.writes.count) databaseAt = Math.max(databaseAt, row.requests.lastAt);
    first = Math.min(first, +row.bucket);
    if (+row.bucket >= end - freshness) mergeRequests(recent, row.requests);
    const incidentStart = Math.floor(+row.bucket / incidentResolution) * incidentResolution;
    if (incidentStart >= +window.start && incidentStart + incidentResolution <= end) {
      if (!incidentBuckets.has(incidentStart)) incidentBuckets.set(incidentStart, emptyRequests());
      mergeRequests(incidentBuckets.get(incidentStart)!, row.requests);
    }
    const point = chart[Math.floor((+row.bucket - +window.start) / window.resolution)];
    if (point) {
      mergeRequests(point.requests, row.requests);
      mergeLatency(point.operations, row.database.queries);
      mergeLatency(point.operations, row.database.writes);
    }
  }

  const completedSlots = new Set(jobSource.rows.filter(run => run.scheduledAt && run.completion?.outcome === "completed")
    .map(run => Math.floor(+run.scheduledAt! / cadence)));
  const jobs = jobSource.rows.map(run => ({ run, state: jobStatus(run, end, completedSlots) }));
  const scheduled = jobs.filter(job => job.run.scheduledAt);
  const inWindowSlots = scheduled.filter(job => +job.run.scheduledAt! >= +window.start && +job.run.scheduledAt! < end);
  const dispatchSlots = new Set(inWindowSlots.map(job => Math.floor(+job.run.scheduledAt! / cadence)));
  const firstObservedSlot = Math.min(...dispatchSlots);
  const lastDueSlot = Math.floor((end - grace) / cadence);
  const hasScheduleBaseline = Number.isFinite(firstObservedSlot) && jobSource.coverage !== "limited";
  const expected = hasScheduleBaseline ? Math.max(0, lastDueSlot - firstObservedSlot + 1) : null;
  const dueSlots = [...dispatchSlots].filter(slot => slot <= lastDueSlot);
  const missing = expected === null ? null : Math.max(0, expected - dueSlots.length);
  const incidents: Incident[] = [];

  const incidentSeries = [...incidentBuckets].sort(([a], [b]) => a - b);
  const exceedsLatency = (latency: ReturnType<typeof emptyLatency>) => {
    const withinThreshold = latency.bins.slice(0, latencyBounds.indexOf(slowMs) + 1).reduce((sum, count) => sum + count, 0);
    return withinThreshold < Math.ceil(latency.count * 0.95);
  };
  for (const [type, qualifies, evidence] of [
    ["Elevated server errors", (metrics: typeof totals) => metrics.serverErrors / metrics.latency.count >= errorThreshold,
      (metrics: typeof totals) => `${metrics.serverErrors} server errors in ${metrics.latency.count} requests in the latest affected interval`],
    ["Sustained API latency", (metrics: typeof totals) => exceedsLatency(metrics.latency),
      (metrics: typeof totals) => `p95 above 1,000 ms across ${metrics.latency.count} requests in the latest affected interval`],
  ] as const) {
    let firstAffected: number | undefined;
    let previous: number | undefined;
    for (const [start, metrics] of incidentSeries) {
      if (metrics.latency.count < 20 || !qualifies(metrics)) {
        firstAffected = previous = undefined;
        continue;
      }
      if (previous === undefined || start - previous !== incidentResolution) firstAffected = start;
      previous = start;
      if (firstAffected === undefined || start === firstAffected) continue;
      const last = incidents.at(-1);
      if (last?.type === type && last.last === start) {
        last.last = start + incidentResolution;
        last.evidence = evidence(metrics);
      } else {
        incidents.push({ type, component: "Critical quiz APIs", severity: "Warning", first: firstAffected, last: start + incidentResolution, evidence: evidence(metrics) });
      }
    }
  }


  for (const state of ["failed", "overdue"] as const) {
    const groups = new Map<number, { count: number; first: number; last: number }>();
    for (const { run, state: current } of jobs) {
      if (current !== state) continue;
      const at = state === "overdue" ? +run.scheduledAt! + grace : +(run.finishedAt ?? run.startedAt);
      const slot = Math.floor(at / cadence);
      const group = groups.get(slot) ?? { count: 0, first: at, last: at };
      group.count++;
      group.first = Math.min(group.first, at);
      group.last = Math.max(group.last, at);
      groups.set(slot, group);
    }
    for (const { count, first, last } of groups.values()) {
      incidents.push({ type: state === "failed" ? "Reminder execution failed" : "Reminder completion overdue",
        component: "Reminder scheduler", severity: state === "failed" ? "High" : "Warning", first, last,
        evidence: state === "failed" ? `${count} recorded failed execution(s)` : `${count} observed start(s) without terminal evidence after ${grace / minute} minutes` });
    }
  }

  const availability: Availability = { status: "unavailable", reason: "Independent availability probes have not been configured." };
  const recentLatency = percentiles(recent.latency).p95;
  const recentBad = recent.serverErrors / recent.latency.count >= errorThreshold || exceedsLatency(recent.latency);
  const latestJobAt = jobs.reduce((latest, { run }) => Math.max(latest, +(run.finishedAt ?? run.startedAt)), 0);
  const latestScheduled = scheduled[0];
  const stalled = scheduled.some(job => job.state === "overdue" && end - +job.run.startedAt <= freshness);
  const scheduledAt = latestScheduled ? +(latestScheduled.run.finishedAt ?? latestScheduled.run.startedAt) : 0;
  const lastCollected = Math.max(totals.lastAt, latestJobAt);
  const apiState = apiSource.coverage === "read-failed" ? "Unavailable" : !totals.lastAt ? "Unknown" :
    end - totals.lastAt > freshness ? "Stale" : recent.latency.count < 20 || apiSource.coverage === "limited" ? "Unknown" :
      recentBad ? "Degraded" : recentLatency !== null ? "Healthy" : "Unknown";
  const status: Health[] = [
    { component: "Public application", state: "Unavailable", at: null, reason: availability.reason },
    { component: "Critical quiz APIs", state: apiState, at: totals.lastAt || null,
      reason: recent.latency.count >= 20 ? `${recent.latency.count} recorded requests in the last 30 minutes. Warning at 5% server errors or p95 above 1,000 ms.` : "At least 20 recent requests are needed to assess performance." },
    { component: "MongoDB", state: "Unknown", at: databaseAt || null, reason: "Selected operation timings are available when observed. No dedicated connectivity probe is configured." },
    { component: "Reminder scheduler", state: jobSource.coverage === "read-failed" ? "Unavailable" : !latestScheduled ? "Unknown" :
      end - scheduledAt > freshness ? "Stale" : (stalled || ["failed", "partial", "partial_batch", "overdue"].includes(latestScheduled.state)) ? "Degraded" :
        latestScheduled.state === "completed" && jobSource.coverage !== "limited" ? "Healthy" : "Unknown", at: scheduledAt || null,
      reason: stalled ? "A recent scheduled attempt has a recorded start and no terminal evidence after the grace period." : latestScheduled ? `Latest observed scheduled run is ${latestScheduled.state.replaceAll("_", " ")}. Missing slots can also reflect delivery loss.` : "No scheduled execution evidence in this window." },
    { component: "Telemetry collection", state: apiSource.coverage === "read-failed" || jobSource.coverage === "read-failed" ? "Unavailable" :
      apiSource.coverage === "limited" || jobSource.coverage === "limited" ? "Degraded" :
      !lastCollected ? "Unknown" : end - lastCollected > freshness ? "Stale" : "Unknown",
      at: lastCollected || null, reason: "Delivery is best effort. Persisted observations confirm collection activity. Drops cannot be counted reliably." },
  ];

  return {
    window, availability, totals, database, databaseAt, chart, status, lastCollected,
    first: Number.isFinite(first) ? first : null, apiCoverage: apiSource.coverage, jobCoverage: jobSource.coverage,
    endpoints: (Object.keys(routeLabels) as QuizRoute[]).map(route => ({ route, metrics: endpoints.get(route) ?? emptyRequests() }))
      .sort((a, b) => b.metrics.latency.count - a.metrics.latency.count || a.route.localeCompare(b.route)),
    jobs: jobs.slice(0, 10), jobCount: jobs.length, expected, missing,
    completedDue: dueSlots.filter(slot => completedSlots.has(slot)).length,
    incidents: incidents.sort((a, b) => b.last - a.last).slice(0, 8),
  };
}
export type PerformanceReport = ReturnType<typeof summarizePerformance>;

export async function readPerformance(period: unknown, now: Date) {
  const window = monitoringWindow(period, now);
  if (!process.env.ABII_PERF_MONGODB_URI && !telemetryEnabled()) return summarizePerformance(window, { coverage: "disabled", rows: [] }, { coverage: "disabled", rows: [] });
  const [api, jobs] = await Promise.allSettled([readMetricRows(window), readJobs(window)]);
  return summarizePerformance(window, capturedSource(api), capturedSource(jobs));
}
