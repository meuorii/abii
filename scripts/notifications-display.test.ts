import assert from "node:assert/strict";
import { test } from "node:test";
import { NOTIFICATION_FILTERS, NOTIFICATION_PRESENTATION, formatUnreadCount } from "../components/notifications/notification-display";
import { NOTIFICATION_TYPES } from "../lib/notifications/contracts";

test("notification presentation covers every backend category exactly once", () => {
  assert.deepEqual(Object.keys(NOTIFICATION_PRESENTATION).sort(), [...NOTIFICATION_TYPES].sort());
  assert.deepEqual(NOTIFICATION_FILTERS.map((filter) => filter.id), ["all", "unread", "reminders", "achievements", "system"]);
});

test("unread badge stays compact and distinguishes loading from zero", () => {
  assert.equal(formatUnreadCount(null), "");
  assert.equal(formatUnreadCount(0), "");
  assert.equal(formatUnreadCount(1), "1");
  assert.equal(formatUnreadCount(9), "9");
  assert.equal(formatUnreadCount(10), "10");
  assert.equal(formatUnreadCount(99), "99");
  assert.equal(formatUnreadCount(100), "99+");
});
