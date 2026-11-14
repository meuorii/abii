"use client";

import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, modalCancelClass, modalDangerClass } from "@/components/ui/modal";
import { ModalButtonContent } from "@/components/ui/modal-button-content";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { SlidersHorizontal, ShieldCheck, Grid2X2, List, Download, Clock3, Layers3, Volume2, Play, BellRing } from "lucide-react";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
import { getAbiiSoundVolume, isAbiiSoundEnabled, playAbiiSound, setAbiiSoundEnabled, setAbiiSoundVolume } from "@/lib/sounds";

type Preferences = { targetSubjects: number; defaultLandingPage: string; subjectLayout: "grid" | "list"; studyTimezone: string };
type InitialUser = { settings?: Partial<Preferences> | null };
type Notice = { kind: "success" | "error"; text: string } | null;
type NoticeKey = "preferences" | "export" | "history" | "materials";
type NoticeMap = Partial<Record<NoticeKey, Notice>>;
const defaultPreferences: Preferences = { targetSubjects: 5, defaultLandingPage: "/dashboard", subjectLayout: "grid", studyTimezone: "UTC" };

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-2.5 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A49AA0] focus:border-[#FF9FBA] focus:ring-2 focus:ring-[#FFE8EF]";
const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#E8E2E5] bg-white px-4 py-2 text-sm font-semibold text-[#554A51] transition hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-60";
const dangerButton = "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#F0C7D3] bg-white px-4 py-2 text-sm font-semibold text-[#C94B66] transition hover:bg-[#FFF1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-60";

function SectionCard({ icon, title, description, children, delay = 0 }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode; delay?: number }) {
  return <ScrollReveal delay={delay}><section className="min-w-0 rounded-2xl border border-[#E8E2E5] bg-white p-4 shadow-[0_2px_10px_rgba(47,41,48,0.025)] sm:p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-xl text-[#E9577D]" aria-hidden="true">{icon}</span><div className="min-w-0 pt-0.5"><h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[#18384D]">{title}</h2><p className="mt-1 text-xs leading-5 text-[#6E879A] sm:text-[13px]">{description}</p></div></div><div className="mt-4">{children}</div></section></ScrollReveal>;
}
function InlineNotice({ notice }: { notice: Notice }) { if (!notice) return null; return <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-3 rounded-xl px-3.5 py-2.5 text-sm ${notice.kind === "error" ? "bg-[#FFF1F1] text-[#B84352]" : "bg-[#EAF8F0] text-[#28734A]"}`}>{notice.text}</p>; }

export function SettingsClient({ initialUser }: { initialUser: InitialUser }) {
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences>(() => ({ ...defaultPreferences, ...(initialUser.settings ?? {}), defaultLandingPage: initialUser.settings?.defaultLandingPage === "/favorites" ? "/dashboard" : initialUser.settings?.defaultLandingPage ?? defaultPreferences.defaultLandingPage }));
  const [saving, setSaving] = useState("");
  const [notices, setNotices] = useState<NoticeMap>({});
  function setNoticeFor(key: NoticeKey, value: Notice) {
    setNotices((previous) => ({ ...previous, [key]: value }));
  }
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"history" | "materials" | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(42);

  useEffect(() => {
    setSoundEnabled(isAbiiSoundEnabled());
    setSoundVolume(getAbiiSoundVolume());
  }, []);

  function updateSoundEnabled(enabled: boolean) {
    setSoundEnabled(enabled);
    setAbiiSoundEnabled(enabled);
  }

  function updateSoundVolume(volume: number) {
    setSoundVolume(volume);
    setAbiiSoundVolume(volume);
  }

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }
  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving("preferences"); setNoticeFor("preferences", null);
    try { const data = await request("/api/settings", "PATCH", preferences); setNoticeFor("preferences", { kind: "success", text: data.message || "Preferences saved. Your study experience is updated." }); router.refresh(); }
    catch (error) { setNoticeFor("preferences", { kind: "error", text: error instanceof Error ? error.message : "Couldn’t save preferences. Check your connection and try again." }); }
    finally { setSaving(""); }
  }
  async function runAction(key: string, url: string, method: string, body?: unknown, download = false) {
    const noticeKey: NoticeKey = key === "history" || key === "materials" ? key : "export";
    setSaving(key); setNoticeFor(noticeKey, null);
    try {
      if (download) {
        const response = await fetch(url);
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Your export could not be created."); }
        const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = objectUrl; link.download = `abii-study-data-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); setNoticeFor("export", { kind: "success", text: "Your study data export has been prepared. Check your browser’s downloads." });
      } else {
        const data = await request(url, method, body); setNoticeFor(noticeKey, { kind: "success", text: data.message || (key === "history" ? "Study history cleared. Your subjects and flashcards are still here." : "Study materials deleted. Your account is still active." ) }); if (key === "history" || key === "materials") setConfirmAction(null);
        if (data.redirectTo) window.setTimeout(() => { router.replace(data.redirectTo); }, 900);
      }
    } catch (error) { setNoticeFor(noticeKey, { kind: "error", text: error instanceof Error ? error.message : "Something went wrong." }); }
    finally { setSaving(""); }
  }

  return <div className="mx-auto w-full min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-6 xl:px-6 xl:py-7">
    <AbiiPageHero
      variant="settings"
      headingId="settings-hero-title"
      eyebrow={<div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6F96] text-xl text-white shadow-sm sm:h-12 sm:w-12 sm:text-2xl" aria-hidden="true">⚙</div>}
      title={<h1 className="text-[clamp(1.45rem,2.6vw,2.15rem)] font-bold leading-[1.12] tracking-[-0.04em] text-[#18384D]">Make Abii Feel Like Yours</h1>}
      description={<p className="mt-2 max-w-[390px] text-[12px] leading-[1.6] text-[#557187] sm:mt-3 sm:text-sm">Set your study preferences and manage your saved learning data.</p>}
      mascotSrc="/dashboard-hero/settings.png"
      mascotAlt="Abii holding a settings gear"
      priority
      decoration={<div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#FFF0F4] via-[#FFF3F6] to-[#FFE8EF]" />}
    />
    <div className="space-y-2">{(Object.entries(notices) as [NoticeKey, Notice][]).filter((entry) => entry[1]).map(([key, item]) => <div key={key}><InlineNotice notice={item} /></div>)}</div>

    <div data-testid="settings-panels" className="grid w-full min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2 xl:gap-6">
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <SectionCard icon={<SlidersHorizontal className="h-5 w-5"/>} title="Study Preferences" description="Customize how Abii organizes your study experience.">
          <form onSubmit={savePreferences} className="space-y-4 rounded-xl border border-[#F0E9EC] p-3.5 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px] sm:items-center"><div><label htmlFor="targetSubjects" className="text-sm font-semibold text-[#18384D]">Target number of subjects</label><p className="mt-1 text-xs leading-5 text-[#6E879A]">A personal organization goal, not a limit on creating subjects.</p></div><input id="targetSubjects" type="number" min={1} max={100} required value={preferences.targetSubjects} onChange={(event) => setPreferences({ ...preferences, targetSubjects: Number(event.target.value) })} className={inputClass + " mt-0"} /></div>
            <div className="h-px bg-[#F1EAED]" />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,180px)] sm:items-center"><div><label htmlFor="landingPage" className="text-sm font-semibold text-[#18384D]">Default landing page</label><p className="mt-1 text-xs leading-5 text-[#6E879A]">Choose where you want to start after signing in.</p></div><select id="landingPage" value={preferences.defaultLandingPage} onChange={(event) => setPreferences({ ...preferences, defaultLandingPage: event.target.value })} className={inputClass + " mt-0"}><option value="/dashboard">Dashboard</option><option value="/subjects">My Subjects</option><option value="/review">Review</option><option value="/progress">Progress</option></select></div>
            <div className="h-px bg-[#F1EAED]" />
            <fieldset><legend className="text-sm font-semibold text-[#18384D]">Preferred subject layout</legend><p className="mt-1 text-xs leading-5 text-[#6E879A]">Choose how subjects should appear in My Subjects.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" aria-pressed={preferences.subjectLayout === "grid"} onClick={() => setPreferences({ ...preferences, subjectLayout: "grid" })} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${preferences.subjectLayout === "grid" ? "border-[#FF9FBA] bg-[#FFF0F4] text-[#C94B76]" : "border-[#E8E2E5] text-[#756B72] hover:bg-[#FFF7F9]"}`}><Grid2X2 className="h-4 w-4"/> Grid</button><button type="button" aria-pressed={preferences.subjectLayout === "list"} onClick={() => setPreferences({ ...preferences, subjectLayout: "list" })} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${preferences.subjectLayout === "list" ? "border-[#FF9FBA] bg-[#FFF0F4] text-[#C94B76]" : "border-[#E8E2E5] text-[#756B72] hover:bg-[#FFF7F9]"}`}><List className="h-4 w-4"/> List</button></div></fieldset>
            <div className="h-px bg-[#F1EAED]" />
            <div><label htmlFor="studyTimezone" className="text-sm font-semibold text-[#18384D]">Study timezone</label><p className="mt-1 text-xs leading-5 text-[#6E879A]">Your study timezone determines study days, streaks, and activity charts. Your Dashboard greeting follows your device&apos;s local time. Enter an IANA timezone such as Asia/Manila or America/New_York.</p><input id="studyTimezone" type="text" autoComplete="off" spellCheck={false} required value={preferences.studyTimezone} onChange={(event) => setPreferences({ ...preferences, studyTimezone: event.target.value })} className={inputClass} /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1"><p className="text-xs text-[#8A7D84]">Preferences are saved to your account.</p><button type="submit" disabled={saving !== ""} className={buttonClass}>{saving === "preferences" ? "Saving Preferences…" : "Save Preferences"}</button></div>
          </form>
          <div className="mt-3 rounded-xl border border-[#F0E9EC] p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-[#E9577D]" aria-hidden="true"><Volume2 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold text-[#18384D]">Quiz Sound Effects</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Adjust the sound feedback you hear during reviews.</p></div>
                  <button type="button" role="switch" aria-checked={soundEnabled} aria-label={`Quiz Sound Effects: Sound ${soundEnabled ? "On" : "Off"}`} onClick={() => updateSoundEnabled(!soundEnabled)} className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 ${soundEnabled ? "bg-[#E9577D]" : "bg-[#C7BEC3]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${soundEnabled ? "left-6" : "left-1"}`} /></button>
                </div>
                <p className="mt-2 text-xs font-medium text-[#756B72]" aria-live="polite">Sound {soundEnabled ? "On" : "Off"}</p>
                <label htmlFor="quizSoundVolume" className="mt-3 flex items-center justify-between gap-3 text-xs font-medium text-[#557087]"><span>Volume</span><span>{soundVolume}%</span></label>
                <input id="quizSoundVolume" aria-label="Volume" aria-valuetext={`${soundVolume}%`} type="range" min={0} max={100} value={soundVolume} onChange={(event) => updateSoundVolume(Number(event.target.value))} className="abii-volume-slider mt-1.5 w-full" style={{ "--volume-progress": `${soundVolume}%` } as React.CSSProperties} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {([ ["correct", "Preview Correct"], ["wrong", "Preview Wrong"], ["complete", "Preview Complete"] ] as const).map(([kind, label]) => <button key={kind} type="button" onClick={() => playAbiiSound(kind)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#F1D7E0] bg-[#FFF9FB] px-2.5 text-xs font-semibold text-[#A94369] transition hover:bg-[#FFF0F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-1"><Play className="h-3 w-3" aria-hidden="true" />{label}</button>)}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<BellRing className="h-5 w-5"/>} title="Notification Preferences" description="Choose which learning updates and reminders you’d like to receive." delay={0.06}>
          <NotificationPreferences/>
        </SectionCard>

      </div>

      <div className="min-w-0 space-y-4 sm:space-y-5">
        <SectionCard icon={<ShieldCheck className="h-5 w-5"/>} title="Data & Privacy" description="Export a copy of supported study data or manage your saved materials and history." delay={0.12}>
          <div className="divide-y divide-[#F1EAED] rounded-xl border border-[#F0E9EC] px-3.5 sm:px-4">
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-lg text-[#E9577D]"><Download className="h-5 w-5"/></span><div><p className="text-sm font-semibold text-[#18384D]">Export Study Data</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Download your subjects, flashcards, progress, and study history.</p></div></div><button type="button" disabled={saving !== ""} onClick={() => void runAction("export", "/api/data/export", "GET", undefined, true)} className={secondaryButton}>{saving === "export" ? "Preparing Download…" : "Export"}</button></div>
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-lg text-[#E9577D]"><Clock3 className="h-5 w-5"/></span><div><p className="text-sm font-semibold text-[#18384D]">Clear Study History</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Remove review records and completed-session history. Your subjects and flashcards stay.</p></div></div><button type="button" disabled={saving !== ""} onClick={() => setConfirmAction("history")} className={dangerButton}>{saving === "history" ? "Clearing Study History…" : "Clear"}</button></div>
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-lg text-[#E9577D]"><Layers3 className="h-5 w-5"/></span><div><p className="text-sm font-semibold text-[#18384D]">Delete Study Materials</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Delete your subjects, topics, flashcards, and related study history while keeping your account.</p></div></div><button type="button" disabled={saving !== ""} onClick={() => setConfirmAction("materials")} className={dangerButton}>{saving === "materials" ? "Deleting Study Materials…" : "Delete"}</button></div>
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#F4DCE4] text-lg text-[#E9577D]"><ShieldCheck className="h-5 w-5"/></span><div><p className="text-sm font-semibold text-[#18384D]">Privacy Information</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Learn what this Settings page can export and delete.</p></div></div><button type="button" className={secondaryButton} onClick={() => setPrivacyOpen(true)}>Learn More</button></div>
          </div>
        </SectionCard>
      </div>
    </div>

    <Modal open={privacyOpen} onClose={() => setPrivacyOpen(false)} action="information" title="Your data, your choice" description="What these controls do"><ul className="space-y-3 text-sm leading-6 text-[#756B72]"><li><strong className="text-[#2F2930]">Export:</strong> downloads available profile details, subjects, flashcards, review records, and completed sessions as JSON. Password hashes and session tokens are excluded.</li><li><strong className="text-[#2F2930]">Clear Study History:</strong> removes review records and completed sessions while preserving your subjects and flashcards.</li><li><strong className="text-[#2F2930]">Delete Study Materials:</strong> removes subjects, flashcards, and associated review/session records while preserving your account.</li><li><strong className="text-[#2F2930]">Delete Account:</strong> available from Profile and removes your account and associated study data after confirmation.</li></ul><p className="mt-4 rounded-xl bg-[#FFF7F9] p-3 text-xs leading-5 text-[#756B72]">This panel describes the controls currently implemented in Abii; it is not a substitute for a full published privacy policy.</p></Modal>
    <Modal open={confirmAction !== null} onClose={() => { if (!saving) setConfirmAction(null); }} action="delete" alert busy={Boolean(saving)} title={confirmAction === "history" ? "Clear Study History?" : "Delete All Study Materials?"} description={confirmAction === "history" ? "Review history will be removed while your subjects and flashcards stay." : "Your subjects, topics, flashcards, and related study history will be deleted. Your account will remain."} footer={<><button type="button" disabled={Boolean(saving)} onClick={() => setConfirmAction(null)} className={modalCancelClass}>Cancel</button><button type="button" disabled={Boolean(saving)} onClick={() => { if (confirmAction === "history") void runAction("history", "/api/data/history", "DELETE"); else if (confirmAction === "materials") void runAction("materials", "/api/data/materials", "DELETE"); }} className={modalDangerClass}><ModalButtonContent loading={Boolean(saving)} label={confirmAction === "history" ? "Clear Study History" : "Delete Study Materials"} loadingLabel={saving === "history" ? "Clearing Study History…" : "Deleting Study Materials…"} /></button></>}>
      {confirmAction === "history" ? <p className="text-sm leading-6 text-[#756B72]">Review records and completed session history will be removed. Your subjects and flashcards remain.</p> : <p className="text-sm leading-6 text-[#756B72]">Subjects, topics, flashcards, review records, and quiz sessions will be deleted. Your user account remains.</p>}
    </Modal>
  </div>;
}
