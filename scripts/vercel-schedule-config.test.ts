import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { POST as scheduledPost } from "../app/api/internal/notifications/reminder-schedule/route";

test("Vercel declares one Hobby-compatible private UTC reminders function and preserves manual Git deployment policy", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    git?: { deploymentEnabled?: boolean };
    crons?: unknown[];
    functions?: Record<string, { experimentalTriggers?: Array<{ type: string }> }>;
    schedules?: Record<string, { schedule: string; timezone?: string; function?: string; path?: string; topic?: string; jitter?: number }>;
  };
  const schedules = Object.entries(config.schedules ?? {});
  assert.equal(config.git?.deploymentEnabled, false);
  assert.equal(config.crons, undefined);
  assert.equal(schedules.length, 1);
  const [name, schedule] = schedules[0];
  assert.equal(name, "notification-reminders");
  assert.equal(schedule.schedule, "*/15 * * * *");
  assert.equal(schedule.timezone, "UTC");
  assert.equal(schedule.function, "api/internal/notifications/reminder-schedule");
  assert.equal(schedule.path, undefined);
  assert.equal(schedule.topic, undefined);
  assert.ok(schedule.jitter === undefined || schedule.jitter === 15);

  const source = "app/api/internal/notifications/reminder-schedule/route.ts";
  assert.deepEqual(config.functions?.[source]?.experimentalTriggers, [{ type: "schedule/v1beta" }]);
});

test("the schedule target rejects an ordinary public request before running reminder work", async () => {
  const response = await scheduledPost(new Request("https://abii.example/api/internal/notifications/reminder-schedule", { method: "POST" }));
  assert.equal(response.status, 400);
});

test("the protected compatibility endpoint permits the runner's bounded execution duration", () => {
  const source = readFileSync(new URL("../app/api/internal/notifications/reminders/route.ts", import.meta.url), "utf8");
  assert.match(source, /export const maxDuration = 300;/);
});
