import "server-only";

/** Development-only timings. Names describe operations; values never include user data. */
export async function measureServerOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== "development") return operation();
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    console.info(`[perf] ${name}: ${(performance.now() - startedAt).toFixed(1)}ms`);
  }
}

export function logServerDuration(name: string, startedAt: number): void {
  if (process.env.NODE_ENV === "development") {
    console.info(`[perf] ${name}: ${(performance.now() - startedAt).toFixed(1)}ms`);
  }
}
