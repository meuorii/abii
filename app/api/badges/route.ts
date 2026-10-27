import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { BADGE_CATALOG } from "@/lib/badges/catalog";
import { getBadgeImagePath } from "@/lib/badges/images";
import { reconcileUserBadges } from "@/lib/badges/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Authenticated read: evaluates verified server evidence and awards only qualifying badges. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to view achievements." }, { status: 401 });
  try {
    const reconciliation = await reconcileUserBadges(String(user._id));
    const byId = new Map(reconciliation.results.map((result) => [result.badgeId, result]));
    return NextResponse.json({ badges: BADGE_CATALOG.map((definition) => {
      const evaluation = byId.get(definition.id)!;
      return { ...definition, ...evaluation, image: getBadgeImagePath(definition.id, evaluation.unlocked) };
    }), reconciledAt: reconciliation.evaluatedAt.toISOString(), cached: reconciliation.cached });
  } catch (error) {
    console.error("Achievement reconciliation failed.", error);
    return NextResponse.json({ error: "Achievements could not be loaded. Please try again." }, { status: 503 });
  }
}
