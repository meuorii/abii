import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BadgeHero } from "@/components/badges/badge-hero";
import { BadgesPage } from "@/components/badges/badges-page";
import type { BadgePageData } from "@/components/badges/types";
import { getCurrentUser } from "@/lib/auth/session";
import { BADGE_CATALOG } from "@/lib/badges/catalog";
import { getBadgeImagePath } from "@/lib/badges/images";
import { reconcileUserBadges } from "@/lib/badges/reconcile";
import { fetchEarnedBadges } from "@/lib/badges/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BadgesRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let initialData: BadgePageData | null = null;
  let initialError = false;
  try {
    const reconciliation = await reconcileUserBadges(String(user._id));
    const earned = await fetchEarnedBadges(String(user._id));
    const earnedById = new Map(earned.map((record) => [record.badgeId, record]));
    const evaluationById = new Map(reconciliation.results.map((result) => [result.badgeId, result]));
    initialData = {
      badges: BADGE_CATALOG.map((definition) => {
        const award = earnedById.get(definition.id);
        const evaluation = evaluationById.get(definition.id)!;
        const unlocked = Boolean(award);
        return { ...definition, ...evaluation, unlocked, alreadyEarned: unlocked, unlockedAt: award?.unlockedAt?.toISOString() ?? null, image: getBadgeImagePath(definition.id, unlocked) };
      }),
      reconciledAt: reconciliation.evaluatedAt.toISOString(),
      cached: reconciliation.cached,
    };
  } catch (error) {
    console.error("Badge page data could not be loaded.", error);
    initialError = true;
  }

  return <AppShell userName={user.name}>
    <div className="w-full min-w-0 p-4 pb-24 sm:p-6 sm:pb-6 xl:p-7">
      <BadgeHero />
      <BadgesPage initialData={initialData} initialError={initialError} />
    </div>
  </AppShell>;
}
