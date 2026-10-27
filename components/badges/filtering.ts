import type { BadgeCategory, BadgeRarity } from "@/lib/badges/types";
import type { BadgePageItem } from "./types";

export type BadgeStatusFilter = "all" | "unlocked" | "locked";
export type BadgeRarityFilter = "all" | BadgeRarity;
export type BadgeCategoryFilter = "all" | BadgeCategory;

export function filterBadges(badges: readonly BadgePageItem[], status: BadgeStatusFilter, rarity: BadgeRarityFilter, category: BadgeCategoryFilter) {
  return badges.filter((badge) =>
    (status === "all" || badge.unlocked === (status === "unlocked")) &&
    (rarity === "all" || badge.rarity === rarity) &&
    (category === "all" || badge.category === category),
  );
}

export function countBadgeStatuses(badges: readonly BadgePageItem[], rarity: BadgeRarityFilter, category: BadgeCategoryFilter) {
  const filtered = badges.filter((badge) => (rarity === "all" || badge.rarity === rarity) && (category === "all" || badge.category === category));
  const unlocked = filtered.filter((badge) => badge.unlocked).length;
  return { all: filtered.length, unlocked, locked: filtered.length - unlocked };
}
