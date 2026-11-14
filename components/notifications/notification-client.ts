import { isNotificationType, isValidStudyTime, NOTIFICATION_TYPES, validateNotificationTarget, type NotificationDTO, type NotificationGroup, type NotificationPreferences, type NotificationType } from "@/lib/notifications/contracts";

export interface NotificationPageData { notifications: NotificationDTO[]; nextCursor: string | null; hasMore: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotification(value: unknown): value is NotificationDTO {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[a-f\d]{24}$/i.test(value.id) || typeof value.type !== "string" || !isNotificationType(value.type) || typeof value.title !== "string" || typeof value.message !== "string" || typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt)) || (value.readAt !== null && (typeof value.readAt !== "string" || Number.isNaN(Date.parse(value.readAt)))) || (value.expiresAt !== null && (typeof value.expiresAt !== "string" || Number.isNaN(Date.parse(value.expiresAt)))) || (value.target !== null && typeof value.target !== "string") || !isRecord(value.metadata)) return false;
  try { validateNotificationTarget(value.target); } catch { return false; }
  return true;
}

function apiError(data: unknown, fallback: string): string {
  return isRecord(data) && typeof data.error === "string" ? data.error : fallback;
}

function parsePreferences(value: unknown, errorMessage: string): NotificationPreferences {
  if (!isRecord(value)) throw new Error(errorMessage);
  const result = {} as Record<NotificationType, boolean>;
  for (const type of NOTIFICATION_TYPES) {
    if (typeof value[type] !== "boolean") throw new Error(errorMessage);
    result[type] = type === "account_security" ? true : value[type];
  }
  if (!(value.dailyStudyTime === null || (typeof value.dailyStudyTime === "string" && isValidStudyTime(value.dailyStudyTime)))) throw new Error(errorMessage);
  return { ...result, dailyStudyTime: value.dailyStudyTime };
}

export async function fetchNotificationPage(options: { limit: number; cursor?: string; unreadOnly?: boolean; group?: NotificationGroup }): Promise<NotificationPageData> {
  const query = new URLSearchParams({ limit: String(options.limit) });
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.unreadOnly) query.set("unread", "true");
  if (options.group) query.set("group", options.group);
  const response = await fetch(`/api/notifications?${query}`, { cache: "no-store" });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError(data, "Notifications could not be loaded. Try again."));
  if (!isRecord(data) || !Array.isArray(data.notifications) || !data.notifications.every(isNotification) || !(data.nextCursor === null || typeof data.nextCursor === "string") || typeof data.hasMore !== "boolean") throw new Error("The notification response could not be read. Try again.");
  return { notifications: data.notifications, nextCursor: data.nextCursor, hasMore: data.hasMore } as NotificationPageData;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error("This notification could not be opened.");
  const response = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError(data, "This notification could not be marked as read."));
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await fetch("/api/notifications/read-all", { method: "PATCH" });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError(data, "Notifications could not be marked as read."));
  if (!isRecord(data) || typeof data.modifiedCount !== "number" || !Number.isInteger(data.modifiedCount) || data.modifiedCount < 0) throw new Error("The notification response could not be read. Try again.");
  return data.modifiedCount;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch("/api/notifications/preferences", { cache: "no-store" });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError(data, "Notification preferences could not be loaded."));
  if (!isRecord(data)) throw new Error("Notification preferences could not be read.");
  return parsePreferences(data.preferences, "Notification preferences could not be read.");
}

export async function saveNotificationPreferences(patch: { notifications?: Partial<Record<NotificationType, boolean>>; dailyStudyTime?: string | null }): Promise<NotificationPreferences> {
  const response = await fetch("/api/notifications/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError(data, "Notification preferences could not be saved. Try again."));
  if (!isRecord(data)) throw new Error("Notification preferences could not be saved.");
  return parsePreferences(data.preferences, "Notification preferences could not be saved.");
}
