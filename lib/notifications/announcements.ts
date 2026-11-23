import "server-only";
import { Types, type ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { AnnouncementReceipt, receiptOwnerIndex } from "@/models/Announcement";
import { Notification } from "@/models/Notification";
import { activeOrdinaryAccount, ordinaryRoleFilter, User } from "@/models/User";
import { validateNotificationInput } from "./service";
import { validateNotificationTarget } from "./contracts";

export interface WhatsNewAnnouncement { id: string; title: string; message: string; target?: string | null }
export type AnnouncementPublicationResult =
  | { mode: "dry-run"; eligibleRecipients: number }
  | { mode: "published"; eligibleRecipients: number; created: number; alreadyExists: number; suppressed: number; failed: number };

export const announcementBatchSize = 100;
const maxBatchSize = 500;
const operationMs = 3500;
export const managedPublicationId = (id: string) => `admin.${id}`;

function validatedInput(value: WhatsNewAnnouncement) {
  if (!value || typeof value.id !== "string" || !/^(?:[a-z0-9_-]{1,64}|admin\.[a-f0-9]{24})$/i.test(value.id)) {
    throw new TypeError("Announcement ID must contain 1 to 64 letters, numbers, underscores, or hyphens.");
  }
  return validateNotificationInput({
    type: "whats_new", title: value.title, message: value.message, dedupeKey: `whats-new:${value.id}`,
    target: validateNotificationTarget(value.target), metadata: { announcementId: value.id },
  });
}

function audience(cutoff: Date, eligibleOnly: boolean) {
  return {
    ...(eligibleOnly ? activeOrdinaryAccount : ordinaryRoleFilter),
    emailVerifiedAt: { $lte: cutoff },
    $expr: { $and: [
      ordinaryRoleFilter.$expr,
      { $eq: [{ $type: "$emailVerifiedAt" }, "date"] },
      ...(eligibleOnly ? [
        { $in: [{ $type: "$suspendedAt" }, ["missing", "null"]] },
        { $or: [{ $eq: ["$settings.notifications.whats_new", true] }, { $eq: [{ $type: "$settings.notifications.whats_new" }, "missing"] }] },
      ] : []),
    ] },
  };
}

export async function estimateAnnouncementAudience(now = new Date()) {
  await connectToDatabase();
  const count = await User.countDocuments(audience(now, true)).maxTimeMS(operationMs);
  return { count, calculatedAt: now.toISOString() };
}

export async function audienceBoundary(session?: ClientSession) {
  const query = User.findOne({ _id: { $type: "objectId" } }).sort({ _id: -1 }).select("_id").maxTimeMS(operationMs);
  if (session) query.session(session);
  return (await query.lean())?._id ?? null;
}

export async function countAnnouncementCandidates(cutoff: Date, through: Types.ObjectId | null, session: ClientSession) {
  if (!through) return 0;
  return User.countDocuments({ ...audience(cutoff, false), _id: { $lte: through } }).session(session).maxTimeMS(operationMs);
}

export async function requireAnnouncementDeliveryStorage() {
  const { connection } = await connectToDatabase();
  const [notifications, receipts] = await Promise.all([
    connection.db!.collection(Notification.collection.name).listIndexes({ timeoutMS: operationMs }).toArray(),
    connection.db!.collection(AnnouncementReceipt.collection.name).listIndexes({ timeoutMS: operationMs }).toArray(),
  ]);
  const standard = (candidate: typeof notifications[number]) =>
    !candidate.sparse && !candidate.partialFilterExpression && !candidate.hidden && (!candidate.collation || candidate.collation.locale === "simple");
  if (!notifications.some(index => standard(index) && index.unique && Object.keys(index.key).join(",") === "userId,dedupeKey" &&
      index.key.userId === 1 && index.key.dedupeKey === 1) ||
      !receipts.some(index => index.name === "_id_" && index.key._id === 1) ||
      !receipts.some(index => standard(index) && index.name === receiptOwnerIndex && index.key.userId === 1 && Object.keys(index.key).length === 1)) {
    throw new Error("Announcement delivery indexes are unavailable.");
  }
}

export async function announcementRecipients(cutoff: Date, through: Types.ObjectId | null, cursor: Types.ObjectId | null,
  limit: number, options: { session?: ClientSession; eligibleOnly?: boolean } = {}) {
  if (!through) return [];
  const query = User.find({ ...audience(cutoff, options.eligibleOnly === true),
    _id: { $lte: through, ...(cursor ? { $gt: cursor } : {}) } }).select("_id").sort({ _id: 1 }).limit(limit).maxTimeMS(operationMs);
  if (options.session) query.session(options.session);
  return (await query.lean()).map(row => row._id);
}

/** Write a whole page inside the caller's transaction, including its eventual cursor checkpoint. */
export async function deliverAnnouncementPage(value: WhatsNewAnnouncement, recipients: Types.ObjectId[], cutoff: Date, session: ClientSession) {
  if (!session.inTransaction() || recipients.length > maxBatchSize) throw new Error("Delivery requires a bounded transaction.");
  const input = validatedInput(value);
  const receiptId = (userId: Types.ObjectId) => `${value.id}:${userId.toHexString()}`;
  const history = await AnnouncementReceipt.find({ _id: { $in: recipients.map(receiptId) } }).select("_id").session(session).maxTimeMS(operationMs).lean();
  const known = new Set(history.map(row => row._id));
  const outstanding = recipients.filter(id => !known.has(receiptId(id)));
  const filter = { ...audience(cutoff, true), _id: { $in: outstanding } };
  const eligible = (await User.find(filter).select("_id").session(session).maxTimeMS(operationMs).lean()).map(row => row._id);
  if (eligible.length === 0) return { created: 0, alreadyExists: known.size, suppressed: outstanding.length };

  // The account write serializes with opt-outs, suspension and account erasure.
  const fenced = await User.updateMany({ ...filter, _id: { $in: eligible } },
    { $inc: { announcementDeliveryVersion: 1 } }, { session, timestamps: false, maxTimeMS: operationMs });
  if (fenced.matchedCount !== eligible.length) throw new Error("Audience changed during delivery.");
  const inbox = await Notification.find({ userId: { $in: eligible }, dedupeKey: input.dedupeKey })
    .select("userId").session(session).maxTimeMS(operationMs).lean();
  const previouslyInInbox = new Set(inbox.map(row => String(row.userId)));
  const toCreate = eligible.filter(id => !previouslyInInbox.has(String(id)));
  if (toCreate.length) await Notification.insertMany(toCreate.map(userId => ({ ...input, userId })), { session });
  await AnnouncementReceipt.insertMany(eligible.map(userId => ({ _id: receiptId(userId), userId })), { session });
  return { created: toCreate.length, alreadyExists: known.size + previouslyInInbox.size, suppressed: outstanding.length - eligible.length };
}

/** CLI-compatible preview or publication using the same deletion-safe delivery page as the admin queue. */
export async function publishWhatsNewAnnouncement(options: { announcement: WhatsNewAnnouncement; apply: boolean; batchSize?: number }): Promise<AnnouncementPublicationResult> {
  const { announcement } = options;
  if (typeof announcement?.id === "string" && /^admin\./i.test(announcement.id)) throw new TypeError("Announcement IDs starting with admin. are reserved for the admin workspace.");
  validatedInput(announcement);
  const batchSize = options.batchSize ?? announcementBatchSize;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > maxBatchSize) throw new RangeError(`Announcement batch size must be between 1 and ${maxBatchSize}.`);
  const cutoff = new Date();
  const eligibleRecipients = (await estimateAnnouncementAudience(cutoff)).count;
  if (!options.apply) return { mode: "dry-run", eligibleRecipients };
  await requireAnnouncementDeliveryStorage();
  const through = await audienceBoundary();
  const result = { mode: "published" as const, eligibleRecipients, created: 0, alreadyExists: 0, suppressed: 0, failed: 0 };
  let cursor: Types.ObjectId | null = null;
  for (;;) {
    const recipients = await announcementRecipients(cutoff, through, cursor, batchSize, { eligibleOnly: true });
    if (recipients.length === 0) break;
    cursor = recipients[recipients.length - 1];
    try {
      const page = await withRequiredTransaction(session => deliverAnnouncementPage(announcement, recipients, cutoff, session));
      result.created += page.created;
      result.alreadyExists += page.alreadyExists;
      result.suppressed += page.suppressed;
    } catch {
      // No commit was confirmed. A rerun reconciles against receipts and inbox rows.
      result.failed += recipients.length;
    }
  }
  return result;
}
