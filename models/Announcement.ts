import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { announcementAudience, announcementStates } from "@/lib/admin/announcement-contract";

export const announcementQueueIndex = "announcement_queue";
export const announcementUpdatedIndex = "announcement_updated";
export const announcementCreatedIndex = "announcement_created";
export const receiptOwnerIndex = "announcement_receipt_owner";

const estimateSchema = new Schema({ count: { type: Number, required: true, min: 0 }, calculatedAt: { type: Date, required: true } }, { _id: false });
const schema = new Schema({
  title: { type: String, required: true, maxlength: 120 },
  titleKey: { type: String, required: true, maxlength: 240 },
  message: { type: String, required: true, maxlength: 500 },
  target: { type: String, default: null },
  audience: { type: String, enum: [announcementAudience], required: true, default: announcementAudience },
  author: { type: String, required: true },
  state: { type: String, enum: announcementStates, required: true },
  revision: { type: Number, required: true, default: 0 },
  lastAction: { type: String, required: true },
  scheduledAt: Date,
  committedAt: Date,
  completedAt: Date,
  lastAttemptAt: Date,
  estimate: estimateSchema,
  nextRunAt: Date,
  lease: String,
  cutoffId: Schema.Types.ObjectId,
  candidateTotal: Number,
  cursor: Schema.Types.ObjectId,
  delivered: { type: Number, required: true, default: 0 },
  previouslyCompleted: { type: Number, required: true, default: 0 },
  suppressed: { type: Number, required: true, default: 0 },
  pending: Number,
  attemptCount: { type: Number, required: true, default: 0 },
  retries: { type: Number, required: true, default: 0 },
  deliveryError: { type: Boolean, required: true, default: false },
}, { collection: "announcements", timestamps: true, versionKey: false, autoCreate: false, autoIndex: false, strict: "throw" });
schema.index({ nextRunAt: 1, _id: 1 }, { name: announcementQueueIndex });
schema.index({ updatedAt: -1, _id: -1 }, { name: announcementUpdatedIndex });
schema.index({ createdAt: -1, _id: -1 }, { name: announcementCreatedIndex });
export type AnnouncementDocument = InferSchemaType<typeof schema>;
export const Announcement: Model<AnnouncementDocument> = mongoose.models.Announcement ?? mongoose.model<AnnouncementDocument>("Announcement", schema);

const receipts = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
}, { collection: "announcementreceipts", versionKey: false, autoCreate: false, autoIndex: false, strict: "throw" });
receipts.index({ userId: 1 }, { name: receiptOwnerIndex });
type Receipt = InferSchemaType<typeof receipts>;
export const AnnouncementReceipt: Model<Receipt> = mongoose.models.AnnouncementReceipt ?? mongoose.model<Receipt>("AnnouncementReceipt", receipts);
