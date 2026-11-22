import "server-only";
import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

export const actions = ["provision", "enroll", "enrollment-restart", "rotate", "recover", "login", "logout", "user.suspend", "user.restore"] as const;
export const denials = ["login-denied", "mfa-denied", "access-denied", "recovery-denied"] as const;
const schema = new Schema({
  actorId: { type: String, required: true },
  targetId: { type: String, required: true },
  action: { type: String, enum: actions, required: true },
  reason: { type: String, trim: true, minlength: 3, maxlength: 500, required: function (this: { action?: string }): boolean { return this.action === "user.suspend" || this.action === "user.restore"; } },
  correlationId: { type: String, required: true },
  outcome: { type: String, enum: ["committed"], required: true },
  occurredAt: { type: Date, default: Date.now, required: true },
}, { collection: "adminauditlogs", autoCreate: false, autoIndex: false, strict: "throw", versionKey: false });
schema.index({ occurredAt: 1 }, { expireAfterSeconds: 365 * 86400 });
schema.index({ targetId: 1, occurredAt: -1 });
type Audit = InferSchemaType<typeof schema>;
export const AdminAuditLog: Model<Audit> = mongoose.models.AdminAuditLog ?? mongoose.model<Audit>("AdminAuditLog", schema);

const events = new Schema({
  _id: { type: String, required: true },
  kind: { type: String, enum: [...actions, ...denials], required: true },
  actorId: String,
  occurredAt: { type: Date, default: Date.now, required: true },
}, { collection: "adminsecurityevents", autoCreate: false, autoIndex: false, strict: "throw", versionKey: false });
events.index({ occurredAt: 1 }, { expireAfterSeconds: 90 * 86400 });
events.index({ kind: 1, occurredAt: -1 });
type Event = InferSchemaType<typeof events>;
export const AdminSecurityEvent: Model<Event> = mongoose.models.AdminSecurityEvent ?? mongoose.model<Event>("AdminSecurityEvent", events);
