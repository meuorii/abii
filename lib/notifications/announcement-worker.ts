import "server-only";
import { randomUUID } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { auditAdmin, requireAdminAuditStorage } from "@/lib/auth/admin-audit";
import {
  announcementBatchSize, announcementRecipients, audienceBoundary, countAnnouncementCandidates, deliverAnnouncementPage,
  managedPublicationId, requireAnnouncementDeliveryStorage,
} from "@/lib/notifications/announcements";
import { Announcement, announcementQueueIndex } from "@/models/Announcement";

const leaseMs = 90_000;
const steps = 8;

export function announcementDeliveryEnabled() {
  return process.env.ABII_ANNOUNCEMENTS_DELIVERY_ENABLED === "true";
}

export async function requireAnnouncementIndexes() {
  const { connection } = await connectToDatabase();
  const indexes = await connection.db!.collection(Announcement.collection.name).listIndexes({ timeoutMS: 3500 }).toArray();
  for (const [keys, options] of Announcement.schema.indexes()) {
    if (!indexes.some(index => index.name === options.name && !index.hidden && !index.sparse && !index.partialFilterExpression &&
      (!index.collation || index.collation.locale === "simple") && JSON.stringify(index.key) === JSON.stringify(keys))) {
      throw new Error("Announcement workspace indexes are not ready.");
    }
  }
}

async function claim(now: Date, id?: Types.ObjectId) {
  return withRequiredTransaction(async session => {
    const ready = { state: { $in: ["scheduled", "queued", "publishing"] },
      nextRunAt: { $type: "date", $lte: now }, ...(id ? { _id: id } : {}) };
    const row = await Announcement.findOne(ready).sort({ nextRunAt: 1, _id: 1 }).hint(announcementQueueIndex)
      .session(session).maxTimeMS(3500).lean();
    if (!row) return null;
    const lease = randomUUID();
    const initial = row.state === "scheduled";
    const committedAt = initial ? now : row.committedAt;
    if (!committedAt) throw new Error("Publication boundary is missing.");
    const cutoffId = initial ? await audienceBoundary(session) : row.cutoffId ?? null;
    const candidateTotal = initial ? await countAnnouncementCandidates(now, cutoffId, session) : row.candidateTotal;
    const leased = await Announcement.findOneAndUpdate({ _id: row._id, revision: row.revision }, {
      $set: { state: "publishing", lease, nextRunAt: new Date(+now + leaseMs), lastAttemptAt: now,
        ...(initial ? { committedAt, cutoffId, candidateTotal, lastAction: "Scheduled publication committed" } : {}) },
      $inc: { attemptCount: 1, revision: 1 },
    }, { new: true, session, maxTimeMS: 3500 }).lean();
    if (!leased) return null;
    if (initial) await auditAdmin("announcement.publish", row.author, String(row._id), session);
    return leased;
  }, { timeoutMS: 12_000 });
}

/** One lease per publication. A failed page keeps its cursor and can be replayed as a unit. */
export async function runDueAnnouncements(options: {
  id?: string; now?: Date; budgetMs?: number; maxPages?: number; batchSize?: number;
} = {}) {
  const started = Date.now();
  const budget = options.budgetMs ?? 32_000;
  const pageLimit = options.maxPages ?? steps;
  const size = options.batchSize ?? announcementBatchSize;
  if (!Number.isInteger(size) || size < 1 || size > 500) throw new RangeError("Invalid delivery batch size.");
  await requireAnnouncementIndexes();
  await requireAnnouncementDeliveryStorage();
  await requireAdminAuditStorage();
  const now = () => options.now ?? new Date();
  let job = await claim(now(), options.id ? new Types.ObjectId(options.id) : undefined);
  if (!job) return "idle";
  const cutoff = job.committedAt!;
  const id = job._id;
  const lease = job.lease;
  const fence = { _id: id, lease, state: "publishing" };
  let pending: number | null = null;
  const input = { id: managedPublicationId(String(id)), title: job.title, message: job.message, target: job.target };
  try {
    for (let index = 0; index < pageLimit && (index === 0 ? Date.now() - started < budget : Date.now() - started + 8000 < budget); index++) {
      const cursor = job.cursor ?? null;
      const checkpoint = await withRequiredTransaction(async (session: ClientSession) => {
        const recipients = await announcementRecipients(cutoff, job?.cutoffId ?? null, cursor, size, { session });
        pending = recipients.length || null;
        const page = recipients.length ? await deliverAnnouncementPage(input, recipients, cutoff, session) : { created: 0, alreadyExists: 0, suppressed: 0 };
        const done = recipients.length < size;
        const updated = await Announcement.findOneAndUpdate(fence, {
          $set: done ? { state: "delivered", completedAt: now(), deliveryError: false }
            : { cursor: recipients.at(-1), nextRunAt: new Date(+now() + leaseMs), deliveryError: false },
          $unset: { pending: 1, ...(done ? { nextRunAt: 1, lease: 1, cursor: 1, cutoffId: 1 } : {}) },
          $inc: { delivered: page.created + page.alreadyExists, previouslyCompleted: page.alreadyExists, suppressed: page.suppressed },
        }, { session, new: true, maxTimeMS: 3500 }).lean();
        if (!updated) throw new Error("Publication lease was superseded.");
        return updated;
      }, { timeoutMS: 12_000 });
      job = checkpoint;
      pending = null;
      if (job.state === "delivered") return "delivered";
    }
    await Announcement.updateOne(fence, { $set: { state: "queued", nextRunAt: now() }, $unset: { lease: 1 } }, { maxTimeMS: 3500 });
    return "queued";
  } catch {
    // Compare the last confirmed cursor too, so an ambiguous commit cannot overwrite its progress.
    await Announcement.updateOne({ ...fence, cursor: job.cursor ?? null }, {
      $set: { state: job.delivered > 0 ? "incomplete" : "failed", deliveryError: true, pending },
      $unset: { lease: 1, nextRunAt: 1 },
    }, { maxTimeMS: 3500 });
    return "interrupted";
  }
}
