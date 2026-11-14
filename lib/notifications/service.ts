import "server-only";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { NotificationInputError } from "./errors";
import { isNotificationType, NOTIFICATION_GROUPS, normalizeNotificationPreferences, validateNotificationTarget, type CreateNotificationInput, type NotificationDTO, type NotificationGroup, type NotificationMetadata, type NotificationType } from "./contracts";

export type CreateNotificationResult = { status: "created"; notification: NotificationDTO } | { status: "already_exists" } | { status: "suppressed"; reason: "preference_disabled" | "daily_time_unset" };
export interface NotificationListOptions { limit: number; cursor?: string; unreadOnly?: boolean; type?: NotificationType; group?: NotificationGroup }
export interface NotificationListResult { notifications: NotificationDTO[]; nextCursor: string | null; hasMore: boolean }

function ownerId(value: string): Types.ObjectId {
  if (!mongoose.isObjectIdOrHexString(value)) throw new NotificationInputError("A valid user ID is required.");
  return new Types.ObjectId(value);
}

function validateInput(input: CreateNotificationInput): CreateNotificationInput {
  if (!input || typeof input !== "object" || !isNotificationType(input.type)) throw new NotificationInputError("A valid notification type is required.");
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 120) throw new NotificationInputError("Notification title must contain 1 to 120 characters.");
  if (typeof input.message !== "string" || !input.message.trim() || input.message.trim().length > 500) throw new NotificationInputError("Notification message must contain 1 to 500 characters.");
  if (typeof input.dedupeKey !== "string" || !input.dedupeKey.trim() || input.dedupeKey.trim().length > 200) throw new NotificationInputError("Notification dedupe key must contain 1 to 200 characters.");
  const target = validateNotificationTarget(input.target);
  if (input.expiresAt != null && (!(input.expiresAt instanceof Date) || !Number.isFinite(input.expiresAt.getTime()))) throw new NotificationInputError("Notification expiry must be a valid date.");
  const metadata = input.metadata ?? {};
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) throw new NotificationInputError("Notification metadata must be an object.");
  const allowed = new Set(["subjectId", "topicId", "sessionId", "badgeId", "eventId", "announcementId", "count", "periodKey"]);
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowed.has(key)) throw new NotificationInputError("Notification metadata contains an unsupported field.");
    if (key === "count") { if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000) throw new NotificationInputError("Notification count is invalid."); }
    else if (typeof value !== "string" || value.length < 1 || value.length > (key === "eventId" ? 160 : key === "periodKey" ? 40 : 64) || (key === "eventId" && !/^[a-z0-9:_-]+$/i.test(value))) throw new NotificationInputError(`Notification metadata field ${key} is invalid.`);
  }
  return { ...input, title: input.title.trim(), message: input.message.trim(), dedupeKey: input.dedupeKey.trim(), target, metadata: metadata as NotificationMetadata };
}

function toDTO(row: { _id: Types.ObjectId; type: string; title: string; message: string; target?: string | null; metadata?: Record<string, unknown> | null; readAt?: Date | null; createdAt: Date; expiresAt?: Date | null }): NotificationDTO {
  const metadata = Object.fromEntries(Object.entries(row.metadata ?? {}).filter(([, value]) => value !== null && value !== undefined)) as NotificationMetadata;
  return { id: String(row._id), type: row.type as NotificationType, title: row.title, message: row.message, target: row.target ?? null, metadata, readAt: row.readAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null };
}

function encodeCursor(createdAt: Date, id: Types.ObjectId): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id: String(id) })).toString("base64url");
}

function decodeCursor(value: string | undefined): { createdAt: Date; id: Types.ObjectId } | null {
  if (value === undefined) return null;
  try {
    if (value.length > 256 || !/^[A-Za-z\d_-]+$/.test(value)) throw new Error();
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    const data = parsed as Record<string, unknown>;
    const createdAt = typeof data.createdAt === "string" ? new Date(data.createdAt) : new Date(NaN);
    if (!Number.isFinite(createdAt.getTime()) || typeof data.id !== "string" || !/^[a-f\d]{24}$/i.test(data.id) || Object.keys(data).length !== 2) throw new Error();
    return { createdAt, id: new Types.ObjectId(data.id) };
  } catch { throw new NotificationInputError("The notification cursor is invalid."); }
}

/** Create a trusted notification. The unique owner/key index is the idempotency authority. */
export async function createNotification(userId: string, rawInput: CreateNotificationInput): Promise<CreateNotificationResult> {
  const userObjectId = ownerId(userId);
  const input = validateInput(rawInput);
  await connectToDatabase();
  const user = await User.findById(userObjectId).select("settings.notifications settings.dailyStudyTime").lean();
  if (!user) throw new Error("Notification owner does not exist.");
  if (input.type !== "account_security") {
    const preferences = normalizeNotificationPreferences({ ...(user.settings?.notifications ?? {}), dailyStudyTime: user.settings?.dailyStudyTime });
    if (!preferences[input.type]) return { status: "suppressed", reason: "preference_disabled" };
    if (input.type === "daily_study_reminder" && !preferences.dailyStudyTime) return { status: "suppressed", reason: "daily_time_unset" };
  }
  const existing = await Notification.findOne({ userId: userObjectId, dedupeKey: input.dedupeKey }).select("_id").lean();
  if (existing) return { status: "already_exists" };
  try {
    const created = await Notification.create({ ...input, userId: userObjectId });
    return { status: "created", notification: toDTO(created.toObject()) };
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) return { status: "already_exists" };
    throw error;
  }
}

export async function listNotifications(userId: string, options: NotificationListOptions): Promise<NotificationListResult> {
  const userObjectId = ownerId(userId);
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50) throw new NotificationInputError("Notification page size must be between 1 and 50.");
  const cursor = decodeCursor(options.cursor);
  await connectToDatabase();
  const filter: Record<string, unknown> = { userId: userObjectId, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
  if (options.unreadOnly) filter.readAt = null;
  if (options.type) filter.type = options.type;
  else if (options.group) filter.type = { $in: NOTIFICATION_GROUPS[options.group] };
  if (cursor) filter.$and = [{ $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }] }];
  const rows = await Notification.find(filter).select("type title message target metadata readAt createdAt expiresAt").sort({ createdAt: -1, _id: -1 }).limit(options.limit + 1).lean();
  const hasMore = rows.length > options.limit;
  const visible = hasMore ? rows.slice(0, options.limit) : rows;
  const last = visible.at(-1);
  return { notifications: visible.map(toDTO), nextCursor: hasMore && last ? encodeCursor(last.createdAt, last._id) : null, hasMore };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  await connectToDatabase();
  return Notification.countDocuments({ userId: ownerId(userId), readAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
}

export async function markNotificationRead(userId: string, notificationId: string, readAt = new Date()): Promise<boolean> {
  const userObjectId = ownerId(userId);
  if (!mongoose.isObjectIdOrHexString(notificationId)) throw new NotificationInputError("A valid notification ID is required.");
  await connectToDatabase();
  const updated = await Notification.findOneAndUpdate({ _id: new Types.ObjectId(notificationId), userId: userObjectId, readAt: null }, { $set: { readAt } }, { new: true, runValidators: true }).select("_id").lean();
  if (updated) return true;
  const owned = await Notification.exists({ _id: new Types.ObjectId(notificationId), userId: userObjectId });
  return owned !== null;
}

export async function markAllNotificationsRead(userId: string, readAt = new Date()): Promise<number> {
  await connectToDatabase();
  const result = await Notification.updateMany({ userId: ownerId(userId), readAt: null }, { $set: { readAt } });
  return result.modifiedCount;
}
