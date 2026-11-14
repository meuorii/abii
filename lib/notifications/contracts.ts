import { NotificationInputError } from "./errors";

export const NOTIFICATION_TYPES = [
  "flashcards_due", "study_streak", "badge_unlocked", "unfinished_quiz",
  "daily_study_reminder", "weekly_progress", "study_inactivity",
  "account_security", "whats_new", "quiz_milestone",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_GROUPS = {
  reminders: ["flashcards_due", "study_streak", "unfinished_quiz", "daily_study_reminder", "study_inactivity"],
  achievements: ["badge_unlocked", "quiz_milestone"],
  system: ["account_security", "whats_new"],
} as const satisfies Record<string, readonly NotificationType[]>;
export type NotificationGroup = keyof typeof NOTIFICATION_GROUPS;
export const OPTIONAL_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter((type) => type !== "account_security") as Exclude<NotificationType, "account_security">[];
export type NotificationPreferences = Record<NotificationType, boolean> & { dailyStudyTime: string | null };

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<NotificationType, boolean> = {
  flashcards_due: true, study_streak: true, badge_unlocked: true, unfinished_quiz: true,
  daily_study_reminder: false, weekly_progress: true, study_inactivity: false,
  account_security: true, whats_new: true, quiz_milestone: true,
};

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isValidStudyTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const preferences = {} as Record<NotificationType, boolean>;
  for (const type of NOTIFICATION_TYPES) {
    preferences[type] = type === "account_security" ? true : typeof record[type] === "boolean" ? record[type] : DEFAULT_NOTIFICATION_PREFERENCES[type];
  }
  return { ...preferences, dailyStudyTime: typeof record.dailyStudyTime === "string" && isValidStudyTime(record.dailyStudyTime) ? record.dailyStudyTime : null };
}

const SAFE_TARGETS = [
  /^\/(?:dashboard|subjects|review|progress|badges|settings)\/?$/,
  /^\/subjects\/[a-f\d]{24}(?:\/topics\/[a-f\d]{24})?\/?$/i,
  /^\/quiz\/[a-f\d]{24}\/resume\/?$/i,
];

export function validateNotificationTarget(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 512 || !value.startsWith("/") || value.startsWith("//") || /[%\\?#\u0000-\u001f]/.test(value)) {
    throw new NotificationInputError("Notification target must be a safe internal route.");
  }
  if (!SAFE_TARGETS.some((route) => route.test(value))) throw new NotificationInputError("Notification target must be an approved internal route.");
  return value;
}

export interface NotificationMetadata {
  subjectId?: string;
  topicId?: string;
  sessionId?: string;
  badgeId?: string;
  eventId?: string;
  announcementId?: string;
  count?: number;
  periodKey?: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  dedupeKey: string;
  target?: string | null;
  metadata?: NotificationMetadata;
  expiresAt?: Date | null;
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  target: string | null;
  metadata: NotificationMetadata;
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}


