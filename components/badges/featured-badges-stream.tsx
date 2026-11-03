import { Suspense } from "react";
import { getFeaturedBadgeShowcase } from "@/lib/badges/featured";
import { measureServerOperation } from "@/lib/performance/server-timing";
import type { BadgeShowcaseSurface } from "./featured-types";
import { FeaturedBadges } from "./featured-badges";

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
  return <section aria-label={title} aria-busy="true" className="min-w-0 animate-pulse rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2.5"><span className="h-9 w-9 rounded-xl bg-[#FFF0F5]" /><div className="space-y-2"><div className="h-4 w-36 rounded bg-[#F5E8ED]" /><div className="h-3 w-56 max-w-full rounded bg-[#FAF1F4]" /></div></div>
    <div className="grid grid-cols-1 gap-2.5 min-[390px]:grid-cols-2 xl:grid-cols-3"><div className="h-24 rounded-xl bg-[#FFFAFC]" /><div className="hidden h-24 rounded-xl bg-[#FFFAFC] min-[390px]:block" /></div>
  </section>;
}

export function FeaturedBadgesStream({ surface, userId }: { surface: BadgeShowcaseSurface; userId: string }) {
  return <Suspense fallback={<FeaturedBadgesSkeleton surface={surface} />}><FeaturedBadgesContent surface={surface} userId={userId} /></Suspense>;
}
