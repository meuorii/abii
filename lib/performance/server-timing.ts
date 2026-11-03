import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type Trace = { requestId: string; route: string; startedAt: number; durations: Array<{ operation: string; ms: number }>; databaseOperations: number };
const traces = new AsyncLocalStorage<Trace>();
const processStartedAt = performance.now();
let hasServedRequest = false;

function productionTracingEnabled() {
  return process.env.ABII_PERF_TRACE === "1";
}

/** Record server work in development, and in production only when explicitly enabled. */
export async function measureServerOperation<T>(name: string, operation: () => Promise<T>, options: { database?: boolean } = {}): Promise<T> {
  const trace = traces.getStore();
  const enabled = process.env.NODE_ENV === "development" || productionTracingEnabled();
  if (!enabled) return operation();
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const ms = performance.now() - startedAt;
    if (trace && productionTracingEnabled()) {
      trace.durations.push({ operation: name, ms: Number(ms.toFixed(2)) });
      if (options.database) trace.databaseOperations += 1;
    }
    else console.info(`[perf] ${name}: ${ms.toFixed(1)}ms`);
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
      trace.durations.push({ operation: name, ms: Number(ms.toFixed(2)) });
      if (options.database) trace.databaseOperations += 1;
    }
    else console.info(`[perf] ${name}: ${ms.toFixed(1)}ms`);
  }
}

function writeTrace(trace: Trace, warmInstance: boolean) {
  console.info(JSON.stringify({
    event: "abii.performance",
    requestId: trace.requestId,
    route: trace.route,
    region: process.env.VERCEL_REGION ?? "unknown",
    instanceAgeMs: Number((performance.now() - processStartedAt).toFixed(1)),
    warmInstance,
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
    if (productionTracingEnabled()) writeTrace(trace, wasWarm);
  }
}

/** Wrap an API handler with an opaque correlation ID and one structured, PII-free log. */
export async function withApiPerformanceTrace(request: Request, route: string, handler: () => Promise<Response>): Promise<Response> {
  if (!productionTracingEnabled() && process.env.NODE_ENV !== "development") return handler();
  const trace: Trace = { requestId: randomUUID(), route, startedAt: performance.now(), durations: [], databaseOperations: 0 };
  const wasWarm = hasServedRequest;
  hasServedRequest = true;
  try {
    const response = await traces.run(trace, handler);
    // This opaque ID is only for matching DevTools requests to server logs; no timings are returned.
    response.headers.set("x-abii-request-id", trace.requestId);
    return response;
  } finally {
    if (productionTracingEnabled()) writeTrace(trace, wasWarm);
  }
}

export function logServerDuration(name: string, startedAt: number): void {
  if (process.env.NODE_ENV === "development") {
    console.info(`[perf] ${name}: ${(performance.now() - startedAt).toFixed(1)}ms`);
  }
}
