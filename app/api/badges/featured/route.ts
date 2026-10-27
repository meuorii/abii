import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getFeaturedBadgeShowcase } from "@/lib/badges/featured";
import { updateFeaturedBadgeSelection } from "@/lib/badges/repository";
import type { BadgeShowcaseSurface } from "@/components/badges/featured-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSurface(value: unknown): value is BadgeShowcaseSurface {
  return value === "dashboard" || value === "progress";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to view featured badges." }, { status: 401 });
  const surface = new URL(request.url).searchParams.get("surface");
  if (!isSurface(surface)) return NextResponse.json({ error: "Choose Dashboard or Progress." }, { status: 400 });
  try {
    return NextResponse.json(await getFeaturedBadgeShowcase(String(user._id), surface));
  } catch (error) {
    console.error("Featured badges could not be loaded.", error);
    return NextResponse.json({ error: "Featured badges could not be loaded. Please try again." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to save featured badges." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Please check your badge selection and try again." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Please check your badge selection and try again." }, { status: 400 });
  const surface = (body as Record<string, unknown>).surface;
  const badgeIds = (body as Record<string, unknown>).badgeIds;
  if (!isSurface(surface)) return NextResponse.json({ error: "Choose Dashboard or Progress." }, { status: 400 });
  if (!Array.isArray(badgeIds) || badgeIds.some((id) => typeof id !== "string")) return NextResponse.json({ error: "Choose up to 3 unlocked badges." }, { status: 400 });
  try {
    const selections = await updateFeaturedBadgeSelection(String(user._id), surface, badgeIds as string[]);
    return NextResponse.json({ surface, badgeIds: selections[surface], customized: selections[`${surface}Customized`] });
  } catch (error) {
    if (error instanceof TypeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Featured badge selection could not be saved.", error);
    return NextResponse.json({ error: "Your badge selection could not be saved. Please try again." }, { status: 500 });
  }
}
