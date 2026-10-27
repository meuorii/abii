import type { BadgeId } from "@/lib/badges/types";
import type { BadgePageItem } from "./types";

export type BadgeShowcaseSurface = "dashboard" | "progress";
export type FeaturedBadgeShowcase = {
  surface: BadgeShowcaseSurface;
  badgeIds: BadgeId[];
  customized: boolean;
  earnedBadges: BadgePageItem[];
  featuredBadges: BadgePageItem[];
};
