import "server-only";
import { randomUUID } from "node:crypto";
import { type ClientSession, Types } from "mongoose";
import { actions, denials, AdminAuditLog, AdminSecurityEvent } from "@/models/AdminAuditLog";
import { connectToDatabase } from "@/lib/mongodb";

export async function auditAdmin(action: typeof actions[number], actorId: string, targetId: string, session: ClientSession) {
  if (!session.inTransaction()) throw new Error("Admin audit requires an active transaction.");
  const correlationId = randomUUID();
  await AdminAuditLog.create([{ action, actorId, targetId, correlationId, outcome: "committed" }], { session });
  await AdminSecurityEvent.create([{ _id: correlationId, kind: action, actorId }], { session });
}

export async function recordAdminDenial(kind: typeof denials[number], actorId?: string) {
  try {
    await connectToDatabase();
    // Keep one representative denial per kind/minute across all visitors.
    const minute = Math.floor(Date.now() / 60000);
    await AdminSecurityEvent.updateOne({ _id: kind + "/" + minute }, { $setOnInsert: {
      kind, occurredAt: new Date(), ...(actorId && Types.ObjectId.isValid(actorId) ? { actorId } : {}),
    } }, { upsert: true });
  } catch {
    // Diagnostics must not alter the authorization decision.
  }
}
