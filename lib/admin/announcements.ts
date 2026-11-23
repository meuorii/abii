import "server-only";
import { Types } from "mongoose";
import { auditAdmin } from "@/lib/auth/admin-audit";
import { withFreshAdminMutation } from "@/lib/auth/admin-session-state";
import { openUsersToken, sealUsersToken } from "@/lib/admin/users-tokens";
import { audienceBoundary, countAnnouncementCandidates, estimateAnnouncementAudience, managedPublicationId, requireAnnouncementDeliveryStorage } from "@/lib/notifications/announcements";
import { announcementDeliveryEnabled, requireAnnouncementIndexes } from "@/lib/notifications/announcement-worker";
import { Announcement, announcementCreatedIndex, announcementUpdatedIndex, type AnnouncementDocument } from "@/models/Announcement";
import { announcementContent, publicationTime, AnnouncementInputError, type AnnouncementContent, type AnnouncementState, type AnnouncementView } from "./announcement-contract";

const ago = 5 * 60_000;
const pageSize = 20;
const issueStates = ["incomplete", "failed"] as const;
const publishStates = ["queued", "publishing", "delivered", ...issueStates] as const;
const filters = ["all", "draft", "scheduled", "published", "issues", "canceled"] as const;
export type AnnouncementQuery = { status: typeof filters[number]; q: string; sort: "updated" | "created"; page: string; id: string; editor: "new" | "edit" | "" };
export class AnnouncementConflict extends Error {}
export class AnnouncementDeliveryUnavailable extends Error {}
const idCheck = (input: unknown): input is string => typeof input === "string" && /^[0-9a-f]{24}$/.test(input);

export function parseAnnouncementQuery(input: Record<string, string | string[] | undefined>): AnnouncementQuery {
  function value(key: string, max: number) {
    const raw = input[key];
    if (raw === undefined) return "";
    if (typeof raw !== "string" || raw.length > max) throw new AnnouncementInputError("An announcement filter is invalid.");
    return raw;
  }
  const status = value("status", 15) || "all";
  const sort = value("sort", 10) || "updated";
  const id = value("id", 24);
  const editor = value("editor", 4);
  if (!(filters as readonly string[]).includes(status) || (sort !== "updated" && sort !== "created") ||
      (id && !idCheck(id)) || (editor !== "" && editor !== "new" && (editor !== "edit" || !id))) {
    throw new AnnouncementInputError("An announcement filter is invalid.");
  }
  return { status: status as AnnouncementQuery["status"], sort, id, editor, q: value("q", 120).trim(), page: value("page", 1024) };
}

function view(row: AnnouncementDocument & { _id: Types.ObjectId }): AnnouncementView {
  const date = (value?: Date | null) => value?.toISOString() ?? null;
  return {
    id: String(row._id), publicationId: managedPublicationId(String(row._id)), state: row.state, revision: row.revision,
    author: row.author, title: row.title, message: row.message, target: announcementContent(row).target,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), scheduledAt: date(row.scheduledAt), committedAt: date(row.committedAt),
    completedAt: date(row.completedAt), lastAttemptAt: date(row.lastAttemptAt), lastAction: row.lastAction,
    estimate: row.estimate ? { count: row.estimate.count, calculatedAt: row.estimate.calculatedAt.toISOString() } : null,
    remainingEstimate: row.state === "delivered" ? 0 : row.candidateTotal == null ? null :
      Math.max(0, row.candidateTotal - row.delivered - row.suppressed),
    delivered: row.delivered, previouslyCompleted: row.previouslyCompleted, suppressed: row.suppressed, unresolved: row.pending ?? null,
    attemptCount: row.attemptCount, retries: row.retries, deliveryError: row.deliveryError,
  };
}

