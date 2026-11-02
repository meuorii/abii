"use client";

import { CheckCircle2, LockKeyhole } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BadgeImage } from "./badge-image";
import { BadgeProgress, remainingRequirement } from "./badge-progress";
import { RarityIndicator } from "./rarity-indicator";
import type { BadgePageItem } from "./types";

function earnedDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    dateTime: date.toISOString(),
    label: date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
  };
}

export function BadgeDetailsModal({ badge, onClose }: { badge: BadgePageItem | null; onClose: () => void }) {
  if (!badge) return null;
  const date = badge.unlocked ? earnedDate(badge.unlockedAt) : null;
  const StatusIcon = badge.unlocked ? CheckCircle2 : LockKeyhole;

  return (
    <Modal
      open
      onClose={onClose}
      action="view"
      size="md"
      headerLayout="badge-details"
      title={badge.name}
      description={badge.unlocked ? "An achievement you've earned on your learning journey." : "Discover what it takes to earn this achievement."}
    >
      <div className="space-y-5 sm:space-y-6">
        <div className="relative mx-auto flex w-full max-w-[340px] flex-col items-center overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_38%,#FFFFFF_0%,#FFF9FB_38%,#FFF0F5_100%)] px-4 py-4 sm:py-5">
          <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-5 h-28 w-28 -translate-x-1/2 rounded-full bg-white/80 blur-2xl sm:top-6 sm:h-36 sm:w-36" />
          <div className="relative z-10 h-28 w-28 sm:h-36 sm:w-36 lg:h-40 lg:w-40">
            <BadgeImage badgeId={badge.id} unlocked={badge.unlocked} alt={`${badge.name} ${badge.unlocked ? "unlocked" : "locked"} badge`} className="h-full w-full" priority />
          </div>
          <div className="relative z-10 mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.unlocked ? "bg-[#EAF8F0] text-[#327858]" : "bg-white/90 text-[#655A61]"}`}>
              <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
              {badge.unlocked ? "Unlocked" : "Locked"}
            </span>
            <RarityIndicator rarity={badge.rarity} size="md" />
          </div>
          {date && <p className="relative z-10 mt-2 text-sm text-[#657B8E]"><time dateTime={date.dateTime}>Earned {date.label}</time></p>}
        </div>

        <section aria-labelledby="badge-about-heading">
          <h3 id="badge-about-heading" className="text-sm font-semibold text-[#183653]">About This Achievement</h3>
          <p className="mt-1.5 break-words text-sm leading-[1.6] text-[#526F83]">{badge.description}</p>
        </section>

        <section aria-labelledby="badge-requirement-heading" className="border-t border-[#F0E6EA] pt-4">
          <h3 id="badge-requirement-heading" className="text-sm font-semibold text-[#183653]">{badge.unlocked ? "How You Earned It" : "How to Unlock"}</h3>
          <p className="mt-1.5 break-words text-sm leading-[1.6] text-[#526F83]">{badge.instructions}</p>
        </section>

        {badge.historicalNote && !badge.unlocked && <p className="rounded-xl bg-[#FFF8FA] px-3.5 py-3 text-sm leading-[1.55] text-[#756B72]">{badge.historicalNote}</p>}

        {badge.unlocked ? <div role="status" className="flex items-start gap-2.5 rounded-xl bg-[#F2FAF5] px-3.5 py-3 text-sm leading-[1.55] text-[#327858]">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p><span className="font-semibold">Achievement completed.</span> Permanently added to your collection.</p>
        </div> : <section aria-labelledby="badge-progress-heading" className="border-t border-[#F0E6EA] pt-4">
          <h3 id="badge-progress-heading" className="text-sm font-semibold text-[#183653]">Your Progress</h3>
          <div className="mt-2.5"><BadgeProgress badge={badge} /></div>
          <p className="mt-2.5 break-words text-sm leading-[1.55] text-[#526F83]">{remainingRequirement(badge)}</p>
        </section>}
      </div>
    </Modal>
  );
}
