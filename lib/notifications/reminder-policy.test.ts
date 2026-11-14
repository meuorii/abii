import assert from "node:assert/strict";
import { test } from "node:test";
import { addCalendarDays, getStudyDayWindow, studyDayKey } from "@/lib/badges/study-day";
import { getCompletedWeek, getInactivityTier, isDailyReminderWindow, isEveningReminderWindow, studyStreakThroughYesterday } from "./reminder-policy";

test("study streak is only eligible when it ends yesterday and has no activity today", () => {
  const today = "2026-11-14";
  assert.equal(studyStreakThroughYesterday(new Set(["2026-11-11", "2026-11-12", "2026-11-13"]), today), 3);
  assert.equal(studyStreakThroughYesterday(new Set(["2026-11-12", "2026-11-13", today]), today), 0);
  assert.equal(studyStreakThroughYesterday(new Set(["2026-11-12"]), today), 0);
});

test("preferred study time has a bounded local window and DST repeated hours fire once per day", () => {
  const timezone = "America/New_York";
  assert.equal(isDailyReminderWindow(new Date("2025-11-02T05:30:00Z"), timezone, "01:30"), true);
  assert.equal(isDailyReminderWindow(new Date("2025-11-02T06:30:00Z"), timezone, "01:30"), false);
  assert.equal(isDailyReminderWindow(new Date("2025-03-09T07:00:00Z"), timezone, "02:30"), true);
  assert.equal(isDailyReminderWindow(new Date("2025-03-09T07:05:00Z"), timezone, "02:30"), false);
  assert.equal(isDailyReminderWindow(new Date("2025-01-01T10:06:00Z"), "Asia/Manila", "18:00"), false);
});

test("streak reminder is limited to the local evening and never carries past the day", () => {
  assert.equal(isEveningReminderWindow(new Date("2026-11-14T11:00:00Z"), "Asia/Manila"), true);
  assert.equal(isEveningReminderWindow(new Date("2026-11-14T13:00:00Z"), "Asia/Manila"), false);
  assert.equal(isEveningReminderWindow(new Date("2026-11-15T05:00:00Z"), "Asia/Manila"), false);
});

test("weekly period is the previous completed Monday-to-Monday local week", () => {
  const week = getCompletedWeek(new Date("2024-03-04T02:00:00Z"), "Asia/Manila");
  assert.deepEqual(week, { startKey: "2024-02-26", endKey: "2024-03-04", start: getStudyDayWindow("2024-02-26", "Asia/Manila").start, end: getStudyDayWindow("2024-03-04", "Asia/Manila").start });
  assert.equal(addCalendarDays(week.startKey, 7), week.endKey);
  assert.equal(studyDayKey(week.end, "Asia/Manila"), "2024-03-04");
});

test("inactivity reminders occur at three and ten complete local days, then stop", () => {
  assert.equal(getInactivityTier(3), 3);
  assert.equal(getInactivityTier(9), 3);
  assert.equal(getInactivityTier(10), 10);
  assert.equal(getInactivityTier(100), 10);
});
