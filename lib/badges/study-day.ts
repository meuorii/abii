/** Study calendar dates use the account's IANA timezone; missing legacy preferences mean UTC. */
export const DEFAULT_STUDY_TIMEZONE = "UTC";
export function isIanaStudyTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}
export function normalizeStudyTimezone(value?: string | null): string {
  if (!value) return DEFAULT_STUDY_TIMEZONE;
  return isIanaStudyTimezone(value) ? value : DEFAULT_STUDY_TIMEZONE;
}

export function studyDayKey(date: Date, timezone?: string | null): string {
  if (Number.isNaN(date.getTime())) throw new RangeError("Cannot compute a study day for an invalid date.");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: normalizeStudyTimezone(timezone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Consecutive calendar days are calculated with UTC date arithmetic after timezone-local keying. */
export function longestConsecutiveDayStreak(dayKeys: Iterable<string>): number {
  const sorted = [...new Set(dayKeys)].sort();
  let longest = 0;
  let current = 0;
  let previous = -1;
  for (const key of sorted) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const [year, month, day] = key.split("-").map(Number);
    const ordinal = Date.UTC(year, month - 1, day) / 86_400_000;
    if (ordinal === previous) continue;
    current = ordinal === previous + 1 ? current + 1 : 1;
    previous = ordinal;
    longest = Math.max(longest, current);
  }
  return longest;
}

export function addCalendarDays(dayKey: string, amount: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** A live streak includes today if active today, otherwise it may continue from yesterday. */
export function currentConsecutiveDayStreak(dayKeys: Iterable<string>, todayKey: string): number {
  const days = new Set(dayKeys);
  const anchor = days.has(todayKey) ? todayKey : addCalendarDays(todayKey, -1);
  if (!days.has(anchor)) return 0;
  let streak = 0;
  let cursor = anchor;
  while (days.has(cursor)) { streak += 1; cursor = addCalendarDays(cursor, -1); }
  return streak;
}
