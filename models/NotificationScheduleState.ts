import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const stateSchema = new Schema({
  _id: { type: String, required: true },
  cursor: { type: Schema.Types.ObjectId, default: null },
  leaseToken: { type: String, default: null, maxlength: 64 },
  leaseUntil: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false, strict: "throw" });

export type NotificationScheduleStateDocument = InferSchemaType<typeof stateSchema>;
export const NotificationScheduleState: Model<NotificationScheduleStateDocument> =
  (mongoose.models.NotificationScheduleState as Model<NotificationScheduleStateDocument> | undefined) ??
  mongoose.model<NotificationScheduleStateDocument>("NotificationScheduleState", stateSchema);
