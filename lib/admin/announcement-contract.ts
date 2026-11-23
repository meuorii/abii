import { validateNotificationTarget } from "@/lib/notifications/contracts";

export const announcementStates = ["draft", "scheduled", "queued", "publishing", "delivered", "incomplete", "failed", "canceled"] as const;
export type AnnouncementState = typeof announcementStates[number];
export const announcementLabels: Record<AnnouncementState, string> = {
  draft: "Draft", scheduled: "Scheduled", queued: "Queued", publishing: "Publishing",
  delivered: "Delivered", incomplete: "Partially delivered", failed: "Failed", canceled: "Canceled",
};
export const announcementDestinations = {
  "/dashboard": "Dashboard", "/subjects": "My Subjects", "/review": "Review", "/progress": "Progress", "/badges": "Badges", "/settings": "Settings",
} as const;
export type AnnouncementTarget = keyof typeof announcementDestinations;
export const announcementAudience = "verified-learners" as const;
export type AnnouncementContent = { title: string; message: string; target: AnnouncementTarget | null };
export type AudienceEstimate = { count: number; calculatedAt: string };
export type AnnouncementView = AnnouncementContent & {
  id: string; publicationId: string; state: AnnouncementState; revision: number; author: string;
  updatedAt: string; createdAt: string; scheduledAt: string | null; committedAt: string | null;
  completedAt: string | null; lastAttemptAt: string | null; lastAction: string;
  estimate: AudienceEstimate | null; delivered: number; previouslyCompleted: number; suppressed: number;
  remainingEstimate: number | null; unresolved: number | null; attemptCount: number; retries: number; deliveryError: boolean;
};

export class AnnouncementInputError extends Error {}

export function announcementContent(value: Record<string, unknown>): AnnouncementContent {
  if (typeof value.title !== "string" || !value.title.trim() || value.title.trim().length > 120) {
    throw new AnnouncementInputError("Enter a title between 1 and 120 characters.");
  }
  if (typeof value.message !== "string" || !value.message.trim() || value.message.trim().length > 500) {
    throw new AnnouncementInputError("Enter a message between 1 and 500 characters.");
  }
  const target = value.target === "" || value.target === null || value.target === undefined ? null : value.target;
  if (target !== null && (typeof target !== "string" || !Object.hasOwn(announcementDestinations, target))) {
    throw new AnnouncementInputError("Choose an approved learner destination.");
  }
  return { title: value.title.trim(), message: value.message.trim(), target: validateNotificationTarget(target) as AnnouncementTarget | null };
}

export function publicationTime(value: unknown, now: Date): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new AnnouncementInputError("Choose a valid date and time in UTC.");
  }
  const result = new Date(value + ":00.000Z");
  if (!Number.isFinite(+result) || result.toISOString().slice(0, 16) !== value || +result <= +now) {
    throw new AnnouncementInputError("Choose a valid UTC time in the future.");
  }
  return result;
}
