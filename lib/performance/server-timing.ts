import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { after } from "next/server.js";
import { databaseOperations, emptyDatabase, isQuizRoute, recordLatency, type DatabaseMetrics } from "./monitoring";
import { enqueueObservation, telemetryDrop, telemetryEnabled } from "./storage";

type Trace = { requestId: string; route: string; startedAt: number; durations: Array<{ operation: string; ms: number }>; databaseOperations: number; database?: DatabaseMetrics };
const traces = new AsyncLocalStorage<Trace>();
const processStartedAt = performance.now();
let hasServedRequest = false;

function productionTracingEnabled() {
  return process.env.ABII_PERF_TRACE === "1";
}

/** Record server work in development, and in production only when explicitly enabled. */
export async function measureServerOperation<T>(name: string, operation: () => Promise<T>, options: { database?: boolean } = {}): Promise<T> {
  const trace = traces.getStore();
  const enabled = process.env.NODE_ENV === "development" || productionTracingEnabled() || Boolean(trace?.database);
  if (!enabled) return operation();
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const ms = performance.now() - startedAt;
    if (trace?.database && Object.hasOwn(databaseOperations, name)) {
      recordLatency(trace.database[databaseOperations[name as keyof typeof databaseOperations]], ms);
    }
    if (trace && productionTracingEnabled()) {
      if (trace.durations.length < 128) trace.durations.push({ operation: name, ms: Number(ms.toFixed(2)) });
      if (options.database) trace.databaseOperations += 1;
    }
    else if (process.env.NODE_ENV === "development" || productionTracingEnabled()) {
      try { console.info(`[perf] ${name}: ${ms.toFixed(1)}ms`); } catch { telemetryDrop(); }
    }
  }
}

export function measureSyncServerOperation<T>(name: string, operation: () => T, options: { database?: boolean } = {}): T {
  const trace = traces.getStore();
  const enabled = process.env.NODE_ENV === "development" || productionTracingEnabled();
  if (!enabled) return operation();
  const startedAt = performance.now();
  try {
    return operation();
  } finally {
    const ms = performance.now() - startedAt;
    if (trace && productionTracingEnabled()) {
      if (trace.durations.length < 128) trace.durations.push({ operation: name, ms: Number(ms.toFixed(2)) });
      if (options.database) trace.databaseOperations += 1;
    }
    else if (process.env.NODE_ENV === "development" || productionTracingEnabled()) {
      try { console.info(`[perf] ${name}: ${ms.toFixed(1)}ms`); } catch { telemetryDrop(); }
    }
  }
}

function writeTrace(trace: Trace, warmInstance: boolean, status?: number | null) {
  console.info(JSON.stringify({
    event: "abii.performance",
    requestId: trace.requestId,
    route: trace.route,
    region: process.env.VERCEL_REGION ?? "unknown",
    instanceAgeMs: Number((performance.now() - processStartedAt).toFixed(1)),
    warmInstance,
    ...(status !== undefined ? { status, threw: status === null } : {}),
    totalMs: Number((performance.now() - trace.startedAt).toFixed(2)),
    databaseOperations: trace.databaseOperations,
    operations: trace.durations,
  }));
}

export async function withServerPagePerformanceTrace<T>(route: string, render: () => Promise<T>): Promise<T> {
  if (!productionTracingEnabled() && process.env.NODE_ENV !== "development") return render();
  const trace: Trace = { requestId: randomUUID(), route, startedAt: performance.now(), durations: [], databaseOperations: 0 };
  const wasWarm = hasServedRequest;
  hasServedRequest = true;
  try {
    return await traces.run(trace, render);
  } finally {
    if (productionTracingEnabled()) {
      try { writeTrace(trace, wasWarm); } catch { telemetryDrop(); }
    }
  }
}

/** The handler settles before best-effort telemetry registers its post-response work. */
export async function withApiPerformanceTrace(_request: Request, route: string, handler: () => Promise<Response>): Promise<Response> {
  const log = productionTracingEnabled();
  const collect = telemetryEnabled() && isQuizRoute(route);
  if (!collect && !log && process.env.NODE_ENV !== "development") return handler();

  const trace: Trace = {
    requestId: randomUUID(), route, startedAt: performance.now(), durations: [], databaseOperations: 0,
    database: collect ? emptyDatabase() : undefined,
  };
  const wasWarm = hasServedRequest;
  hasServedRequest = true;
  let status: number | null = null;
  let completed: { at: number; ms: number } | undefined;
  try {
    const response = await traces.run(trace, handler);
    completed = { at: Date.now(), ms: performance.now() - trace.startedAt };
    status = response.status;
    if (log || process.env.NODE_ENV === "development") {
      try { response.headers.set("x-abii-request-id", trace.requestId); } catch { /* Immutable headers are valid. */ }
    }
    return response;
  } finally {
    const { at, ms } = completed ?? { at: Date.now(), ms: performance.now() - trace.startedAt };
    try {
      if (collect && trace.database && isQuizRoute(route)) {
        const observation = { route, status, ms, at, database: trace.database };
        after(() => enqueueObservation(observation));
      }
    } catch {
      telemetryDrop();
    }
    if (log) {
      try { writeTrace(trace, wasWarm, status); } catch { telemetryDrop(); }
    }
  }
}

export function logServerDuration(name: string, startedAt: number): void {
  if (process.env.NODE_ENV === "development") {
    console.info(`[perf] ${name}: ${(performance.now() - startedAt).toFixed(1)}ms`);
  }
}
