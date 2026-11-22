export const routeLabels = {
  "quiz.start": "Start quiz",
  "quiz.answer": "Submit answer",
  "quiz.finish": "Finish quiz",
  "quiz.resume": "Resume quiz",
  "quiz.session.load": "Load quiz session",
  "quiz.discard": "Discard quiz",
} as const;

export type QuizRoute = keyof typeof routeLabels;
export function isQuizRoute(route: string): route is QuizRoute {
  return Object.hasOwn(routeLabels, route);
}

export const minute = 60_000;
export const retentionMs = 8 * 24 * 60 * minute;
export const latencyBounds = [1, 2, 5, 10, 15, 25, 40, 60, 90, 125, 175, 250, 350, 500, 700, 1000, 1500, 2200, 3200, 5000, 7500, 10000, 15000, 30000, 60000] as const;
export const databaseOperations = {
  "user lookup": "queries",
  "quiz session query": "queries",
  "quiz flashcard retrieval": "queries",
  "quiz session insertion": "writes",
  "atomic answer update": "writes",
  "review record persistence": "writes",
  "retry round persistence": "writes",
  "finish session persistence": "writes",
  "quiz resume lookup": "queries",
  "quiz resume update": "writes",
  "quiz discard update": "writes",
  "MongoDB connection acquisition": "connections",
} as const;
export type DatabaseSeries = (typeof databaseOperations)[keyof typeof databaseOperations];

export type Latency = { count: number; sum: number; bins: number[] };
export function emptyLatency(): Latency {
  return { count: 0, sum: 0, bins: Array<number>(latencyBounds.length + 1).fill(0) };
}

export function recordLatency(latency: Latency, ms: number) {
  const bin = latencyBounds.findIndex(bound => ms <= bound);
  latency.count++;
  latency.sum += ms;
  latency.bins[bin === -1 ? latencyBounds.length : bin]++;
}

export function mergeLatency(target: Latency, source: Latency) {
  target.count += source.count;
  target.sum += source.sum;
  source.bins.forEach((count, index) => { target.bins[index] += count; });
}

export function percentiles(latency: Latency) {
  function quantile(fraction: number, minimum: number) {
    if (latency.count < minimum) return null;
    const rank = Math.ceil(latency.count * fraction);
    let cumulative = 0;
    const index = latency.bins.findIndex(count => (cumulative += count) >= rank);
    return latencyBounds[index] ?? null;
  }
  return { p50: quantile(0.5, 5), p95: quantile(0.95, 20), p99: quantile(0.99, 100) };
}

export function requestOutcome(status: number | null) {
  if (status === null || status >= 500) return "serverError";
  return status >= 400 ? "clientError" : "success";
}

export type RequestMetrics = {
  latency: Latency;
  clientErrors: number;
  serverErrors: number;
  thrown: number;
  lastAt: number;
};
export function emptyRequests(): RequestMetrics {
  return { latency: emptyLatency(), clientErrors: 0, serverErrors: 0, thrown: 0, lastAt: 0 };
}
export function mergeRequests(target: RequestMetrics, source: RequestMetrics) {
  mergeLatency(target.latency, source.latency);
  target.clientErrors += source.clientErrors;
  target.serverErrors += source.serverErrors;
  target.thrown += source.thrown;
  target.lastAt = Math.max(target.lastAt, source.lastAt);
}

export type DatabaseMetrics = Record<DatabaseSeries, Latency>;
export function emptyDatabase(): DatabaseMetrics {
  return { queries: emptyLatency(), writes: emptyLatency(), connections: emptyLatency() };
}

export const periods = { "1h": [60, 5], "24h": [1440, 60], "7d": [10080, 360] } as const;
export function monitoringWindow(input: unknown, end = new Date()) {
  const period = input === "1h" || input === "7d" ? input : "24h";
  const [duration, resolution] = periods[period];
  const start = new Date(Math.ceil((+end - duration * minute) / minute) * minute);
  return { period, start, end, resolution: resolution * minute };
}
export type MonitoringWindow = ReturnType<typeof monitoringWindow>;

export type Availability = { status: "unavailable"; reason: string };
export type HealthState = "Healthy" | "Degraded" | "Unavailable" | "Unknown" | "Stale";

export type ReminderSource = { kind: "scheduled"; id: string; scheduledAt: Date } | { kind: "private" };
export type ReminderResult = {
  examined: number; created: number; existing: number; suppressed: number; errors: number;
  hasMore: boolean; busy: boolean; batches: number;
};
export type ReminderCompletion =
  | { outcome: "completed" | "partial" | "partial_batch" | "lease_busy"; summary: ReminderResult }
  | { outcome: "failed" };
export type ReminderRun = {
  _id: string; source: ReminderSource["kind"]; startedAt: Date; expiresAt: Date; scheduledAt?: Date;
  dispatchId?: string;
  finishedAt?: Date; completion?: ReminderCompletion;
};

export function reminderCompletion(result: ReminderResult): ReminderCompletion {
  const { examined, created, existing, suppressed, errors, hasMore, busy, batches } = result;
  return {
    outcome: busy ? "lease_busy" : errors ? "partial" : hasMore ? "partial_batch" : "completed",
    summary: { examined, created, existing, suppressed, errors, hasMore, busy, batches },
  };
}
