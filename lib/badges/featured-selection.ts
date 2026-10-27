import { BADGE_BY_ID } from "./catalog";
import type { BadgeId } from "./types";

export function defaultFeaturedBadgeIds(records: readonly { badgeId: string; unlockedAt: Date | string }[], limit = 3): BadgeId[] {
  return records
    .filter((record): record is { badgeId: BadgeId; unlockedAt: Date | string } => Object.hasOwn(BADGE_BY_ID, record.badgeId))
    .slice()
    .sort((a, b) => {
      const dateDifference = new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
      return dateDifference || BADGE_BY_ID[a.badgeId].order - BADGE_BY_ID[b.badgeId].order || a.badgeId.localeCompare(b.badgeId);
    })
    .slice(0, Math.max(0, Math.min(3, Math.floor(limit))))
    .map((record) => record.badgeId);
}
