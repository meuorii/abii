import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { NOTIFICATION_TYPES, validateNotificationTarget } from "@/lib/notifications/contracts";

const metadataSchema = new Schema({
  subjectId: { type: String, maxlength: 64, match: /^[a-f\d]{24}$/i },
  topicId: { type: String, maxlength: 64, match: /^[a-f\d]{24}$/i },
  sessionId: { type: String, maxlength: 64, match: /^[a-f\d]{24}$/i },
  badgeId: { type: String, maxlength: 64, match: /^[a-z0-9-]+$/i },
  eventId: { type: String, maxlength: 160, trim: true, match: /^[a-z0-9:_-]+$/i },
  announcementId: { type: String, maxlength: 64, match: /^[a-z0-9_-]+$/i },
  count: { type: Number, min: 0, max: 1_000_000, validate: Number.isInteger },
  periodKey: { type: String, maxlength: 40, match: /^[a-z0-9:_-]+$/i },
}, { _id: false, strict: "throw" });

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  message: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
  target: { type: String, default: null, maxlength: 512, validate: { validator: (value: string | null) => { try { validateNotificationTarget(value); return true; } catch { return false; } }, message: "Notification target must be a safe internal route." } },
  dedupeKey: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  metadata: { type: metadataSchema, default: () => ({}) },
  readAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false, strict: "throw" });

notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 }, { name: "notification_owner_created" });
notificationSchema.index({ userId: 1, readAt: 1 }, { name: "notification_owner_read" });
notificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, name: "notification_owner_dedupe_unique" });

if (mongoose.models.Notification && !mongoose.models.Notification.schema.indexes().some(([keys, options]) => keys.userId === 1 && keys.dedupeKey === 1 && options.unique)) mongoose.deleteModel("Notification");

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;
export const Notification: Model<NotificationDocument> = (mongoose.models.Notification as Model<NotificationDocument> | undefined) ?? mongoose.model<NotificationDocument>("Notification", notificationSchema);
