import "server-only";
import { BADGE_BY_ID } from "./catalog";
import { getBadgeImagePath } from "./images";
import { fetchEarnedBadges, recordAchievementEvent } from "./repository";
import { reconcileUserBadges } from "./reconcile";
import { getSubjectMastery } from "@/lib/quiz/service";
import type { BadgeId, BadgeRarity } from "./types";

export type NewlyUnlockedBadge = { badgeId: BadgeId; name: string; rarity: BadgeRarity; unlockedAt: Date; imagePath: string };

/** Recheck verified server-side metrics after a successful persisted learning action. */
export async function evaluateAffectedBadges(userId: string): Promise<NewlyUnlockedBadge[]> {
  const reconciled = await reconcileUserBadges(userId, { force: true, source: "live" });
  if (!reconciled.newlyAwardedBadgeIds.length) return [];
  const earned = await fetchEarnedBadges(userId);
  const byId = new Map(earned.map((badge) => [badge.badgeId, badge]));
  return reconciled.newlyAwardedBadgeIds.flatMap((badgeId) => {
    const record = byId.get(badgeId);
    const definition = BADGE_BY_ID[badgeId];
    return record ? [{ badgeId, name: definition.name, rarity: definition.rarity, unlockedAt: record.unlockedAt, imagePath: getBadgeImagePath(badgeId, true) }] : [];
  });
}

/** Persist each achieved subject threshold once, using the shared quiz mastery calculation. */
export async function refreshMasteryMilestones(userId: string, occurredAt = new Date()): Promise<void> {
  const mastery = await getSubjectMastery(userId);
  for (const [subjectId, stats] of mastery.bySubject) {
    if (stats.totalRequirements <= 0 || stats.total <= 0) continue;
    const percent = stats.completedRequirements / stats.totalRequirements * 100;
    for (const threshold of [25, 50, 75, 100] as const) {
      if (percent < threshold) continue;
      await recordAchievementEvent(userId, {
        idempotencyKey: `mastery-milestone:${subjectId}:${threshold}`,
        kind: "mastery-milestone", occurredAt, subjectId, masteryPercent: percent, masteryThreshold: threshold,
      });
    }
  }
}

