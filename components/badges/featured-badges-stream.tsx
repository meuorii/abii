import { Suspense } from "react";
import { getFeaturedBadgeShowcase } from "@/lib/badges/featured";
import { measureServerOperation } from "@/lib/performance/server-timing";
import type { BadgeShowcaseSurface } from "./featured-types";
import { FeaturedBadges } from "./featured-badges";
import { SkeletonRegion } from "@/components/ui/skeleton";
import { FeaturedBadgesSkeletonContent } from "./featured-badges-skeleton-content";

async function FeaturedBadgesContent({ surface, userId }: { surface: BadgeShowcaseSurface; userId: string }) {
  try {
    const showcase = await measureServerOperation(`${surface} badge retrieval`, () => getFeaturedBadgeShowcase(userId, surface));
    return <FeaturedBadges surface={surface} initialShowcase={showcase} />;
  } catch {
    return <FeaturedBadges surface={surface} initialShowcase={null} initialError />;
  }
}

function FeaturedBadgesSkeleton({ surface }: { surface: BadgeShowcaseSurface }) {
  const title = surface === "dashboard" ? "My Achievements" : "Achievement Showcase";
  return <SkeletonRegion label={`Loading ${title}`} className="min-w-0 rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5">
    <FeaturedBadgesSkeletonContent />
  </SkeletonRegion>;
}

export function FeaturedBadgesStream({ surface, userId }: { surface: BadgeShowcaseSurface; userId: string }) {
  return <Suspense fallback={<FeaturedBadgesSkeleton surface={surface} />}><FeaturedBadgesContent surface={surface} userId={userId} /></Suspense>;
}
