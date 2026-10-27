"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BadgeImage } from "./badge-image";
import { RarityIndicator } from "./rarity-indicator";
import type { BadgePageItem } from "./types";
import type { BadgeShowcaseSurface } from "./featured-types";
import { Modal, modalCancelClass, modalPrimaryClass } from "@/components/ui/modal";

export function BadgeSelectionModal({ surface, earnedBadges, selectedIds, loadError, loading, onRetry, onClose, onSave }: {
  surface: BadgeShowcaseSurface;
  earnedBadges: BadgePageItem[];
  selectedIds: string[];
  loadError: string;
  loading: boolean;
  onRetry: () => void;
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = new Set(draft);
  const showcaseName = surface === "dashboard" ? "Dashboard" : "Progress";

  useEffect(() => { setDraft(selectedIds); setSaveError(""); }, [selectedIds]);

  function toggle(id: string) {
    setSaveError("");
    setDraft((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 3 ? current : [...current, id]);
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    try { await onSave(draft); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Your selection could not be saved. Please try again."); }
    finally { setSaving(false); }
  }

  return <Modal open action="update" size="lg" title="Choose Your Badges" description="Select up to 3 unlocked achievements to display." busy={saving} onClose={onClose} footer={<><button type="button" disabled={saving} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="button" disabled={saving || loading} onClick={() => void save()} className={modalPrimaryClass}>{saving ? "Saving…" : "Save Changes"}</button></>}>
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#183653]">{showcaseName} showcase</p><p aria-live="polite" className="shrink-0 text-xs font-bold tabular-nums text-[#C65380]">{draft.length} / 3 selected</p></div>
      {loadError && <div role="alert" className="rounded-xl border border-[#F0C7D3] bg-[#FFF8FA] p-3"><p className="text-xs leading-5 text-[#8A4D62]">{loadError}</p><button type="button" onClick={onRetry} disabled={loading} className="mt-2 inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-bold text-[#C65380] underline underline-offset-2 disabled:opacity-60">{loading ? "Refreshing…" : "Retry loading badges"}</button></div>}
      {loading && <div role="status" className="rounded-xl bg-[#FFF8FA] px-4 py-5 text-center text-sm text-[#756B72]">Refreshing your earned badges…</div>}
      {!loading && earnedBadges.length === 0 ? <div className="rounded-xl bg-[#FFF7F9] px-4 py-8 text-center"><p className="text-sm font-semibold text-[#183653]">No unlocked badges yet</p><p className="mt-1 text-xs leading-5 text-[#756B72]">Earn an achievement and it will be available to feature here.</p></div> : <div className="grid max-h-[48dvh] grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 min-[440px]:grid-cols-2">
        {earnedBadges.map((badge) => {
          const isSelected = selected.has(badge.id);
          const disabled = !isSelected && draft.length >= 3;
          return <button key={badge.id} type="button" role="checkbox" aria-checked={isSelected} aria-label={`${isSelected ? "Remove" : "Select"} ${badge.name}`} disabled={disabled || loading || saving} onClick={() => toggle(badge.id)} className={`flex min-h-[82px] min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? "border-[#EF9FB8] bg-[#FFF4F7]" : "border-[#EDE6E9] bg-white hover:bg-[#FFFAFC]"}`}>
            <span className="flex aspect-square w-12 shrink-0 items-center justify-center"><BadgeImage badgeId={badge.id} unlocked alt="" className="h-full w-full" /></span>
            <span className="min-w-0 flex-1"><span className="block break-words text-xs font-bold leading-4 text-[#183653]">{badge.name}</span><span className="mt-0.5 block"><RarityIndicator rarity={badge.rarity} /></span></span>
            <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isSelected ? "border-[#E9577D] bg-[#E9577D] text-white" : "border-[#D7CDD2] bg-white text-transparent"}`}><Check className="h-4 w-4" /></span>
          </button>;
        })}
      </div>}
      {draft.length >= 3 && <p className="text-[11px] leading-4 text-[#756B72]">You can feature up to three achievements. Remove one to choose a different badge.</p>}
      {saveError && <p role="alert" className="rounded-lg bg-[#FFF1F1] px-3 py-2 text-xs leading-5 text-[#B83F55]">{saveError}</p>}
    </div>
  </Modal>;
}
