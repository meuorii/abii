"use client";

import Image from "next/image";
import { useState } from "react";

type Preferences = { targetSubjects: number; defaultLandingPage: string; subjectLayout: "grid" | "list" };
type InitialUser = { name: string; email: string; profileImage: string; createdAt: string; settings?: Partial<Preferences> | null };
type Notice = { kind: "success" | "error"; text: string } | null;
type NoticeKey = "preferences" | "profile" | "photo" | "password" | "export" | "history" | "materials" | "account" | "logout";
type NoticeMap = Partial<Record<NoticeKey, Notice>>;
const defaultPreferences: Preferences = { targetSubjects: 5, defaultLandingPage: "/dashboard", subjectLayout: "grid" };

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-2.5 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A49AA0] focus:border-[#FF9FBA] focus:ring-2 focus:ring-[#FFE8EF]";
const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#E8E2E5] bg-white px-4 py-2 text-sm font-semibold text-[#554A51] transition hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-60";
const dangerButton = "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#F0C7D3] bg-white px-4 py-2 text-sm font-semibold text-[#C94B66] transition hover:bg-[#FFF1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-60";

function SectionCard({ icon, title, description, children }: { icon: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-[#E8E2E5] bg-white p-4 shadow-[0_2px_10px_rgba(47,41,48,0.025)] sm:p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-xl text-[#E9577D]" aria-hidden="true">{icon}</span><div className="min-w-0 pt-0.5"><h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[#18384D]">{title}</h2><p className="mt-1 text-xs leading-5 text-[#6E879A] sm:text-[13px]">{description}</p></div></div><div className="mt-4">{children}</div></section>;
}
function InlineNotice({ notice }: { notice: Notice }) { if (!notice) return null; return <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-3 rounded-xl px-3.5 py-2.5 text-sm ${notice.kind === "error" ? "bg-[#FFF1F1] text-[#B84352]" : "bg-[#EAF8F0] text-[#28734A]"}`}>{notice.text}</p>; }

export function SettingsClient({ initialUser }: { initialUser: InitialUser }) {
  const [preferences, setPreferences] = useState<Preferences>(() => ({ ...defaultPreferences, ...(initialUser.settings ?? {}) }));
  const [profile, setProfile] = useState({ name: initialUser.name, email: initialUser.email });
  const [profileImage, setProfileImage] = useState(initialUser.profileImage);
  const [imagePreview, setImagePreview] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState("");
  const [notices, setNotices] = useState<NoticeMap>({});
  function setNoticeFor(key: NoticeKey, value: Notice) { setNotices((previous) => ({ ...previous, [key]: value })); }
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState("");

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }
  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving("preferences"); setNoticeFor("preferences", null);
    try { const data = await request("/api/settings", "PATCH", preferences); setNoticeFor("preferences", { kind: "success", text: data.message || "Study preferences saved." }); }
    catch (error) { setNoticeFor("preferences", { kind: "error", text: error instanceof Error ? error.message : "Could not save preferences." }); }
    finally { setSaving(""); }
  }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving("profile"); setNoticeFor("profile", null);
    try { const data = await request("/api/account/profile", "PATCH", profile); setProfile(data.user); setNoticeFor("profile", { kind: "success", text: data.message || "Account details updated." }); }
    catch (error) { setNoticeFor("profile", { kind: "error", text: error instanceof Error ? error.message : "Could not update account details." }); }
    finally { setSaving(""); }
  }
  async function uploadProfilePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setNoticeFor("photo", { kind: "error", text: "Choose a JPG, PNG, or WebP image." }); return; }
    if (file.size > 1024 * 1024) { setNoticeFor("photo", { kind: "error", text: "Profile photos must be 1 MB or smaller." }); return; }
    if (typeof createImageBitmap !== "function") { setNoticeFor("photo", { kind: "error", text: "Your browser cannot validate this image. Please try another browser." }); return; }
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width > 6000 || bitmap.height > 6000 || bitmap.width * bitmap.height > 20_000_000) { setNoticeFor("photo", { kind: "error", text: "Choose an image no larger than 6000 × 6000 pixels or 20 megapixels." }); return; }
    } catch { setNoticeFor("photo", { kind: "error", text: "The selected image could not be decoded. Please choose another image." }); return; }
    finally { bitmap?.close(); }
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") { setNoticeFor("photo", { kind: "error", text: "The image could not be read." }); return; }
      setImagePreview(reader.result); setSaving("photo"); setNoticeFor("photo", null);
      try { const data = await request("/api/account/profile-picture", "PATCH", { image: reader.result }); setProfileImage(data.profileImage); setImagePreview(""); setNoticeFor("photo", { kind: "success", text: data.message || "Profile photo updated." }); }
      catch (error) { setImagePreview(""); setNoticeFor("photo", { kind: "error", text: error instanceof Error ? error.message : "Could not update profile photo." }); }
      finally { setSaving(""); }
    };
    reader.onerror = () => setNoticeFor("photo", { kind: "error", text: "The image could not be read." });
    reader.readAsDataURL(file);
  }
  async function removeProfilePhoto() {
    setSaving("photo"); setNoticeFor("photo", null);
    try { const data = await request("/api/account/profile-picture", "DELETE"); setProfileImage(""); setImagePreview(""); setNoticeFor("photo", { kind: "success", text: data.message || "Profile photo removed." }); }
    catch (error) { setNoticeFor("photo", { kind: "error", text: error instanceof Error ? error.message : "Could not remove profile photo." }); }
    finally { setSaving(""); }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving("password"); setNoticeFor("password", null);
    try { const data = await request("/api/account/password", "PATCH", { currentPassword, newPassword, confirmPassword }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setNoticeFor("password", { kind: "success", text: data.message }); window.setTimeout(() => { window.location.href = data.redirectTo || "/login"; }, 1200); }
    catch (error) { setNoticeFor("password", { kind: "error", text: error instanceof Error ? error.message : "Could not change password." }); }
    finally { setSaving(""); }
  }
  async function runAction(key: string, url: string, method: string, body?: unknown, download = false) {
    setSaving(key); setNoticeFor(key === "history" || key === "materials" || key === "account" ? key : "export", null);
    try {
      if (download) {
        const response = await fetch(url);
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Your export could not be created."); }
        const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = objectUrl; link.download = `abii-study-data-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); setNoticeFor("export", { kind: "success", text: "Your study data export is ready." });
      } else {
        const data = await request(url, method, body); setNoticeFor(key === "history" || key === "materials" || key === "account" ? key : "export", { kind: "success", text: data.message || "Done." });
        if (data.redirectTo) window.setTimeout(() => { window.location.href = data.redirectTo; }, 900);
      }
    } catch (error) { setNoticeFor(key === "history" || key === "materials" || key === "account" ? key : "export", { kind: "error", text: error instanceof Error ? error.message : "Something went wrong." }); }
    finally { setSaving(""); }
  }

  return <div className="mx-auto w-full min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-6 xl:p-7">
    <section aria-labelledby="settings-hero-title" className="relative isolate min-h-[210px] overflow-hidden rounded-2xl border border-[#F8E4EB] bg-[#FFF0F4] sm:min-h-[230px] lg:min-h-[248px]">
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#FFF0F4] via-[#FFF3F6] to-[#FFE8EF]" />
      <div className="relative z-10 flex min-h-[210px] items-center px-5 py-5 sm:min-h-[230px] sm:px-7 lg:min-h-[248px] lg:px-8">
        <div className="max-w-[62%] sm:max-w-[58%] lg:max-w-[60%]">
          <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6F96] text-xl text-white shadow-sm sm:h-12 sm:w-12 sm:text-2xl" aria-hidden="true">⚙</div>
          <h1 id="settings-hero-title" className="text-[clamp(1.45rem,2.6vw,2.15rem)] font-bold leading-[1.12] tracking-[-0.04em] text-[#18384D]">Make Abii Feel Like Yours</h1>
          <p className="mt-2 max-w-[390px] text-[12px] leading-[1.6] text-[#557187] sm:mt-3 sm:text-sm">Customize your study experience, manage your account, and keep your learning data under control.</p>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-0 h-[94%] w-[43%] sm:h-full sm:w-[40%] lg:w-[38%]">
          <Image src="/dashboard-hero/settings.png" alt="Abii holding a settings gear" fill priority sizes="(max-width: 640px) 43vw, (max-width: 1024px) 40vw, 390px" className="object-contain object-right-bottom" />
        </div>
      </div>
    </section>
    <div className="space-y-2">{(Object.entries(notices) as [NoticeKey, Notice][]).filter((entry) => entry[1]).map(([key, item]) => <div key={key}><InlineNotice notice={item} /></div>)}</div>

    <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2 xl:gap-5">
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <SectionCard icon="☷" title="Study Preferences" description="Make your study space work the way you do.">
          <form onSubmit={savePreferences} className="space-y-4 rounded-xl border border-[#F0E9EC] p-3.5 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px] sm:items-center"><div><label htmlFor="targetSubjects" className="text-sm font-semibold text-[#18384D]">Target number of subjects</label><p className="mt-1 text-xs leading-5 text-[#6E879A]">A personal organization goal, not a limit on creating subjects.</p></div><input id="targetSubjects" type="number" min={1} max={100} required value={preferences.targetSubjects} onChange={(event) => setPreferences({ ...preferences, targetSubjects: Number(event.target.value) })} className={inputClass + " mt-0"} /></div>
            <div className="h-px bg-[#F1EAED]" />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,180px)] sm:items-center"><div><label htmlFor="landingPage" className="text-sm font-semibold text-[#18384D]">Default landing page</label><p className="mt-1 text-xs leading-5 text-[#6E879A]">Choose where you want to start after signing in.</p></div><select id="landingPage" value={preferences.defaultLandingPage} onChange={(event) => setPreferences({ ...preferences, defaultLandingPage: event.target.value })} className={inputClass + " mt-0"}><option value="/dashboard">Dashboard</option><option value="/subjects">My Subjects</option><option value="/review">Review</option><option value="/favorites">Favorites</option><option value="/progress">Progress</option></select></div>
            <div className="h-px bg-[#F1EAED]" />
            <fieldset><legend className="text-sm font-semibold text-[#18384D]">Preferred subject layout</legend><p className="mt-1 text-xs leading-5 text-[#6E879A]">Choose how subjects should appear in My Subjects.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" aria-pressed={preferences.subjectLayout === "grid"} onClick={() => setPreferences({ ...preferences, subjectLayout: "grid" })} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${preferences.subjectLayout === "grid" ? "border-[#FF9FBA] bg-[#FFF0F4] text-[#C94B76]" : "border-[#E8E2E5] text-[#756B72] hover:bg-[#FFF7F9]"}`}><span aria-hidden="true">▦</span> Grid</button><button type="button" aria-pressed={preferences.subjectLayout === "list"} onClick={() => setPreferences({ ...preferences, subjectLayout: "list" })} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${preferences.subjectLayout === "list" ? "border-[#FF9FBA] bg-[#FFF0F4] text-[#C94B76]" : "border-[#E8E2E5] text-[#756B72] hover:bg-[#FFF7F9]"}`}><span aria-hidden="true">☰</span> List</button></div></fieldset>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1"><p className="text-xs text-[#8A7D84]">Preferences are saved to your account.</p><button type="submit" disabled={saving !== ""} className={buttonClass}>{saving === "preferences" ? "Saving…" : "Save Preferences"}</button></div>
          </form>
        </SectionCard>

        <SectionCard icon="▣" title="Data & Privacy" description="Keep control of your study materials and learning history.">
          <div className="divide-y divide-[#F1EAED] rounded-xl border border-[#F0E9EC] px-3.5 sm:px-4">
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-lg text-[#E9577D]">⇩</span><div><p className="text-sm font-semibold text-[#18384D]">Export Study Data</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Download your subjects, flashcards, progress, and study history.</p></div></div><button type="button" disabled={saving !== ""} onClick={() => void runAction("export", "/api/data/export", "GET", undefined, true)} className={secondaryButton}>{saving === "export" ? "Preparing…" : "Export"}</button></div>
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-lg text-[#E9577D]">◷</span><div><p className="text-sm font-semibold text-[#18384D]">Clear Study History</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Remove review records and completed-session history. Your subjects and flashcards stay.</p></div></div><button type="button" disabled={saving !== ""} onClick={() => { if (window.confirm("Clear your study history? This removes review records and completed sessions but keeps your subjects and flashcards.")) void runAction("history", "/api/data/history", "DELETE"); }} className={dangerButton}>{saving === "history" ? "Clearing…" : "Clear"}</button></div>
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F4] text-lg text-[#E9577D]">▤</span><div><p className="text-sm font-semibold text-[#18384D]">Delete Study Materials</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Delete all your subjects and flashcards while keeping your account.</p></div></div><button type="button" disabled={saving !== ""} onClick={() => { if (window.confirm("Delete all study materials? Your subjects, flashcards, and related review history will be permanently removed. Your account will remain.")) void runAction("materials", "/api/data/materials", "DELETE"); }} className={dangerButton}>{saving === "materials" ? "Deleting…" : "Delete"}</button></div>
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#F4DCE4] text-lg text-[#E9577D]">♡</span><div><p className="text-sm font-semibold text-[#18384D]">Privacy Information</p><p className="mt-1 text-xs leading-5 text-[#6E879A]">Learn what this Settings page can export and delete.</p></div></div><button type="button" className={secondaryButton} onClick={() => setPrivacyOpen(true)}>Learn More</button></div>
          </div>
        </SectionCard>
      </div>

      <div className="min-w-0 space-y-4 sm:space-y-5">
        <SectionCard icon="♙" title="Account & Security" description="Manage your personal information and protect your account.">
          <div className="rounded-xl border border-[#F0E9EC] p-3.5 sm:p-4">
            <div className="mb-4 flex flex-wrap items-center gap-3"><div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#F4DCE4] bg-[#FFE0E9] text-lg font-semibold text-[#D94E7B]">{(imagePreview || profileImage) ? <Image src={imagePreview || profileImage} alt="Profile photo preview" fill sizes="56px" unoptimized className="object-cover" /> : (profile.name.trim().charAt(0).toUpperCase() || "A")}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#18384D]">{profile.name}</p><p className="truncate text-xs text-[#6E879A]">{profile.email}</p><div className="mt-2 flex flex-wrap gap-2"><label className={`${secondaryButton} cursor-pointer ${saving === "photo" ? "pointer-events-none opacity-60" : ""}`}>{saving === "photo" ? "Updating…" : "Change Photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={saving !== ""} onChange={uploadProfilePhoto} /></label>{profileImage && <button type="button" disabled={saving !== ""} className={secondaryButton} onClick={removeProfilePhoto}>Remove</button>}</div></div></div><p className="text-xs leading-5 text-[#6E879A]">JPG, PNG, or WebP · up to 1 MB. Your photo appears in the account header too.</p>
            <form onSubmit={saveProfile} className="mt-4 space-y-3.5">
              <div><label htmlFor="profileName" className="text-xs font-semibold text-[#18384D]">Name</label><input id="profileName" autoComplete="name" maxLength={80} required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className={inputClass} /></div>
              <div><label htmlFor="profileEmail" className="text-xs font-semibold text-[#18384D]">Email</label><input id="profileEmail" type="email" autoComplete="email" maxLength={254} required value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} className={inputClass} /></div>
              <div className="flex justify-end"><button type="submit" disabled={saving !== ""} className={buttonClass}>{saving === "profile" ? "Saving…" : "Save Details"}</button></div>
            </form>
          </div>
          <div className="mt-3 rounded-xl border border-[#F0E9EC] p-3.5 sm:p-4"><h3 className="text-sm font-semibold text-[#18384D]">Change Password</h3><p className="mt-1 text-xs leading-5 text-[#6E879A]">Use your current password to set a new one. You’ll need to log in again afterward.</p><form onSubmit={changePassword} className="mt-3 space-y-3"><div><label htmlFor="currentPassword" className="text-xs font-semibold text-[#18384D]">Current password</label><input id="currentPassword" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} /></div><div><label htmlFor="newPassword" className="text-xs font-semibold text-[#18384D]">New password</label><input id="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} /></div><div><label htmlFor="confirmPassword" className="text-xs font-semibold text-[#18384D]">Confirm new password</label><input id="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></div><div className="flex justify-end"><button type="submit" disabled={saving !== ""} className={secondaryButton}>{saving === "password" ? "Updating…" : "Change Password"}</button></div></form></div>
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#F0E9EC] p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"><div><h3 className="text-sm font-semibold text-[#18384D]">Log Out</h3><p className="mt-1 text-xs leading-5 text-[#6E879A]">End your current Abii session on this browser.</p></div><button type="button" disabled={saving !== ""} onClick={async () => { setSaving("logout"); try { await request("/api/auth/logout", "POST"); window.location.href = "/login"; } catch (error) { setNoticeFor("logout", { kind: "error", text: error instanceof Error ? error.message : "Could not log out." }); setSaving(""); } }} className={secondaryButton}>{saving === "logout" ? "Logging out…" : "Log Out"}</button></div>
          <div className="mt-3 rounded-xl border border-[#F0C7D3] bg-[#FFFBFC] p-3.5 sm:p-4"><h3 className="text-sm font-semibold text-[#B8435D]">Delete Account</h3><p className="mt-1 text-xs leading-5 text-[#876A73]">Permanently delete your account, subjects, flashcards, review history, and study sessions. This cannot be undone.</p><label htmlFor="deleteAccountConfirm" className="mt-3 block text-xs font-semibold text-[#754B55]">Type DELETE to confirm</label><input id="deleteAccountConfirm" value={deleteAccountText} onChange={(event) => setDeleteAccountText(event.target.value)} className={inputClass} placeholder="DELETE" autoComplete="off" /><button type="button" disabled={saving !== "" || deleteAccountText !== "DELETE"} onClick={() => { if (window.confirm("Permanently delete your Abii account and all associated data? This cannot be undone.")) void runAction("account", "/api/account", "DELETE", { confirmation: "DELETE" }); }} className={dangerButton + " mt-3"}>{saving === "account" ? "Deleting account…" : "Delete Account"}</button></div>
        </SectionCard>
        <section className="relative overflow-hidden rounded-2xl border border-[#F8E4EB] bg-gradient-to-r from-[#FFF7F9] to-[#FFF0F4] p-5 sm:p-6"><div className="relative z-10 max-w-[65%]"><p className="text-sm font-semibold text-[#18384D]">Your data matters.</p><p className="mt-1.5 text-xs leading-5 text-[#6E879A]">Your study materials and learning history belong to you. Export or remove your data whenever you need.</p></div><div className="pointer-events-none absolute -bottom-3 -right-2 h-28 w-28 opacity-90"><Image src="/dashboard-hero/settings.png" alt="" fill sizes="112px" className="object-contain object-bottom" /></div></section>
      </div>
    </div>

    {privacyOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2F2930]/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPrivacyOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="privacy-title" className="w-full max-w-lg rounded-2xl border border-[#E8E2E5] bg-white p-5 shadow-xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="privacy-title" className="text-lg font-bold text-[#18384D]">Your data, your choice</h2><p className="mt-1 text-sm text-[#6E879A]">What these controls do</p></div><button type="button" onClick={() => setPrivacyOpen(false)} aria-label="Close privacy information" className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[#756B72] hover:bg-[#FFF7F9]">×</button></div><ul className="mt-4 space-y-3 text-sm leading-6 text-[#756B72]"><li><strong className="text-[#2F2930]">Export:</strong> downloads available profile details, subjects, flashcards, review records, and completed sessions as JSON. Password hashes and session tokens are excluded.</li><li><strong className="text-[#2F2930]">Clear Study History:</strong> removes review records and completed sessions while preserving your subjects and flashcards.</li><li><strong className="text-[#2F2930]">Delete Study Materials:</strong> removes subjects, flashcards, and associated review/session records while preserving your account.</li><li><strong className="text-[#2F2930]">Delete Account:</strong> removes your account and associated study data. Confirm before proceeding because this cannot be undone.</li></ul><p className="mt-4 rounded-xl bg-[#FFF7F9] p-3 text-xs leading-5 text-[#756B72]">This panel describes the controls currently implemented in Abii; it is not a substitute for a full published privacy policy.</p><div className="mt-5 flex justify-end"><button type="button" onClick={() => setPrivacyOpen(false)} className={buttonClass}>Got it</button></div></section></div>}
  </div>;
}
