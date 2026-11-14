import { BADGE_BY_ID } from "@/lib/badges/catalog";
import type { BadgeId } from "@/lib/badges/types";
import type { CreateNotificationInput } from "./contracts";

export const QUIZ_MILESTONE_THRESHOLDS = [1, 5, 10, 25, 50, 100] as const;
export type QuizMilestoneThreshold = (typeof QUIZ_MILESTONE_THRESHOLDS)[number];
export type AccountSecurityEvent = "password_changed" | "password_reset" | "email_verified";

export function badgeUnlockedTemplate(badgeId: BadgeId): Omit<CreateNotificationInput, "dedupeKey"> {
  const badge = BADGE_BY_ID[badgeId];
  return { type: "badge_unlocked", title: "You unlocked a new badge!", message: `Amazing work! You earned ${badge.name}. Keep up the great progress!`, target: "/badges", metadata: { badgeId } };
}

export function quizMilestoneTemplate(threshold: QuizMilestoneThreshold): CreateNotificationInput {
  const copy: Record<QuizMilestoneThreshold, { title: string; message: string }> = {
    1: { title: "Your first quiz is complete!", message: "You did it! Every practice session is a step toward remembering more." },
    5: { title: "5 quizzes completed!", message: "You have completed 5 quizzes with Abii. Keep building your recall, one session at a time." },
    10: { title: "10 quizzes completed!", message: "Look at your progress! You've completed 10 quizzes with Abii." },
    25: { title: "A new study milestone!", message: "25 completed quizzes! Your consistency is making a difference." },
    50: { title: "50 quizzes completed!", message: "You've completed 50 quizzes with Abii. Your practice is adding up." },
    100: { title: "100 quizzes completed!", message: "You've completed 100 quizzes with Abii. That's a remarkable amount of practice." },
  };
  return { type: "quiz_milestone", ...copy[threshold], target: "/progress", metadata: { count: threshold }, dedupeKey: `quiz-milestone:${threshold}` };
}

export function accountSecurityTemplate(event: AccountSecurityEvent, operationId: string): CreateNotificationInput {
  const copy: Record<AccountSecurityEvent, { title: string; message: string }> = {
    password_changed: { title: "Your password was changed", message: "Your Abii account password was successfully updated." },
    password_reset: { title: "Your password was reset", message: "Your Abii account password was reset successfully." },
    email_verified: { title: "Email successfully verified", message: "Your email address has been verified. Your Abii account is ready!" },
  };
  return { type: "account_security", ...copy[event], target: "/settings", dedupeKey: `account-security:${event}:${operationId}` };
}
