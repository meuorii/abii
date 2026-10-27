import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { BADGE_CATALOG } from "@/lib/badges/catalog";
import { getBadgeImagePath } from "@/lib/badges/images";
import { reconcileUserBadges } from "@/lib/badges/reconcile";
import { fetchEarnedBadges } from "@/lib/badges/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Authenticated read: evaluates verified server evidence and awards only qualifying badges. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to view achievements." }, { status: 401 });
  try {
    const reconciliation = await reconcileUserBadges(String(user._id));
    const byId = new Map(reconciliation.results.map((result) => [result.badgeId, result]));
    const earned = await fetchEarnedBadges(String(user._id));
    const earnedById = new Map(earned.map((record) => [record.badgeId, record]));
    return NextResponse.json({ badges: BADGE_CATALOG.map((definition) => {
      const evaluation = byId.get(definition.id)!;
      const award = earnedById.get(definition.id);
      const unlocked = Boolean(award);
      return { ...definition, ...evaluation, unlocked, alreadyEarned: unlocked, unlockedAt: award?.unlockedAt?.toISOString() ?? null, image: getBadgeImagePath(definition.id, unlocked) };
    }), reconciledAt: reconciliation.evaluatedAt.toISOString(), cached: reconciliation.cached });
  } catch (error) {
    console.error("Achievement reconciliation failed.", error);
    return NextResponse.json({ error: "Achievements could not be loaded. Please try again." }, { status: 503 });
  }
}
