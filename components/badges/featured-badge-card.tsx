"use client";

import { BadgeImage } from "./badge-image";
import { RarityIndicator } from "./rarity-indicator";
import type { BadgePageItem } from "./types";

export function FeaturedBadgeCard({ badge, onSelect }: { badge: BadgePageItem; onSelect: (badge: BadgePageItem) => void }) {
  return <button type="button" onClick={() => onSelect(badge)} aria-haspopup="dialog" aria-label={`${badge.name}, unlocked. View achievement details.`} className="group flex min-h-[88px] min-w-0 items-center gap-3 rounded-xl border border-[#F0E6EA] bg-[#FFFCFD] p-3 text-left transition hover:border-[#F0B6C9] hover:bg-[#FFF8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:min-h-[106px] sm:gap-3.5 sm:p-3.5">
    <span className="flex aspect-square w-14 shrink-0 items-center justify-center sm:w-[68px]"><BadgeImage badgeId={badge.id} unlocked alt={`${badge.name} unlocked badge`} className="h-full w-full transition-transform duration-200 group-hover:scale-[1.04]" /></span>
    <span className="min-w-0 flex-1">
      <span className="block break-words text-xs font-bold leading-5 text-[#183653] sm:text-sm">{badge.name}</span>
      <span className="mt-1 block"><RarityIndicator rarity={badge.rarity} /></span>
      {badge.unlockedAt && <span className="mt-1 block text-[10px] leading-4 text-[#8A7E85]">Earned {new Date(badge.unlockedAt).toLocaleDateString()}</span>}
    </span>
  </button>;
}