const projection = "-titleKey -lease -nextRunAt -cutoffId -cursor";
export async function readAnnouncements(query: AnnouncementQuery) {
  await requireAnnouncementIndexes();
  const field = query.sort === "created" ? "createdAt" : "updatedAt";
  const context = JSON.stringify(["announcements", query.q, query.sort, query.status]);
  const anchor = query.page ? openUsersToken(query.page, context) as { id?: unknown; at?: unknown } | null : null;
  if (query.page && (!anchor || !idCheck(anchor.id) || typeof anchor.at !== "number" || !Number.isFinite(anchor.at))) {
    throw new AnnouncementInputError("That page link is no longer valid. Return to the first page.");
  }
  const state = query.status === "published" ? { $in: publishStates } : query.status === "issues" ? { $in: issueStates } : query.status;
  const lower = query.q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchId = query.q.replace(/^admin\./i, "").toLowerCase();
  const filter = {
    ...(state !== "all" ? { state } : {}),
    ...(query.q ? idCheck(searchId) ? { _id: new Types.ObjectId(searchId) } : { titleKey: { $regex: `^${lower}` } } : {}),
    ...(anchor ? { $or: [{ [field]: { $lt: new Date(anchor.at as number) } },
      { [field]: new Date(anchor.at as number), _id: { $lt: new Types.ObjectId(anchor.id as string) } }] } : {}),
  };
  const list = await Announcement.find(filter).sort({ [field]: -1, _id: -1 }).hint(query.sort === "created" ? announcementCreatedIndex : announcementUpdatedIndex)
    .limit(pageSize + 1).select(projection).maxTimeMS(2500).lean();
  const grouped = await Announcement.aggregate<{ _id: AnnouncementState; count: number }>([{ $group: { _id: "$state", count: { $sum: 1 } } }]).option({ maxTimeMS: 2500 });
  const tallies = new Map(grouped.map(row => [row._id, row.count]));
  const sum = (keys: readonly AnnouncementState[]) => keys.reduce((count, key) => count + (tallies.get(key) ?? 0), 0);
  const selected = query.id ? await Announcement.findById(query.id).select(projection).maxTimeMS(2500).lean() : null;
  const rows = list.slice(0, pageSize);
  const last = rows.at(-1);
  return {
    rows: rows.map(view), selected: selected ? view(selected) : null,
    counts: { drafts: sum(["draft"]), scheduled: sum(["scheduled"]), published: sum(publishStates), issues: sum(issueStates) },
    next: last && list.length > pageSize ? sealUsersToken({ id: String(last._id), at: +last[field] }, context) : null,
  };
}
export type AnnouncementDirectory = Awaited<ReturnType<typeof readAnnouncements>>;

const contentContext = (content: AnnouncementContent) => JSON.stringify(["announcements-audience", content]);
export async function previewAnnouncement(content: AnnouncementContent) {
  const estimate = await estimateAnnouncementAudience();
  return { estimate, confirmation: sealUsersToken(estimate, contentContext(content)) };
}

const editableStates = ["draft", "scheduled", "canceled"] as const;
type Command =
  | { action: "save" | "schedule" | "publish"; id: string; revision: number | null; content: AnnouncementContent; scheduledAt?: Date; estimate?: { count: number; calculatedAt: Date } }
  | { action: "cancel" | "retry"; id: string; revision: number };

export function parseAnnouncementCommand(body: Record<string, unknown>, now = new Date()): Command {
  const { action, id, revision } = body;
  if (!idCheck(id) || (revision !== null && (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0))) {
    throw new AnnouncementInputError("Invalid announcement revision.");
  }
  if (action === "cancel" || action === "retry") {
    if (revision === null || body.confirmed !== true || Object.keys(body).some(key => !["action", "id", "revision", "confirmed"].includes(key))) {
      throw new AnnouncementInputError("Confirm this change before continuing.");
    }
    return { action, id, revision };
  }
  if ((action !== "save" && action !== "schedule" && action !== "publish") || Object.keys(body).some(key =>
    !["action", "id", "revision", "title", "message", "target", "scheduledAt", "confirmation", "confirmed"].includes(key))) {
    throw new AnnouncementInputError("Invalid announcement action.");
  }
  const content = announcementContent(body);
  if (action === "save") return { action, id, revision, content };
  const proof = typeof body.confirmation === "string" ? openUsersToken(body.confirmation, contentContext(content)) as { count?: unknown; calculatedAt?: unknown } | null : null;
  const at = new Date(typeof proof?.calculatedAt === "string" ? proof.calculatedAt : "");
  if (body.confirmed !== true || !proof || typeof proof.count !== "number" || !Number.isSafeInteger(proof.count) ||
      proof.count < 0 || !(+at <= +now && +now - +at <= ago)) {
    throw new AnnouncementInputError("Refresh the audience preview and confirm this publication.");
  }
  const scheduledAt = action === "schedule" ? publicationTime(body.scheduledAt, now) : undefined;
  return { action, id, revision, content, scheduledAt, estimate: { count: proof.count, calculatedAt: at } };
}

