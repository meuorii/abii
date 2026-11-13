import { Suspense } from "react";
import { getFeaturedBadgeShowcase } from "@/lib/badges/featured";
import { measureServerOperation } from "@/lib/performance/server-timing";
import type { BadgeShowcaseSurface } from "./featured-types";
import { FeaturedBadges } from "./featured-badges";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";

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
    <div aria-hidden="true" className="mb-4 flex items-center gap-2.5"><SkeletonBlock className="h-9 w-9 rounded-xl" /><div className="space-y-2"><SkeletonBlock className="h-4 w-36 rounded" /><SkeletonBlock className="h-3 w-56 max-w-full rounded" /></div></div>
    <div aria-hidden="true" className="grid grid-cols-1 gap-2.5 min-[390px]:grid-cols-2 xl:grid-cols-3"><SkeletonBlock className="h-24 rounded-xl" /><SkeletonBlock className="hidden h-24 rounded-xl min-[390px]:block" /></div>
  </SkeletonRegion>;
}

export function FeaturedBadgesStream({ surface, userId }: { surface: BadgeShowcaseSurface; userId: string }) {
  return <Suspense fallback={<FeaturedBadgesSkeleton surface={surface} />}><FeaturedBadgesContent surface={surface} userId={userId} /></Suspense>;
}
