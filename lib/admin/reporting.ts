export const dayMs = 86_400_000;
export const reportingMaxTimeMS = 1500;
export const unindexedCollectionLimit = 50_000;
export const aggregateOptions = { maxTimeMS: reportingMaxTimeMS, allowDiskUse: false };
export const reportingPeriods = [7, 30, 90] as const;
export type ReportingDays = typeof reportingPeriods[number];
export type DailyCount = { day: string; count: number };
export type ReportingWindow = { days: ReportingDays; start: Date; end: Date };

export function reportingWindow(value: unknown, now = new Date()): ReportingWindow {
  const days = value === "7" ? 7 : value === "90" ? 90 : 30;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { days, start: new Date(+end - days * dayMs), end };
}

export function precedingWindow(window: ReportingWindow): ReportingWindow {
  return { days: window.days, start: new Date(+window.start - window.days * dayMs), end: window.start };
}

export function dayKey(date: string) {
  return { $dateToString: { date, format: "%Y-%m-%d", timezone: "UTC" } };
}

export function calendarDays(window: ReportingWindow): string[] {
  return Array.from({ length: window.days }, (_, offset) => new Date(+window.start + offset * dayMs).toISOString().slice(0, 10));
}

export function fillDays(window: ReportingWindow, buckets: { _id: string; count: number }[]): DailyCount[] {
  const counts = new Map(buckets.map(bucket => [bucket._id, bucket.count]));
  return calendarDays(window).map(day => ({ day, count: counts.get(day) ?? 0 }));
}
