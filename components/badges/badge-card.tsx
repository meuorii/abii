import { BadgeImage } from "./badge-image";
import { BadgeProgress } from "./badge-progress";
import { RarityIndicator } from "./rarity-indicator";
import type { BadgePageItem } from "./types";

export function BadgeCard({ badge, onSelect }: { badge: BadgePageItem; onSelect: (badge: BadgePageItem) => void }) {
  return (
    <button type="button" onClick={() => onSelect(badge)} aria-haspopup="dialog" aria-label={`${badge.name}, ${badge.unlocked ? "unlocked" : "locked"}. View details.`} className="group flex h-full min-w-0 flex-col rounded-2xl border border-[#E8E2E5] bg-white p-3 text-left shadow-[0_2px_10px_rgba(47,41,48,.035)] transition hover:border-[#F1C7D5] hover:shadow-[0_8px_24px_rgba(47,41,48,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:p-4">
      <span className="flex w-full flex-wrap items-start justify-between gap-1.5">
        <span className={`inline-flex min-h-6 items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${badge.unlocked ? "bg-[#EAF8F0] text-[#327858]" : "bg-[#F5F2F3] text-[#756B72]"}`}>{badge.unlocked ? "Unlocked" : "Locked"}</span>
        <RarityIndicator rarity={badge.rarity} />
      </span>
      <span className="mx-auto mt-2 flex aspect-square w-full max-w-[170px] items-center justify-center">
        <BadgeImage badgeId={badge.id} unlocked={badge.unlocked} alt={`${badge.name} ${badge.unlocked ? "unlocked" : "locked"} badge`} className="h-full w-full transition-transform duration-200 group-hover:scale-[1.03]" />
      </span>
      <span className="mt-2 block min-h-[2.8rem] w-full break-words text-center text-sm font-bold leading-5 text-[#183653] sm:text-base">{badge.name}</span>
      <div className="mt-1.5 w-full text-left"><BadgeProgress badge={badge} compact /></div>
      {badge.unlockedAt && <span className="mt-2 block w-full text-center text-[11px] text-[#7B7378]">Earned {new Date(badge.unlockedAt).toLocaleDateString()}</span>}
    </button>
  );
}
