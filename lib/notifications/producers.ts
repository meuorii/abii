import "server-only";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { AchievementEvent } from "@/models/AchievementEvent";
import type { UserBadgeDocument } from "@/models/UserBadge";
import { createNotification, type CreateNotificationResult } from "./service";
import type { CreateNotificationInput } from "./contracts";
import { accountSecurityTemplate, badgeUnlockedTemplate, QUIZ_MILESTONE_THRESHOLDS, quizMilestoneTemplate, type AccountSecurityEvent } from "./templates";
import type { BadgeId } from "@/lib/badges/types";

export type NotificationProducerStatus = CreateNotificationResult["status"] | "failed" | "not_live_award" | "not_verified" | "not_milestone";

function logFailure(userId: string, input: CreateNotificationInput, error: unknown): void {
  const mongoCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "number" ? error.code : undefined;
  console.error("Notification producer failed.", {
    userId,
    type: input.type,
    eventKey: input.dedupeKey,
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(mongoCode === undefined ? {} : { mongoCode }),
  });
}

async function persistEventNotification(userId: string, input: CreateNotificationInput): Promise<NotificationProducerStatus> {
  try {
    const result = await createNotification(userId, input);
    return result.status;
  } catch (error) {
    logFailure(userId, input, error);
    return "failed";
  }
}

/** Only the badge service's confirmed unique insert result is eligible for this producer. */
export async function notifyLiveBadgeAward(userId: string, award: { record: Pick<UserBadgeDocument, "badgeId" | "source">; created: boolean }): Promise<NotificationProducerStatus> {
  if (!award.created || award.record.source !== "live") return "not_live_award";
  const badgeId = award.record.badgeId as BadgeId;
  const template = badgeUnlockedTemplate(badgeId);
  return persistEventNotification(userId, { ...template, dedupeKey: `badge-unlocked:${badgeId}` });
}

/** Create a milestone only for a newly transitioned session with durable completion ledger evidence. */
export async function notifyQuizMilestoneForCompletion(userId: string, sessionId: string): Promise<NotificationProducerStatus> {
  const input: CreateNotificationInput = { type: "quiz_milestone", title: "Quiz milestone", message: "A quiz milestone was reached.", dedupeKey: `quiz-milestone:session:${sessionId}` };
  try {
    if (!mongoose.isObjectIdOrHexString(userId) || !mongoose.isObjectIdOrHexString(sessionId)) return "not_verified";
    await connectToDatabase();
    const owner = new mongoose.Types.ObjectId(userId);
    const eventKey = `quiz-completed:${sessionId}`;
    const verified = await AchievementEvent.findOne({ userId: owner, kind: "quiz-completed", idempotencyKey: eventKey }).select("occurredAt").lean();
    if (!verified) return "not_verified";
    // Count through this event's verified completion time, so a later completion that commits
    // before this callback cannot move an earlier threshold past its milestone.
    const completedCount = await AchievementEvent.countDocuments({ userId: owner, kind: "quiz-completed", occurredAt: { $lte: verified.occurredAt } });
    if (!(QUIZ_MILESTONE_THRESHOLDS as readonly number[]).includes(completedCount)) return "not_milestone";
    return persistEventNotification(userId, quizMilestoneTemplate(completedCount as (typeof QUIZ_MILESTONE_THRESHOLDS)[number]));
  } catch (error) {
    logFailure(userId, input, error);
    return "failed";
  }
}

/** Account security producers receive only trusted operation identities, never passwords or reset grants. */
export async function notifyAccountSecurityChange(userId: string, event: AccountSecurityEvent, operationId: string): Promise<NotificationProducerStatus> {
  const validOperationId = typeof operationId === "string" && operationId.length > 0 && operationId.length <= 120 && /^[a-z0-9:_-]+$/i.test(operationId);
  if (!validOperationId) return "not_verified";
  return persistEventNotification(userId, accountSecurityTemplate(event, operationId));
}
