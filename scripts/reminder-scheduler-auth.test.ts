import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeReminderRequest, authorizeReminderScheduler } from "../lib/notifications/scheduler-auth";

test("scheduler authorization fails closed and accepts only an exact bearer secret", () => {
  const secret = "x".repeat(48);
  assert.equal(authorizeReminderScheduler(`Bearer ${secret}`, secret), "authorized");
  assert.equal(authorizeReminderScheduler(null, secret), "invalid");
  assert.equal(authorizeReminderScheduler(`Bearer ${secret}x`, secret), "invalid");
  assert.equal(authorizeReminderScheduler(`Bearer ${"x".repeat(12)}`, "short"), "missing_secret");
  assert.equal(authorizeReminderScheduler(`Bearer ${secret}`, undefined), "missing_secret");
  assert.equal(authorizeReminderRequest(new URLSearchParams("userId=abc"), `Bearer ${secret}`, secret), "invalid_parameters");
  assert.equal(authorizeReminderRequest(new URLSearchParams(), `Bearer ${secret}`, secret), "authorized");
});
