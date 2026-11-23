import "server-only";
import { Types } from "mongoose";
import { SupportResponseOperation, SupportTicket, SupportTicketActivity } from "@/models/SupportTicket";
import { decryptSupportBody, encryptSupportBody, supportStatusTransition, type EncryptedSupportBody, type SupportStatus } from "@/lib/support/tickets";
import { auditAdmin } from "@/lib/auth/admin-audit";
import { validateAdminSession, withFreshAdminMutation } from "@/lib/auth/admin-session-state";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { renderSupportReply } from "@/lib/email/support-template";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";

const pageSize = 20; const activitySize = 50; const sendingStaleMs = 2 * 60_000;
const statuses = ["all", "new", "open", "awaiting_reply", "resolved"] as const;
export type SupportQuery = { q: string; status: typeof statuses[number]; id: string; page: number };
export class SupportInputError extends Error { constructor(message: string) { super(message); this.name = "SupportInputError"; } }
export class SupportConflict extends Error { constructor(message: string) { super(message); this.name = "SupportConflict"; } }
type TicketRow = { _id: Types.ObjectId; reference: string; customerName: string; customerEmail: string; category: string; status: SupportStatus; revision: number; notificationState: string; createdAt: Date; lastActivityAt: Date; lastResponseAt?: Date; resolvedAt?: Date };
type ActivityRow = { _id: Types.ObjectId; kind: string; body?: EncryptedSupportBody; fromStatus?: string; toStatus?: string; deliveryState?: string; createdAt: Date };
type OperationRow = { _id: Types.ObjectId; ticketId: Types.ObjectId; body: EncryptedSupportBody; recipient: string; recipientName: string; reference: string; state: "pending" | "sending" | "accepted" | "failed" | "uncertain"; claimedAt?: Date; providerMessageId?: string };
const idOk = (value: string) => /^[0-9a-f]{24}$/i.test(value);
const operationOk = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{16,64}$/i.test(value);
const statusOk = (value: unknown): value is SupportStatus => typeof value === "string" && (statuses as readonly string[]).includes(value) && value !== "all";
const viewTicket = (row: TicketRow) => ({ id: String(row._id), reference: row.reference, name: row.customerName, email: row.customerEmail, category: row.category, status: row.status, revision: row.revision, notificationState: row.notificationState, createdAt: row.createdAt.toISOString(), lastActivityAt: row.lastActivityAt.toISOString(), lastResponseAt: row.lastResponseAt?.toISOString() ?? null, resolvedAt: row.resolvedAt?.toISOString() ?? null });
const viewActivity = (row: ActivityRow) => ({ id: String(row._id), kind: row.kind, body: row.body ? decryptSupportBody(row.body) : null, fromStatus: row.fromStatus ?? null, toStatus: row.toStatus ?? null, deliveryState: row.deliveryState ?? null, createdAt: row.createdAt.toISOString() });

export function parseSupportQuery(input: Record<string, string | string[] | undefined>): SupportQuery {
  const value = (key: string, max: number) => typeof input[key] === "string" && input[key]!.length <= max ? input[key]! : "";
  const status = value("status", 20) || "all"; const id = value("id", 24); const page = Number(value("page", 6) || "1");
  if (!(statuses as readonly string[]).includes(status) || (id && !idOk(id)) || !Number.isSafeInteger(page) || page < 1 || page > 100000) throw new SupportInputError("Invalid support ticket filters.");
  return { status: status as SupportQuery["status"], q: value("q", 120).trim(), id, page };
}

function activityFilter(ticketId: Types.ObjectId, before?: string) {
  if (!before) return { ticketId };
  const [at, id] = before.split("."); const date = new Date(Number(at));
  if (!idOk(id) || !Number.isFinite(+date)) throw new SupportInputError("Invalid conversation history link.");
  return { ticketId, $or: [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: new Types.ObjectId(id) } }] };
}
export async function readSupportActivities(ticketId: string, before?: string) {
  if (!idOk(ticketId)) throw new SupportInputError("Invalid support ticket.");
  const rows = await SupportTicketActivity.find(activityFilter(new Types.ObjectId(ticketId), before)).sort({ createdAt: -1, _id: -1 }).limit(activitySize + 1).lean() as unknown as ActivityRow[];
  const visible = rows.slice(0, activitySize); const last = visible.at(-1);
  return { activities: visible.reverse().map(viewActivity), older: rows.length > activitySize && last ? `${+last.createdAt}.${last._id}` : null };
}

