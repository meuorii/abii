"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import { NOTIFICATION_TYPES, type NotificationPreferences, type NotificationType } from "@/lib/notifications/contracts";
import { NOTIFICATION_PRESENTATION } from "./notification-display";
import { fetchNotificationPreferences, saveNotificationPreferences } from "./notification-client";

function PreferencesSkeleton() {
  return <SkeletonRegion label="Loading notification preferences" className="divide-y divide-[#F3EDF0] rounded-xl border border-[#F0E9EC] px-3.5 sm:px-4">
    {NOTIFICATION_TYPES.map((type) => <div key={type} aria-hidden="true" className="flex min-h-[72px] items-center gap-3 py-3"><SkeletonBlock className="h-9 w-9 shrink-0 rounded-xl"/><div className="flex-1 space-y-2"><SkeletonBlock className="h-3.5 w-48 max-w-full rounded"/><SkeletonBlock className="h-3 w-64 max-w-full rounded"/></div><SkeletonBlock className="h-7 w-12 shrink-0 rounded-full"/></div>)}
  </SkeletonRegion>;
}

export function NotificationPreferences() {
  const [saved, setSaved] = useState<NotificationPreferences | null>(null);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { const preferences = await fetchNotificationPreferences(); setSaved(preferences); setDraft(preferences); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Notification preferences could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(() => Boolean(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft)), [saved, draft]);
  const missingDailyTime = Boolean(draft?.daily_study_reminder && !draft.dailyStudyTime);

  function toggle(type: NotificationType) {
    if (!draft || type === "account_security") return;
    setNotice("");
    setDraft({ ...draft, [type]: !draft[type] });
  }

  async function save() {
    if (!saved || !draft || !dirty || saving || missingDailyTime) return;
    setSaving(true);
    setError("");
    setNotice("");
    const notifications = Object.fromEntries(NOTIFICATION_TYPES.filter((type) => type !== "account_security" && saved[type] !== draft[type]).map((type) => [type, draft[type]])) as Partial<Record<NotificationType, boolean>>;
    const patch: { notifications?: Partial<Record<NotificationType, boolean>>; dailyStudyTime?: string | null } = {};
    if (Object.keys(notifications).length) patch.notifications = notifications;
    if (saved.dailyStudyTime !== draft.dailyStudyTime) patch.dailyStudyTime = draft.dailyStudyTime;
    try {
      const next = await saveNotificationPreferences(patch);
      setSaved(next);
      setDraft(next);
      setNotice("Notification preferences saved.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Notification preferences could not be saved. Your changes are still here.");
    } finally { setSaving(false); }
  }

  return <div>
    <p className="mb-4 text-xs leading-5 text-[#647A8B]">Choose which learning updates and reminders you&apos;d like to receive from Abii.</p>
    {loading ? <PreferencesSkeleton/> : error && !draft ? <div className="rounded-xl bg-[#FFF1F1] px-3.5 py-3 text-sm text-[#A73C50]" role="alert"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-2 font-semibold underline underline-offset-2">Try again</button></div>
      : draft && <>
        <div className="divide-y divide-[#F3EDF0] rounded-xl border border-[#F0E9EC] px-3.5 sm:px-4">
          {NOTIFICATION_TYPES.map((type) => {
            const { icon: Icon, label, description } = NOTIFICATION_PRESENTATION[type];
            const security = type === "account_security";
            return <div key={type} className="flex min-w-0 items-center gap-3 py-3.5">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F4] text-[#C94B76]"><Icon className="h-[17px] w-[17px]" strokeWidth={1.9}/></span>
              <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold leading-5 text-[#18384D]">{label}</p><p className="mt-0.5 text-xs leading-[1.45] text-[#647A8B]">{security ? "Important security updates are always enabled to help protect your account." : description}</p></div>
              <button type="button" role="switch" aria-checked={draft[type]} aria-label={label} aria-describedby={security ? "notification-security-note" : undefined} disabled={security || saving} onClick={() => toggle(type)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${draft[type] ? "bg-[#E9577D]" : "bg-[#C7BEC3]"}`}><span aria-hidden="true" className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-150 ${draft[type] ? "left-6" : "left-1"}`}/></button>
            </div>;
          })}
        </div>
        <p id="notification-security-note" className="sr-only">This preference cannot be changed.</p>
        {draft.daily_study_reminder && <div className="mt-4 rounded-xl border border-[#F0E9EC] bg-[#FFFCFD] p-3.5 sm:p-4">
          <label htmlFor="dailyStudyTime" className="text-sm font-semibold text-[#18384D]">Preferred study time</label>
          <p className="mt-1 text-xs leading-5 text-[#647A8B]">Choose a time in your study timezone. Delivery is approximate and depends on scheduler availability.</p>
          <input id="dailyStudyTime" type="time" required value={draft.dailyStudyTime ?? ""} aria-invalid={missingDailyTime} aria-describedby="daily-study-time-help" onChange={(event) => { setNotice(""); setDraft({ ...draft, dailyStudyTime: event.target.value || null }); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-2 text-sm text-[#2F2930] outline-none focus:border-[#FF9FBA] focus:ring-2 focus:ring-[#FFE8EF] sm:max-w-[190px]"/>
          <span id="daily-study-time-help" className="mt-2 block text-xs leading-5 text-[#647A8B]">{missingDailyTime ? "Add a preferred time before saving this reminder." : "This preferred time is saved with your account."}</span>
        </div>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-[#FFF1F1] px-3.5 py-2.5 text-sm text-[#A73C50]">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-xl bg-[#EAF8F0] px-3.5 py-2.5 text-sm text-[#28734A]">{notice}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#788894]">Changes are saved to your account.</p>
          <button type="button" disabled={!dirty || saving || missingDailyTime} onClick={() => void save()} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55">{saving ? "Saving preferences…" : "Save Notification Preferences"}</button>
        </div>
      </>}
  </div>;
}
