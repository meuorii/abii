import { BadgeImage } from "./badge-image";
import { BadgeProgress } from "./badge-progress";
import { RarityIndicator } from "./rarity-indicator";
import type { BadgePageItem } from "./types";
import { CheckCircle2, LockKeyhole } from "lucide-react";

export function BadgeCard({ badge, onSelect }: { badge: BadgePageItem; onSelect: (badge: BadgePageItem) => void }) {
  const StatusIcon = badge.unlocked ? CheckCircle2 : LockKeyhole;

  return (
    <button type="button" onClick={() => onSelect(badge)} aria-haspopup="dialog" aria-label={`${badge.name}, ${badge.unlocked ? "unlocked" : "locked"}. View details.`} className="group flex h-full min-w-0 flex-col rounded-2xl border border-[#E8E2E5] bg-white p-2.5 text-left shadow-[0_2px_10px_rgba(47,41,48,.035)] transition hover:border-[#F1C7D5] hover:shadow-[0_8px_24px_rgba(47,41,48,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 motion-reduce:transition-none sm:p-3.5 lg:p-4">
      <span className="flex min-h-5 w-full min-w-0 flex-nowrap items-center justify-between gap-1">
        <span role="img" aria-label={badge.unlocked ? "Unlocked" : "Locked"} title={badge.unlocked ? "Unlocked" : "Locked"} className="flex h-5 w-5 shrink-0 items-center justify-center">
          <StatusIcon aria-hidden="true" className={`h-4 w-4 ${badge.unlocked ? "text-[#E9577D]" : "text-[#756B72]"}`} strokeWidth={2} />
        </span>
        <RarityIndicator rarity={badge.rarity} />
      </span>
      <span className="mx-auto mt-2 flex aspect-square w-full max-w-[104px] items-center justify-center sm:max-w-[124px] xl:max-w-[148px]">
        <BadgeImage badgeId={badge.id} unlocked={badge.unlocked} alt={`${badge.name} ${badge.unlocked ? "unlocked" : "locked"} badge`} className="h-full w-full transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none" />
      </span>
      <span className="mt-2 block min-h-9 w-full break-words text-center text-[12px] font-bold leading-[17px] text-[#183653] sm:min-h-10 sm:text-sm sm:leading-5">{badge.name}</span>
      <div className="mt-auto w-full pt-2 text-left"><BadgeProgress badge={badge} compact /></div>
      <span className="mt-1 block min-h-4 w-full text-center text-[10px] leading-4 text-[#7B7378]">{badge.unlockedAt ? `Earned ${new Date(badge.unlockedAt).toLocaleDateString()}` : <span aria-hidden="true">&nbsp;</span>}</span>
    </button>
  );
}