export async function readSupportTickets(query: SupportQuery) {
  const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = { ...(query.status !== "all" ? { status: query.status } : {}), ...(query.q ? { $or: [{ customerName: { $regex: escaped, $options: "i" } }, { customerEmailKey: { $regex: escaped, $options: "i" } }, { reference: { $regex: `^${escaped}`, $options: "i" } }] } : {}) };
  const [rows, total, counts, selected] = await Promise.all([SupportTicket.find(filter).sort({ lastActivityAt: -1, _id: -1 }).skip((query.page - 1) * pageSize).limit(pageSize).lean(), SupportTicket.countDocuments(filter), SupportTicket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]), query.id ? SupportTicket.findById(query.id).lean() : null]);
  const count = new Map(counts.map(item => [item._id, item.count])); const selectedView = selected ? viewTicket(selected as unknown as TicketRow) : null;
  const history = selectedView ? await readSupportActivities(selectedView.id) : null;
  return { rows: (rows as unknown as TicketRow[]).map(viewTicket), total, page: query.page, pageSize, counts: { new: count.get("new") ?? 0, open: count.get("open") ?? 0, awaiting_reply: count.get("awaiting_reply") ?? 0, resolved: count.get("resolved") ?? 0 }, selected: selectedView ? { ...selectedView, ...history! } : null };
}

function responseState(row: OperationRow) {
  if (row.state === "sending" && row.claimedAt && Date.now() - +row.claimedAt > sendingStaleMs) return "uncertain" as const;
  return row.state;
}
export async function readSupportOperation(ticketId: string, operationId: string) {
  if (!idOk(ticketId) || !operationOk(operationId)) throw new SupportInputError("Invalid response operation.");
  const row = await SupportResponseOperation.findOne({ ticketId: new Types.ObjectId(ticketId), operationId }).lean() as unknown as OperationRow | null;
  return row ? { state: responseState(row), operationId } : null;
}

export async function mutateSupportTicket(cookie: string, body: Record<string, unknown>) {
  const id = typeof body.id === "string" && idOk(body.id) ? body.id : ""; const revision = typeof body.revision === "number" && Number.isSafeInteger(body.revision) ? body.revision : -1;
  if (!id || revision < 0 || typeof body.action !== "string") throw new SupportInputError("Invalid support ticket update.");
  return withFreshAdminMutation(cookie, async (actor, session) => {
    const ticket = await SupportTicket.findById(id).session(session).lean() as unknown as TicketRow | null;
    if (!ticket || ticket.revision !== revision) throw new SupportConflict("This ticket changed. Reload before updating it.");
    const now = new Date();
    if (body.action === "status" && statusOk(body.status) && supportStatusTransition(ticket.status, body.status)) {
      const updated = await SupportTicket.updateOne({ _id: ticket._id, revision }, { $set: { status: body.status, lastActivityAt: now, ...(body.status === "resolved" ? { resolvedAt: now } : {}) }, ...(body.status === "open" ? { $unset: { resolvedAt: 1 } } : {}), $inc: { revision: 1 } }, { session });
      if (!updated.modifiedCount) throw new SupportConflict("This ticket changed. Reload before updating it.");
      await SupportTicketActivity.create([{ ticketId: ticket._id, kind: "status_change", actorId: actor, fromStatus: ticket.status, toStatus: body.status, createdAt: now, updatedAt: now }], { session }); await auditAdmin("support.status", actor, id, session); return { state: body.status };
    }
    if (body.action === "note" && typeof body.note === "string" && body.note.trim().length > 0 && body.note.trim().length <= 4000) {
      const updated = await SupportTicket.updateOne({ _id: ticket._id, revision }, { $set: { lastActivityAt: now }, $inc: { revision: 1 } }, { session }); if (!updated.modifiedCount) throw new SupportConflict("This ticket changed. Reload before updating it.");
      await SupportTicketActivity.create([{ ticketId: ticket._id, kind: "internal_note", actorId: actor, body: encryptSupportBody(body.note.trim()), createdAt: now, updatedAt: now }], { session }); await auditAdmin("support.note", actor, id, session); return { state: "noted" as const };
    }
    throw new SupportInputError("This support ticket update is not allowed.");
  });
}

