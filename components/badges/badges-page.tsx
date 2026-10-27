"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Award, Check, RotateCw } from "lucide-react";
import { BADGE_CATEGORIES_METADATA } from "@/lib/badges/catalog";
import { RARITY_DEFINITIONS } from "@/lib/badges/images";
import { BadgeCard } from "./badge-card";
import { BadgeDetailsModal } from "./badge-details-modal";
import { RarityIndicator } from "./rarity-indicator";
import type { BadgePageData, BadgePageItem } from "./types";
import type { BadgeCategory, BadgeRarity } from "@/lib/badges/types";
import { countBadgeStatuses, filterBadges, type BadgeCategoryFilter, type BadgeRarityFilter, type BadgeStatusFilter } from "./filtering";

type StatusFilter = BadgeStatusFilter;
type RarityFilter = BadgeRarityFilter;
type CategoryFilter = BadgeCategoryFilter;

const rarityOrder: BadgeRarity[] = ["common", "uncommon", "rare", "legendary"];
const categoryOrder: BadgeCategory[] = ["getting-started", "study-consistency", "quiz-performance", "mastery"];
const EMPTY_BADGES: BadgePageItem[] = [];

function Statistics({ badges }: { badges: BadgePageItem[] }) {
  const total = badges.length;
  const unlocked = badges.filter((badge) => badge.unlocked).length;
  const locked = total - unlocked;
  const percent = total ? Math.round((unlocked / total) * 100) : 0;
  const stats = [
    { label: "Total Badges", value: total, icon: Award, detail: "in the collection" },
    { label: "Unlocked", value: unlocked, icon: Check, detail: "earned and verified" },
    { label: "Locked", value: locked, icon: AlertCircle, detail: "still to discover" },
    { label: "Collection", value: `${percent}%`, icon: Award, detail: "complete so far" },
  ];
  return <section aria-label="Achievement overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
    {stats.map(({ label, value, icon: Icon, detail }) => <div key={label} className="min-w-0 rounded-2xl border border-[#E8E2E5] bg-white p-3.5 shadow-[0_2px_10px_rgba(47,41,48,.035)] sm:p-4">
      <div className="flex items-center gap-2 text-[#D94E7B]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F4]"><Icon aria-hidden="true" className="h-4 w-4" /></span><p className="truncate text-xs font-semibold text-[#756B72] sm:text-sm">{label}</p></div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums leading-none text-[#183653] sm:text-3xl">{value}</p>
      <p className="mt-1.5 text-[11px] leading-4 text-[#8A7E85] sm:text-xs">{detail}</p>
    </div>)}
  </section>;
}

function CollectionProgress({ badges }: { badges: BadgePageItem[] }) {
  const total = badges.length;
  const unlocked = badges.filter((badge) => badge.unlocked).length;
  const percent = total ? Math.round((unlocked / total) * 100) : 0;
  return <section className="rounded-2xl border border-[#F3E5EA] bg-[#FFF8FA] p-4 sm:p-5" aria-labelledby="collection-progress-title">
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div><h2 id="collection-progress-title" className="text-base font-bold text-[#183653] sm:text-lg">Collection Progress</h2><p className="mt-1 text-xs text-[#756B72] sm:text-sm">Every step forward adds to your collection.</p></div>
      <p className="text-sm font-bold tabular-nums text-[#C65380]">{unlocked} of {total} badges <span className="ml-1 text-lg">{percent}%</span></p>
    </div>
    <div role="progressbar" aria-label="Badge collection completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${unlocked} of ${total} badges, ${percent}% complete`} className="mt-4 h-3 overflow-hidden rounded-full bg-white shadow-inner">
      <div className="h-full rounded-full bg-[#F15D8A] transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  </section>;
}

function RarityOverview({ badges }: { badges: BadgePageItem[] }) {
  return <section aria-label="Badge rarity overview" className="rounded-2xl border border-[#E8E2E5] bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-base font-bold text-[#183653]">Rarity Collection</h2><p className="mt-1 text-xs text-[#756B72]">Earn badges at every rarity level.</p></div></div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {rarityOrder.map((rarity) => {
        const group = badges.filter((badge) => badge.rarity === rarity);
        const earned = group.filter((badge) => badge.unlocked).length;
        return <div key={rarity} className="flex min-w-0 items-center justify-between gap-1.5 rounded-xl bg-[#FFF9FB] px-2.5 py-2 sm:px-3">
          <RarityIndicator rarity={rarity} />
          <span className="shrink-0 text-xs font-bold tabular-nums text-[#657B8E]">{earned}/{group.length}</span>
        </div>;
      })}
    </div>
  </section>;
}

export function BadgesPage({ initialData, initialError = false }: { initialData: BadgePageData | null; initialError?: boolean }) {
  const [data, setData] = useState<BadgePageData | null>(initialData);
  const [error, setError] = useState(initialError);
  const [retrying, setRetrying] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rarity, setRarity] = useState<RarityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedBadge, setSelectedBadge] = useState<BadgePageItem | null>(null);

  const badges = data?.badges ?? EMPTY_BADGES;
  const statusCounts = useMemo(() => countBadgeStatuses(badges, rarity, category), [badges, rarity, category]);
  const visibleBadges = useMemo(() => filterBadges(badges, status, rarity, category), [badges, status, rarity, category]);
  async function retry() {
    setRetrying(true);
    try {
      const response = await fetch("/api/badges", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.badges)) throw new Error(payload.error || "Achievements could not be loaded.");
      setData(payload as BadgePageData);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRetrying(false);
    }
  }

  const hasFilters = status !== "all" || rarity !== "all" || category !== "all";
  const clearFilters = () => { setStatus("all"); setRarity("all"); setCategory("all"); };

  return <div className="space-y-5">
    {error || !data ? <section role="alert" className="rounded-2xl border border-[#F0C7D3] bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#C65380]">A little hiccup</p>
      <h2 className="mt-2 text-xl font-semibold text-[#2F2930]">Your achievements couldn&apos;t load.</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#756B72]">Please try again. Your earned badges and learning progress are saved to your account.</p>
      <button type="button" disabled={retrying} onClick={() => void retry()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{retrying ? <RotateCw aria-hidden="true" className="h-4 w-4 animate-spin" /> : <RotateCw aria-hidden="true" className="h-4 w-4" />}{retrying ? "Trying again…" : "Try again"}</button>
    </section> : <>
      <Statistics badges={badges} />
      <CollectionProgress badges={badges} />
      <RarityOverview badges={badges} />

      <section aria-labelledby="badge-collection-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#C65380]">YOUR COLLECTION</p><h2 id="badge-collection-title" className="mt-1 text-xl font-bold text-[#183653] sm:text-2xl">Achievement Badges</h2></div>
          <p aria-live="polite" className="text-xs font-semibold text-[#756B72]">Showing {visibleBadges.length} of {badges.length} badges</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-[#E8E2E5] bg-white p-3.5 sm:p-4">
          <fieldset>
            <legend className="mb-2 text-xs font-bold text-[#657B8E]">Status</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by badge status">
              {(["all", "unlocked", "locked"] as const).map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-10 rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 ${status === value ? "border-[#E9577D] bg-[#FFF0F4] text-[#B93D6B]" : "border-[#E8E2E5] bg-white text-[#657B8E] hover:bg-[#FFF9FB]"}`}>{value === "all" ? "All" : value === "unlocked" ? "Unlocked" : "Locked"}<span className="ml-1.5 tabular-nums opacity-75">{statusCounts[value]}</span></button>)}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0"><span className="mb-1.5 block text-xs font-bold text-[#657B8E]">Rarity</span><select value={rarity} onChange={(event) => setRarity(event.target.value as RarityFilter)} className="min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3 text-sm text-[#3A515F] outline-none focus:border-[#E9577D] focus:ring-2 focus:ring-[#E9577D]/20"><option value="all">All Rarities</option>{rarityOrder.map((item) => <option key={item} value={item}>{RARITY_DEFINITIONS[item].label}</option>)}</select></label>
            <label className="block min-w-0"><span className="mb-1.5 block text-xs font-bold text-[#657B8E]">Category</span><select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)} className="min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3 text-sm text-[#3A515F] outline-none focus:border-[#E9577D] focus:ring-2 focus:ring-[#E9577D]/20"><option value="all">All Categories</option>{categoryOrder.map((item) => <option key={item} value={item}>{item === "mastery" ? "Mastery" : BADGE_CATEGORIES_METADATA[item].label}</option>)}</select></label>
          </div>
        </div>

        {visibleBadges.length ? <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {visibleBadges.map((badge) => <BadgeCard key={badge.id} badge={badge} onSelect={setSelectedBadge} />)}
        </div> : <div className="rounded-2xl border border-dashed border-[#E8DDE2] bg-[#FFFAFC] px-4 py-10 text-center">
          <h3 className="text-base font-bold text-[#183653]">No badges match these filters</h3><p className="mt-1 text-sm text-[#756B72]">Try a different status, rarity, or category.</p>
          {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 min-h-10 rounded-xl px-4 text-sm font-bold text-[#C65380] underline decoration-[#F1B9CB] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Clear filters</button>}
        </div>}
      </section>
    </>}
    <BadgeDetailsModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
  </div>;
}
