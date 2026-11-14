import { Award, BookMarked, BookOpenCheck, CalendarCheck, ChartNoAxesCombined, Flame, Heart, ShieldCheck, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import type { NotificationType } from "@/lib/notifications/contracts";

export const NOTIFICATION_PRESENTATION = {
  flashcards_due: { label: "Flashcards Due for Review", icon: BookOpenCheck, description: "A reminder when flashcards are ready for review." },
  study_streak: { label: "Study Streak Reminders", icon: Flame, description: "A gentle nudge to keep your study rhythm going." },
  badge_unlocked: { label: "Badge Achievements", icon: Award, description: "Celebrate badges you earn along the way." },
  unfinished_quiz: { label: "Unfinished Quiz Reminders", icon: BookMarked, description: "A reminder when a quiz is waiting for you." },
  daily_study_reminder: { label: "Daily Study Reminder", icon: CalendarCheck, description: "Choose a local time for a daily study reminder." },
  weekly_progress: { label: "Weekly Progress Summary", icon: ChartNoAxesCombined, description: "A weekly look at your learning progress." },
  study_inactivity: { label: "Study Inactivity Reminders", icon: Heart, description: "A supportive note after a break from studying." },
  account_security: { label: "Account & Security", icon: ShieldCheck, description: "Important updates about your account." },
  whats_new: { label: "What's New in Abii", icon: Sparkles, description: "Hear about useful changes to Abii." },
  quiz_milestone: { label: "Quiz Milestones", icon: Trophy, description: "Mark meaningful quiz achievements." },
} satisfies Record<NotificationType, { label: string; icon: LucideIcon; description: string }>;

export const NOTIFICATION_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "reminders", label: "Reminders" },
  { id: "achievements", label: "Achievements" },
  { id: "system", label: "System" },
] as const;

export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number]["id"];

export function formatUnreadCount(count: number | null): string {
  if (count === null || count < 1) return "";
  return count > 99 ? "99+" : String(count);
}