export async function mutateAnnouncement(rawAdminCookie: string, command: Command, now = new Date()) {
  await requireAnnouncementIndexes();
  if (command.action === "schedule" || command.action === "publish" || command.action === "retry") {
    if (!announcementDeliveryEnabled()) throw new AnnouncementDeliveryUnavailable("Announcement delivery is disabled for this deployment.");
    try { await requireAnnouncementDeliveryStorage(); }
    catch { throw new AnnouncementDeliveryUnavailable("Announcement delivery storage is unavailable."); }
  }
  const id = new Types.ObjectId(command.id);
  const result = await withFreshAdminMutation(rawAdminCookie, async (actor, session) => {
    const old = await Announcement.findById(id).session(session).maxTimeMS(2500).lean();
    if (command.revision === null ? old !== null : old?.revision !== command.revision) return null;
    if (!("content" in command)) {
      if (!old || (command.action === "cancel" ? old.state !== "scheduled" : !issueStates.some(status => status === old.state))) return null;
      const retry = command.action === "retry";
      const row = await Announcement.findOneAndUpdate({ _id: id, revision: command.revision }, {
        $set: retry ? { state: "queued", nextRunAt: now, lastAction: "Delivery retry authorized" }
          : { state: "canceled", lastAction: "Schedule canceled" },
        $unset: retry ? { lease: 1 } : { nextRunAt: 1 },
        $inc: { revision: 1, ...(retry ? { retries: 1 } : {}) },
      }, { new: true, session, maxTimeMS: 2500 }).lean();
      if (row) await auditAdmin(retry ? "announcement.retry" : "announcement.cancel", actor, command.id, session);
      return row;
    }

    if (old && (!editableStates.some(status => status === old.state) || (command.action === "save" && old.state === "scheduled"))) return null;
    if (command.action === "schedule" && (!command.scheduledAt || command.scheduledAt <= now)) return null;
    const state = command.action === "schedule" ? "scheduled" : command.action === "publish" ? "queued" : "draft";
    const scheduleAction = old?.state === "scheduled" ? "announcement.reschedule" : "announcement.schedule";
    const audit = command.action === "publish" ? "announcement.publish" : command.action === "schedule" ? scheduleAction : old ? "announcement.edit" : "announcement.create";
    const lastAction = command.action === "publish" ? "Publication committed" : command.action === "schedule" ?
      old?.state === "scheduled" ? "Schedule updated" : "Schedule created" : old ? "Draft updated" : "Draft created";
    const cutoffId = command.action === "publish" ? await audienceBoundary(session) : null;
    const fields = { ...command.content, titleKey: command.content.title.toLowerCase(), state, lastAction,
      ...(command.action === "publish" ? { committedAt: now, cutoffId, candidateTotal: await countAnnouncementCandidates(now, cutoffId, session), nextRunAt: now, estimate: command.estimate }
        : command.action === "schedule" ? { scheduledAt: command.scheduledAt, nextRunAt: command.scheduledAt, estimate: command.estimate } : {}) };
    const row = old ? await Announcement.findOneAndUpdate({ _id: id, revision: command.revision }, {
      $set: fields, $inc: { revision: 1 },
      ...(command.action === "save" ? { $unset: { scheduledAt: 1, estimate: 1 } } : {}),
    }, { new: true, session, runValidators: true, maxTimeMS: 2500 }).lean()
      : (await Announcement.create([{ _id: id, author: actor, ...fields }], { session }))[0].toObject();
    if (row) {
      if (!old && audit !== "announcement.create") await auditAdmin("announcement.create", actor, command.id, session);
      await auditAdmin(audit, actor, command.id, session);
    }
    return row;
  }, { fresh: command.action !== "save" });
  if (!result) throw new AnnouncementConflict("This announcement changed or is no longer editable. Reload its saved state.");
  return view(result);
}