export async function sendSupportResponse(cookie: string, body: Record<string, unknown>) {
  const id = typeof body.id === "string" && idOk(body.id) ? body.id : ""; const operationId = operationOk(body.operationId) ? body.operationId : ""; const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!id || !operationId || message.length < 1 || message.length > 4000) throw new SupportInputError("Enter a support response between 1 and 4,000 characters.");
  const replyTo = process.env.SUPPORT_INBOX_EMAIL?.trim().toLowerCase(); if (!replyTo || !/^\S+@\S+\.\S+$/.test(replyTo)) throw new SupportInputError("Support reply routing is unavailable.");
  const prior = await SupportResponseOperation.findOne({ ticketId: new Types.ObjectId(id), operationId }).lean() as unknown as OperationRow | null;
  if (prior) {
    if (decryptSupportBody(prior.body) !== message) throw new SupportConflict("This response operation belongs to different content.");
    await validateAdminSession(cookie, true);
    return { state: responseState(prior), operationId };
  }
  const stored = await withFreshAdminMutation(cookie, async (actor, session) => {
    const ticket = await SupportTicket.findById(id).session(session).lean() as unknown as TicketRow | null; if (!ticket) throw new SupportInputError("That ticket is unavailable."); if (ticket.status !== "open" && ticket.status !== "awaiting_reply") throw new SupportInputError("Open this ticket before sending a response.");
    const existing = await SupportResponseOperation.findOne({ ticketId: ticket._id, operationId }).session(session).lean() as unknown as OperationRow | null;
    if (existing) { if (existing.recipient !== ticket.customerEmail || decryptSupportBody(existing.body) !== message) throw new SupportConflict("This response operation belongs to different content."); return existing; }
    const created = (await SupportResponseOperation.create([{ ticketId: ticket._id, operationId, body: encryptSupportBody(message), recipient: ticket.customerEmail, recipientName: ticket.customerName, reference: ticket.reference, state: "pending" }], { session }))[0].toObject() as unknown as OperationRow;
    await auditAdmin("support.response", actor, id, session); return created;
  });
  if (stored.state !== "pending") return { state: responseState(stored), operationId };
  const claimed = await SupportResponseOperation.findOneAndUpdate({ _id: stored._id, state: "pending" }, { $set: { state: "sending", claimedAt: new Date() } }, { new: true }).lean() as unknown as OperationRow | null;
  if (!claimed) return (await readSupportOperation(id, operationId)) ?? { state: "uncertain" as const, operationId };
  let result: Awaited<ReturnType<typeof sendTransactionalEmail>>;
  try { result = await sendTransactionalEmail({ recipient: claimed.recipient, ...renderSupportReply({ name: claimed.recipientName, reference: claimed.reference, message: decryptSupportBody(claimed.body) }), replyTo: { email: replyTo, name: "Abii Support" } }); }
  catch { result = { ok: false, status: 0, error: "Network request failed or timed out." }; }
  if (!result.ok) { const state = result.status === 0 || result.status >= 500 ? "uncertain" as const : "failed" as const; try { await withRequiredTransaction(async session => { const changed = await SupportResponseOperation.updateOne({ _id: claimed._id, state: "sending" }, { $set: { state, error: result.error } }, { session }); if (!changed.modifiedCount) return; await SupportTicketActivity.create([{ ticketId: claimed.ticketId, kind: "delivery", operationId, deliveryState: state }], { session }); }); } catch { return { state: "uncertain" as const, operationId }; } return { state, operationId }; }
  try {
    const finalState = await withFreshAdminMutation(cookie, async (_actor, session) => {
      const accepted = await SupportResponseOperation.updateOne({ _id: claimed._id, state: "sending" }, { $set: { state: "accepted", providerMessageId: result.messageId } }, { session });
      if (!accepted.modifiedCount) {
        const current = await SupportResponseOperation.findById(claimed._id).session(session).lean() as unknown as OperationRow | null;
        return current ? responseState(current) : "uncertain" as const;
      }
      await SupportTicketActivity.create([{ ticketId: claimed.ticketId, kind: "admin_response", body: claimed.body, operationId }, { ticketId: claimed.ticketId, kind: "delivery", operationId, deliveryState: "accepted", providerMessageId: result.messageId }], { session, ordered: true });
      const ticket = await SupportTicket.findById(id).session(session).lean() as unknown as TicketRow | null; if (!ticket) throw new SupportConflict("The ticket was removed before the response could be recorded."); const now = new Date();
      await SupportTicket.updateOne({ _id: ticket._id }, { $set: { lastActivityAt: now, lastResponseAt: now, ...(ticket.status === "open" ? { status: "awaiting_reply" } : {}) }, $inc: { revision: 1 } }, { session });
      return "accepted" as const;
    }); return { state: finalState, operationId };
  } catch { return { state: "uncertain" as const, operationId }; }
}
