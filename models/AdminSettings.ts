import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ADMIN_SETTINGS_ID } from "@/lib/admin/settings-contract";

const schema = new Schema({
  _id: { type: String, required: true, enum: [ADMIN_SETTINGS_ID] },
  revision: { type: Number, required: true, min: 0, default: 0 },
  preferences: {
    sessionWarningEnabled: { type: Boolean, required: true, default: true },
    sessionWarningLeadMinutes: { type: Number, required: true, enum: [2, 5, 10], default: 5 },
    operationalWarnings: { type: Boolean, required: true, default: true },
  },
  monitoring: {
    serverErrorPercent: { type: Number, required: true, min: 1, max: 20, default: 5 },
    latencyMs: { type: Number, required: true, min: 250, max: 5000, default: 1000 },
    reminderWarnings: { type: Boolean, required: true, default: true },
    monitoringNotices: { type: Boolean, required: true, default: true },
  },
  platform: {
    publicSupportNoticeEnabled: { type: Boolean, required: true, default: false },
    publicSupportNoticeText: { type: String, trim: true, maxlength: 500, default: "" },
  },
}, { collection: "adminsettings", autoCreate: false, autoIndex: false, strict: "throw", timestamps: true, versionKey: false });

export type AdminSettingsRecord = InferSchemaType<typeof schema>;
export const AdminSettings: Model<AdminSettingsRecord> = mongoose.models.AdminSettings ?? mongoose.model<AdminSettingsRecord>("AdminSettings", schema);
