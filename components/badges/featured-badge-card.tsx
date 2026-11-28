"use client";

import { BadgeImage } from "./badge-image";
import { RarityIndicator } from "./rarity-indicator";
import type { BadgePageItem } from "./types";

export function FeaturedBadgeCard({ badge, onSelect }: { badge: BadgePageItem; onSelect: (badge: BadgePageItem) => void }) {
  return <button type="button" onClick={() => onSelect(badge)} aria-haspopup="dialog" aria-label={`${badge.name}, unlocked. View achievement details.`} className="group flex h-full min-h-[88px] w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition hover:border-border hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2 motion-reduce:transition-none sm:min-h-[106px] sm:gap-3.5 sm:p-3.5">
    <span className="flex aspect-square w-14 shrink-0 items-center justify-center sm:w-[68px]"><BadgeImage badgeId={badge.id} unlocked alt={`${badge.name} unlocked badge`} className="h-full w-full transition-transform duration-200 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none" /></span>
    <span className="min-w-0 flex-1">
      <span className="block break-words text-xs font-bold leading-5 text-foreground sm:text-sm">{badge.name}</span>
      <span className="mt-1 block"><RarityIndicator rarity={badge.rarity} /></span>
      {badge.unlockedAt && <span className="mt-1 block text-[10px] leading-4 text-muted">Earned {new Date(badge.unlockedAt).toLocaleDateString()}</span>}
    </span>
  </button>;
}
