import "server-only";
import { timingSafeEqual } from "node:crypto";

export type SchedulerAuthorization = "authorized" | "missing_secret" | "invalid";

export function authorizeReminderRequest(searchParams: URLSearchParams, authorization: string | null, configuredSecret: string | undefined): SchedulerAuthorization | "invalid_parameters" {
  if (searchParams.size) return "invalid_parameters";
  return authorizeReminderScheduler(authorization, configuredSecret);
}

export function authorizeReminderScheduler(authorization: string | null, configuredSecret: string | undefined): SchedulerAuthorization {
  if (!configuredSecret || Buffer.byteLength(configuredSecret, "utf8") < 32) return "missing_secret";
  if (!authorization?.startsWith("Bearer ")) return "invalid";
  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(configuredSecret, "utf8");
  if (supplied.byteLength !== expected.byteLength) return "invalid";
  return timingSafeEqual(supplied, expected) ? "authorized" : "invalid";
}
