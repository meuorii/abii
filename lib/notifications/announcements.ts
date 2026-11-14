import "server-only";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createNotification } from "./service";
import { validateNotificationTarget, type CreateNotificationInput } from "./contracts";

export interface WhatsNewAnnouncement {
  id: string;
  title: string;
  message: string;
  target?: string | null;
}

export type AnnouncementPublicationResult =
  | { mode: "dry-run"; eligibleRecipients: number }
  | { mode: "published"; eligibleRecipients: number; created: number; alreadyExists: number; suppressed: number; failed: number };

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const WRITE_CONCURRENCY = 8;

function validateAnnouncement(announcement: WhatsNewAnnouncement): WhatsNewAnnouncement {
  if (!announcement || typeof announcement !== "object" || typeof announcement.id !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(announcement.id)) throw new TypeError("Announcement ID must contain 1 to 64 letters, numbers, underscores, or hyphens.");
  if (typeof announcement.title !== "string" || !announcement.title.trim() || announcement.title.trim().length > 120) throw new TypeError("Announcement title must contain 1 to 120 characters.");
  if (typeof announcement.message !== "string" || !announcement.message.trim() || announcement.message.trim().length > 500) throw new TypeError("Announcement message must contain 1 to 500 characters.");
  const target = validateNotificationTarget(announcement.target);
  return { id: announcement.id, title: announcement.title.trim(), message: announcement.message.trim(), target };
}

function eligibleAccountFilter() {
  return {
    emailVerifiedAt: { $type: "date" },
    $or: [
      { "settings.notifications.whats_new": true },
      { "settings.notifications.whats_new": { $exists: false } },
    ],
  };
}

/**
 * Preview or explicitly publish a manually-authored announcement. Reruns are safe because every
 * recipient uses the account-scoped notification dedupe index; failures can be retried by rerunning.
 */
export async function publishWhatsNewAnnouncement(options: { announcement: WhatsNewAnnouncement; apply: boolean; batchSize?: number }): Promise<AnnouncementPublicationResult> {
  const announcement = validateAnnouncement(options.announcement);
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) throw new RangeError(`Announcement batch size must be between 1 and ${MAX_BATCH_SIZE}.`);
  await connectToDatabase();
  const filter = eligibleAccountFilter();
  const eligibleRecipients = await User.countDocuments(filter);
  if (!options.apply) return { mode: "dry-run", eligibleRecipients };

  const result = { mode: "published" as const, eligibleRecipients, created: 0, alreadyExists: 0, suppressed: 0, failed: 0 };
  const input: CreateNotificationInput = {
    type: "whats_new", title: announcement.title, message: announcement.message,
    dedupeKey: `whats-new:${announcement.id}`, target: announcement.target ?? null,
    metadata: { announcementId: announcement.id },
  };
  let afterId: mongoose.Types.ObjectId | undefined;
  for (;;) {
    const query = afterId ? { ...filter, _id: { $gt: afterId } } : filter;
    const recipients = await User.find(query).select("_id").sort({ _id: 1 }).limit(batchSize).lean();
    if (!recipients.length) break;
    afterId = recipients[recipients.length - 1]._id;
    for (let index = 0; index < recipients.length; index += WRITE_CONCURRENCY) {
      const group = recipients.slice(index, index + WRITE_CONCURRENCY);
      await Promise.all(group.map(async (recipient) => {
        try {
          const created = await createNotification(String(recipient._id), input);
          if (created.status === "created") result.created += 1;
          else if (created.status === "already_exists") result.alreadyExists += 1;
          else result.suppressed += 1;
        } catch (error) {
          result.failed += 1;
          console.error("Announcement recipient notification failed.", {
            announcementId: announcement.id,
            userId: String(recipient._id),
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
        }
      }));
    }
  }
  return result;
}
