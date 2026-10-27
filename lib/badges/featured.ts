import "server-only";
import { BADGE_CATALOG } from "./catalog";
import { getBadgeImagePath } from "./images";
import { defaultFeaturedBadgeIds } from "./featured-selection";
import { fetchEarnedBadges, fetchFeaturedBadgeSelections } from "./repository";
import { reconcileUserBadges } from "./reconcile";
import type { BadgeId } from "./types";
import type { BadgePageItem } from "@/components/badges/types";
import type { BadgeShowcaseSurface, FeaturedBadgeShowcase } from "@/components/badges/featured-types";

/** Reconcile authenticated account evidence, then return only persisted awards and its saved selection. */
export async function getFeaturedBadgeShowcase(userId: string, surface: BadgeShowcaseSurface): Promise<FeaturedBadgeShowcase> {
  const reconciliation = await reconcileUserBadges(userId);
  const [earnedRecords, selections] = await Promise.all([fetchEarnedBadges(userId), fetchFeaturedBadgeSelections(userId)]);
  const earnedById = new Map(earnedRecords.map((record) => [record.badgeId, record]));
  const evaluationById = new Map(reconciliation.results.map((result) => [result.badgeId, result]));
  const earnedBadges: BadgePageItem[] = BADGE_CATALOG.flatMap((definition) => {
    const award = earnedById.get(definition.id);
    if (!award) return [];
    const evaluation = evaluationById.get(definition.id);
    if (!evaluation) return [];
    return [{
      ...definition,
      ...evaluation,
      unlocked: true,
      alreadyEarned: true,
      unlockedAt: award.unlockedAt.toISOString(),
      image: getBadgeImagePath(definition.id, true),
    }];
  });
  const customized = surface === "dashboard" ? selections.dashboardCustomized : selections.progressCustomized;
  const storedIds = (surface === "dashboard" ? selections.dashboard : selections.progress) as BadgeId[];
  const earnedIds = new Set(earnedBadges.map((badge) => badge.id));
  const badgeIds = (customized ? storedIds.filter((id) => earnedIds.has(id)) : defaultFeaturedBadgeIds(earnedRecords)).slice(0, 3);
  const badgesById = new Map(earnedBadges.map((badge) => [badge.id, badge]));
  return { surface, badgeIds, customized, earnedBadges, featuredBadges: badgeIds.flatMap((id) => badgesById.has(id) ? [badgesById.get(id)!] : []) };
}
