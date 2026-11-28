"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, Pencil, RotateCw } from "lucide-react";
import { BadgeDetailsModal } from "./badge-details-modal";
import { BadgeSelectionModal } from "./badge-selection-modal";
import { FeaturedBadgeCard } from "./featured-badge-card";
import type { FeaturedBadgeShowcase, BadgeShowcaseSurface } from "./featured-types";
import type { BadgePageItem } from "./types";
import type { BadgeId } from "@/lib/badges/types";
import { useToast } from "@/components/ui/toast-provider";
import { subscribeToAchievementActivity } from "@/lib/badges/client-sync";
import { ScrollReveal, StaggerItem } from "@/components/motion/scroll-reveal";

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
  const [detailsBadgeId, setDetailsBadgeId] = useState<BadgePageItem["id"] | null>(null);
  const detailsBadge = detailsBadgeId ? showcase?.earnedBadges.find((badge) => badge.id === detailsBadgeId) ?? null : null;
  const { toast } = useToast();
  const dashboard = surface === "dashboard";
  const title = dashboard ? "My Achievements" : "Achievement Showcase";
  const subtitle = dashboard ? "Celebrate the milestones you've earned along the way." : "Display the accomplishments you're most proud of.";
  const showcaseName = dashboard ? "Dashboard" : "Progress";

  const refresh = useCallback(async () => {
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
  }, [surface]);

  useEffect(() => {
    return subscribeToAchievementActivity(() => { void refresh().catch(() => {}); });
  }, [refresh]);

  useEffect(() => {
    setShowcase(initialShowcase);
    setLoadError(initialError ? "Your badges could not be loaded." : "");
  }, [initialShowcase, initialError]);

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
    toast({ kind: "success", title: "Badges Updated", message: `Your featured badges have been updated on the ${showcaseName}.` });
  }

  return <section aria-labelledby={`${surface}-featured-title`} className="min-w-0 rounded-[18px] border border-border bg-surface p-4 sm:p-5">
    <ScrollReveal className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary-surface text-primary"><Award aria-hidden="true" className="h-[19px] w-[19px]" /></span>
        <div className="min-w-0"><h2 id={`${surface}-featured-title`} className="text-base font-semibold tracking-[-0.025em] text-foreground sm:text-lg">{title}</h2><p className="mt-0.5 text-[11px] leading-4 text-muted sm:text-xs">{subtitle}</p></div>
      </div>
      <button type="button" onClick={() => void customize()} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-primary transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2"><Pencil aria-hidden="true" className="h-3.5 w-3.5" />Customize</button>
    </ScrollReveal>

    {loadError && !showcase ? <div role="alert" className="rounded-xl border border-border bg-background p-4"><p className="text-xs leading-5 text-error-text">{loadError}</p><button type="button" onClick={() => void refresh().catch(() => {})} disabled={loading} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:opacity-60">{loading ? <RotateCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <RotateCw aria-hidden="true" className="h-3.5 w-3.5" />}{loading ? "Loading…" : "Try again"}</button></div>
      : showcase?.earnedBadges.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center"><p className="text-sm font-semibold text-foreground">Your first achievement is waiting</p><p className="mt-1 text-xs leading-5 text-muted">Earn a badge as you study, then feature it here.</p><Link href="/badges" className="mt-3 inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">Explore Badges</Link></div>
      : showcase?.featuredBadges.length ? <div className={`grid min-w-0 items-stretch gap-2.5 ${dashboard ? "grid-cols-1" : "grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-3"}`}>{showcase.featuredBadges.map((badge, index) => <StaggerItem key={badge.id} index={index} className="h-full w-full"><FeaturedBadgeCard badge={badge} onSelect={(item) => setDetailsBadgeId(item.id)} /></StaggerItem>)}{dashboard && Array.from({ length: Math.max(0, 3 - showcase.featuredBadges.length) }, (_, index) => <div key={`available-${index}`} className="flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-border bg-background px-3 text-center text-[11px] leading-4 text-muted sm:min-h-[106px]">Choose another earned badge to fill this spot</div>)}</div>
      : <div className="rounded-xl bg-background px-4 py-6 text-center"><p className="text-sm font-semibold text-foreground">No badges selected</p><p className="mt-1 text-xs leading-5 text-muted">Choose up to three earned badges to feature on your {showcaseName.toLowerCase()}.</p></div>}

    <div className="mt-3 flex justify-end"><Link href="/badges" className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">View All Badges <span aria-hidden="true" className="ml-1">→</span></Link></div>

    {selectionOpen && <BadgeSelectionModal surface={surface} earnedBadges={showcase?.earnedBadges ?? []} selectedIds={showcase?.badgeIds ?? EMPTY_BADGE_IDS} loadError={loadError} loading={loading} onRetry={() => void refresh().catch(() => {})} onClose={() => setSelectionOpen(false)} onSave={saveSelection} />}
    <BadgeDetailsModal badge={detailsBadge} onClose={() => setDetailsBadgeId(null)} />
  </section>;
}
