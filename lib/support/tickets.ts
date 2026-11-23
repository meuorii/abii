import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { SupportTicket, SupportTicketActivity } from "@/models/SupportTicket";
import type { SupportCategory } from "./validation";

export const supportStatuses = ["new", "open", "awaiting_reply", "resolved"] as const;
export type SupportStatus = typeof supportStatuses[number];
export const supportActivityKinds = ["customer_message", "internal_note", "admin_response", "status_change", "delivery"] as const;

const transitions: Record<SupportStatus, readonly SupportStatus[]> = {
  new: ["open", "resolved"], open: ["awaiting_reply", "resolved"], awaiting_reply: ["open", "resolved"], resolved: ["open"],
};
export function supportStatusTransition(from: SupportStatus, to: SupportStatus) { return transitions[from].includes(to); }

export type EncryptedSupportBody = { keyId: string; version: 1; nonce: string; ciphertext: string; tag: string };
function encryptionKey(raw: string) {
  const value = raw.startsWith("base64:") ? Buffer.from(raw.slice(7), "base64") : Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error("Support correspondence encryption is not configured.");
  return value;
}
function configuredKey() {
  const raw = process.env.SUPPORT_TICKET_ENCRYPTION_KEY;
  if (!raw) throw new Error("Support correspondence encryption is not configured.");
  return { value: encryptionKey(raw), keyId: process.env.SUPPORT_TICKET_ENCRYPTION_KEY_ID?.trim() || "primary" };
}
export function encryptSupportBody(value: string, rawKey?: string): EncryptedSupportBody {
  const { value: key, keyId } = rawKey ? { value: encryptionKey(rawKey), keyId: "test" } : configuredKey();
  const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { version: 1, keyId, nonce: nonce.toString("base64"), ciphertext: ciphertext.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}
export function decryptSupportBody(body: EncryptedSupportBody, rawKey?: string) {
  const configured = rawKey ? { value: encryptionKey(rawKey), keyId: "test" } : configuredKey();
  if (body.keyId !== configured.keyId) throw new Error("Support correspondence key is unavailable.");
  const key = configured.value;
  if (body.version !== 1) throw new Error("Unsupported support correspondence encryption version.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(body.nonce, "base64"));
  decipher.setAuthTag(Buffer.from(body.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
export function supportReference() { return `SUP-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`; }

export async function createSupportTicket(input: { submissionKey: string; payloadHash: string; name: string; email: string; category: SupportCategory; message: string }, session?: ClientSession) {
  const now = new Date(); const _id = new Types.ObjectId();
  const [ticket] = await SupportTicket.create([{ _id, submissionKey: input.submissionKey, payloadHash: input.payloadHash, reference: supportReference(), source: "public_contact", customerName: input.name, customerEmail: input.email, customerEmailKey: input.email.toLowerCase(), category: input.category, status: "new", revision: 0, notificationState: "pending", lastActivityAt: now }], { session });
  await SupportTicketActivity.create([{ ticketId: _id, kind: "customer_message", body: encryptSupportBody(input.message), createdAt: now, updatedAt: now }], { session });
  return ticket.toObject();
}
