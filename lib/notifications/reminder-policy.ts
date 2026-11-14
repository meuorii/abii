import { addCalendarDays, getStudyDayWindow, normalizeStudyTimezone, studyDayKey } from "@/lib/badges/study-day";

const MINUTE = 60_000;

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return { dayKey: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")), minute: Number(value("minute")) };
}

/** First instant at/after a preferred local wall time; ambiguous times choose the first occurrence and gaps move to the first valid local minute. */
export function resolvePreferredStudyTime(dayKey: string, timezone: string, time: string): Date {
  if (!/^\d{2}:[0-5]\d$/.test(time)) throw new RangeError("Preferred study time must use HH:mm.");
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23) throw new RangeError("Preferred study time must use HH:mm.");
  const zone = normalizeStudyTimezone(timezone);
  const { start, end } = getStudyDayWindow(dayKey, zone);
  const desiredMinutes = hour * 60 + minute;
  for (let instant = start.getTime(); instant < end.getTime(); instant += MINUTE) {
    const at = new Date(instant);
    const local = localParts(at, zone);
    if (local.dayKey === dayKey && local.hour * 60 + local.minute >= desiredMinutes) return at;
  }
  return end;
}

export function isDailyReminderWindow(now: Date, timezone: string, time: string, toleranceMinutes = 5): boolean {
  const zone = normalizeStudyTimezone(timezone);
  const dayKey = studyDayKey(now, zone);
  const dueAt = resolvePreferredStudyTime(dayKey, zone, time);
  return now.getTime() >= dueAt.getTime() && now.getTime() < dueAt.getTime() + toleranceMinutes * MINUTE;
}

export function isEveningReminderWindow(now: Date, timezone: string): boolean {
  const { hour } = localParts(now, normalizeStudyTimezone(timezone));
  return hour >= 19 && hour < 21;
}

export function studyStreakThroughYesterday(activityDays: ReadonlySet<string>, todayKey: string): number {
  if (activityDays.has(todayKey)) return 0;
  let cursor = addCalendarDays(todayKey, -1);
  if (!activityDays.has(cursor)) return 0;
  let count = 0;
  while (activityDays.has(cursor)) {
    count += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  return count;
}

export function getCompletedWeek(now: Date, timezone: string): { startKey: string; endKey: string; start: Date; end: Date } {
  const zone = normalizeStudyTimezone(timezone);
  const today = studyDayKey(now, zone);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const endKey = addCalendarDays(today, -daysSinceMonday);
  const startKey = addCalendarDays(endKey, -7);
  return { startKey, endKey, start: getStudyDayWindow(startKey, zone).start, end: getStudyDayWindow(endKey, zone).start };
}

export function completeLocalDaysSince(activityDay: string, todayKey: string): number {
  const [ay, am, ad] = activityDay.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  return Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(ay, am - 1, ad)) / 86_400_000) - 1;
}

export function getInactivityTier(completeDays: number): 3 | 10 | null {
  if (completeDays >= 10) return 10;
  if (completeDays >= 3 && completeDays < 10) return 3;
  return null;
}
