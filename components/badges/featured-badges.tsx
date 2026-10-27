"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Pencil, RotateCw } from "lucide-react";
import { BadgeDetailsModal } from "./badge-details-modal";
import { BadgeSelectionModal } from "./badge-selection-modal";
import { FeaturedBadgeCard } from "./featured-badge-card";
import type { FeaturedBadgeShowcase, BadgeShowcaseSurface } from "./featured-types";
import type { BadgePageItem } from "./types";
import type { BadgeId } from "@/lib/badges/types";
import { useToast } from "@/components/ui/toast-provider";

async function readShowcase(surface: BadgeShowcaseSurface): Promise<FeaturedBadgeShowcase> {
  const response = await fetch(`/api/badges/featured?surface=${surface}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload.earnedBadges) || !Array.isArray(payload.featuredBadges)) throw new Error(payload.error || "Your earned badges could not be loaded. Please try again.");
  return payload as FeaturedBadgeShowcase;
}

const EMPTY_BADGE_IDS: BadgeId[] = [];

export function FeaturedBadges({ surface, initialShowcase, initialError = false }: { surface: BadgeShowcaseSurface; initialShowcase: FeaturedBadgeShowcase | null; initialError?: boolean }) {
  const [showcase, setShowcase] = useState(initialShowcase);
  const [loadError, setLoadError] = useState(initialError ? "Your badges could not be loaded." : "");
  const [loading, setLoading] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [detailsBadge, setDetailsBadge] = useState<BadgePageItem | null>(null);
  const { toast } = useToast();
  const dashboard = surface === "dashboard";
  const title = dashboard ? "My Achievements" : "Achievement Showcase";
  const subtitle = dashboard ? "Celebrate the milestones you've earned along the way." : "Display the accomplishments you're most proud of.";
  const showcaseName = dashboard ? "Dashboard" : "Progress";

  async function refresh() {
    setLoading(true);
    try {
      const fresh = await readShowcase(surface);
      setShowcase(fresh);
      setLoadError("");
      return fresh;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your badges could not be loaded. Please try again.";
      setLoadError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function customize() {
    setSelectionOpen(true);
    try { await refresh(); }
    catch { /* Keep the last verified list available and show the retry inside the modal. */ }
  }

  async function saveSelection(ids: string[]) {
    const response = await fetch("/api/badges/featured", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface, badgeIds: ids }),
    });
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.badgeIds)) throw new Error(payload.error || "Your selection could not be saved. Please try again.");
    const savedIds = payload.badgeIds as BadgeId[];
    setShowcase((current) => {
      if (!current) return current;
      const earnedById = new Map(current.earnedBadges.map((badge) => [badge.id, badge]));
      return { ...current, badgeIds: savedIds as FeaturedBadgeShowcase["badgeIds"], customized: true, featuredBadges: savedIds.flatMap((id) => earnedById.has(id) ? [earnedById.get(id)!] : []) };
    });
    setLoadError("");
    setSelectionOpen(false);
    toast({ kind: "success", title: "Showcase updated", message: `Your ${showcaseName.toLowerCase()} badges have been saved.` });
  }

  return <section aria-labelledby={`${surface}-featured-title`} className="min-w-0 rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5">
    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F5] text-[#E9577D]"><Award aria-hidden="true" className="h-[19px] w-[19px]" /></span>
        <div className="min-w-0"><h2 id={`${surface}-featured-title`} className="text-base font-semibold tracking-[-0.025em] text-[#2F2930] sm:text-lg">{title}</h2><p className="mt-0.5 text-[11px] leading-4 text-[#756B72] sm:text-xs">{subtitle}</p></div>
      </div>
      <button type="button" onClick={() => void customize()} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#F2C8D5] bg-white px-3 py-2 text-xs font-semibold text-[#C65380] transition hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"><Pencil aria-hidden="true" className="h-3.5 w-3.5" />Customize</button>
    </div>

    {loadError && !showcase ? <div role="alert" className="rounded-xl border border-[#F0C7D3] bg-[#FFF8FA] p-4"><p className="text-xs leading-5 text-[#8A4D62]">{loadError}</p><button type="button" onClick={() => void refresh().catch(() => {})} disabled={loading} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[#C65380] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-60">{loading ? <RotateCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <RotateCw aria-hidden="true" className="h-3.5 w-3.5" />}{loading ? "Loading…" : "Try again"}</button></div>
      : showcase?.earnedBadges.length === 0 ? <div className="rounded-xl border border-dashed border-[#E8DDE2] bg-[#FFFAFC] px-4 py-6 text-center"><p className="text-sm font-semibold text-[#183653]">Your first achievement is waiting</p><p className="mt-1 text-xs leading-5 text-[#756B72]">Earn a badge as you study, then feature it here.</p><Link href="/badges" className="mt-3 inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold text-[#C65380] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Explore Badges</Link></div>
      : showcase?.featuredBadges.length ? <div className="grid min-w-0 grid-cols-1 gap-2.5 min-[390px]:grid-cols-2 xl:grid-cols-3">{showcase.featuredBadges.map((badge) => <FeaturedBadgeCard key={badge.id} badge={badge} onSelect={setDetailsBadge} />)}</div>
      : <div className="rounded-xl bg-[#FFF8FA] px-4 py-6 text-center"><p className="text-sm font-semibold text-[#183653]">No badges selected</p><p className="mt-1 text-xs leading-5 text-[#756B72]">Choose up to three earned badges to feature on your {showcaseName.toLowerCase()}.</p></div>}

    <div className="mt-3 flex justify-end"><Link href="/badges" className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-[#E9577D] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">View All Badges <span aria-hidden="true" className="ml-1">→</span></Link></div>

    {selectionOpen && <BadgeSelectionModal surface={surface} earnedBadges={showcase?.earnedBadges ?? []} selectedIds={showcase?.badgeIds ?? EMPTY_BADGE_IDS} loadError={loadError} loading={loading} onRetry={() => void refresh().catch(() => {})} onClose={() => setSelectionOpen(false)} onSave={saveSelection} />}
    <BadgeDetailsModal badge={detailsBadge} onClose={() => setDetailsBadge(null)} />
  </section>;
}
