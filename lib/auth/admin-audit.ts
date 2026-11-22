import "server-only";
import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { ADMIN_SUBJECT } from "@/models/Admin";
import { actions, denials, AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { connectToDatabase } from "@/lib/mongodb";

export class AdminAuditStorageError extends Error {}

export async function auditAdmin(action: typeof actions[number], actorId: string, targetId: string, session: ClientSession, reason?: string) {
  if (!session.inTransaction()) throw new Error("Admin audit requires an active transaction.");
  if (actorId !== ADMIN_SUBJECT) throw new Error("Invalid administrator audit actor.");
  const correlationId = randomUUID();
  await AdminAuditLog.create([{ action, actorId, targetId, correlationId, outcome: "committed", ...(reason === undefined ? {} : { reason }) }], { session });
  await AdminSecurityEvent.create([{ _id: correlationId, kind: action, actorId }], { session });
}

export async function requireAdminAuditStorage() {
  const { connection } = await connectToDatabase();
  const names = [AdminAuditLog.collection.name, AdminSecurityEvent.collection.name];
  // The approved Atlas deployment rejects an $in filter on collection names.
  const collections = await Promise.all(names.map(name => connection.db?.listCollections({ name }, { nameOnly: true }).next()));
  if (collections.some(collection => collection?.type !== "collection")) {
    throw new AdminAuditStorageError("Required administrator audit storage is missing.");
  }
}

export async function recordAdminDenial(kind: typeof denials[number], actorId?: typeof ADMIN_SUBJECT) {
  try {
    await requireAdminAuditStorage();
    // Keep one representative denial per kind/minute across all visitors.
    const minute = Math.floor(Date.now() / 60000);
    await AdminSecurityEvent.updateOne({ _id: kind + "/" + minute }, { $setOnInsert: {
      kind, occurredAt: new Date(), ...(actorId ? { actorId } : {}),
    } }, { upsert: true });
  } catch {
    // Diagnostics must not alter the authorization decision.
  }
}
