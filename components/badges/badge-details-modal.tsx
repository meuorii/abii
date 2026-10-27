"use client";

import { BadgeImage } from "./badge-image";
import { BadgeProgress, remainingRequirement } from "./badge-progress";
import { RarityIndicator } from "./rarity-indicator";
import type { BadgePageItem } from "./types";
import { Modal, modalCancelClass } from "@/components/ui/modal";

export function BadgeDetailsModal({ badge, onClose }: { badge: BadgePageItem | null; onClose: () => void }) {
  if (!badge) return null;
  return (
    <Modal open onClose={onClose} action="view" size="lg" title={badge.name} description={badge.unlocked ? "Achievement unlocked" : "Achievement details"} footer={<button type="button" onClick={onClose} className={`col-span-2 ${modalCancelClass}`}>Close</button>}>
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#FFF7F9] px-4 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
          <div className="flex aspect-square w-32 shrink-0 items-center justify-center sm:w-40">
            <BadgeImage badgeId={badge.id} unlocked={badge.unlocked} alt={`${badge.name} ${badge.unlocked ? "unlocked" : "locked"} badge`} className="h-full w-full" priority />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${badge.unlocked ? "bg-[#EAF8F0] text-[#327858]" : "bg-white text-[#756B72]"}`}>{badge.unlocked ? "Unlocked" : "Locked"}</span>
            <RarityIndicator rarity={badge.rarity} size="lg" className="mt-2" />
            <p className="mt-1 text-sm text-[#657B8E]">{badge.category === "mastery" ? "Mastery" : badge.category.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")}</p>
            {badge.unlockedAt && <p className="mt-2 text-xs text-[#756B72]">Earned {new Date(badge.unlockedAt).toLocaleDateString()}</p>}
          </div>
        </div>

        <section>
          <h3 className="text-xs font-extrabold uppercase tracking-[.1em] text-[#8A7E85]">About this badge</h3>
          <p className="mt-1.5 break-words text-sm leading-6 text-[#526F83]">{badge.description}</p>
        </section>
        <section>
          <h3 className="text-xs font-extrabold uppercase tracking-[.1em] text-[#8A7E85]">How to unlock</h3>
          <p className="mt-1.5 break-words text-sm leading-6 text-[#526F83]">{badge.instructions}</p>
        </section>
        {badge.historicalNote && !badge.unlocked && <p className="rounded-xl border border-[#F0E6EA] bg-[#FFF9FB] p-3 text-xs leading-5 text-[#756B72]">{badge.historicalNote}</p>}
        <section className="rounded-2xl border border-[#F0E6EA] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="text-sm font-bold text-[#183653]">{badge.unlocked ? "Your progress" : "Current progress"}</h3><p className="mt-1 text-xs leading-5 text-[#756B72]">{badge.unlocked ? "Requirement completed" : badge.progressLabel}</p></div>
            <span className="shrink-0 rounded-full bg-[#FFF0F4] px-2.5 py-1 text-xs font-bold text-[#C65380]">{badge.unlocked ? "Complete" : `${badge.progress} / ${badge.target}`}</span>
          </div>
          <div className="mt-4"><BadgeProgress badge={badge} /></div>
          <p className="mt-3 text-sm leading-6 text-[#526F83]">{remainingRequirement(badge)}</p>
          {badge.unlocked && <p className="mt-2 text-xs font-semibold text-[#327858]">This achievement is permanently recorded in your collection.</p>}
        </section>
      </div>
    </Modal>
  );
}
