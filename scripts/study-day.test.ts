import assert from "node:assert/strict";
import { test } from "node:test";
import { addCalendarDays, currentConsecutiveDayStreak, getStudyDayWindow, normalizeStudyTimezone, recentStudyDayKeys, studyDayGreeting, studyDayKey } from "../lib/badges/study-day";

test("study-day windows use account-local midnight and variable DST day lengths", () => {
  assert.deepEqual(getStudyDayWindow("2025-03-09", "America/New_York"), {
    start: new Date("2025-03-09T05:00:00.000Z"),
    end: new Date("2025-03-10T04:00:00.000Z"),
  });
  assert.equal(getStudyDayWindow("2025-11-02", "America/New_York").end.getTime() - getStudyDayWindow("2025-11-02", "America/New_York").start.getTime(), 25 * 60 * 60 * 1000);
});

test("study-day streaks use local keys across UTC and calendar boundaries", () => {
  const timezone = "Asia/Manila";
  const today = new Date("2025-01-01T16:00:00.000Z");
  assert.equal(studyDayKey(today, timezone), "2025-01-02");
  assert.equal(currentConsecutiveDayStreak(new Set(["2024-12-31", "2025-01-01"]), "2025-01-02"), 2);
  assert.equal(addCalendarDays("2024-02-28", 1), "2024-02-29");
});

test("timezone fallback and greetings follow the account-local hour", () => {
  assert.equal(normalizeStudyTimezone("Not/AZone"), "UTC");
  assert.equal(studyDayGreeting(new Date("2025-01-01T03:59:00.000Z"), "Asia/Manila"), "Good morning");
  assert.equal(studyDayGreeting(new Date("2025-01-01T04:00:00.000Z"), "Asia/Manila"), "Good afternoon");
  assert.equal(studyDayGreeting(new Date("2025-01-01T10:00:00.000Z"), "Asia/Manila"), "Good evening");
  assert.equal(studyDayGreeting(new Date("2025-01-01T18:00:00.000Z"), "UTC"), "Good evening");
});

test("calendar windows remain unique and ordered through leap day and year end", () => {
  const days = recentStudyDayKeys("2024-03-01", 5);
  assert.deepEqual(days, ["2024-02-26", "2024-02-27", "2024-02-28", "2024-02-29", "2024-03-01"]);
  assert.equal(new Set(days).size, 5);
  assert.deepEqual(recentStudyDayKeys("2025-01-02", 3), ["2024-12-31", "2025-01-01", "2025-01-02"]);
  assert.equal(recentStudyDayKeys("2025-01-02", 90).length, 90);
});

test("local day boundaries convert to correct UTC instants across supported zones", () => {
  assert.equal(getStudyDayWindow("2025-01-02", "Asia/Manila").start.toISOString(), "2025-01-01T16:00:00.000Z");
  assert.equal(getStudyDayWindow("2025-01-02", "Europe/London").start.toISOString(), "2025-01-02T00:00:00.000Z");
  assert.equal(getStudyDayWindow("2025-01-02", "America/New_York").start.toISOString(), "2025-01-02T05:00:00.000Z");
  assert.equal(getStudyDayWindow("2025-01-02", "UTC").start.toISOString(), "2025-01-02T00:00:00.000Z");
  assert.equal(studyDayKey(new Date("2025-01-01T23:30:00.000Z"), "Europe/London"), "2025-01-01");
  assert.equal(studyDayKey(new Date("2025-01-01T23:30:00.000Z"), "Asia/Manila"), "2025-01-02");
});

