"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MonitorCog, ShieldCheck } from "lucide-react";
import { AdminPanel } from "./admin-ui";
import { Button } from "@/components/ui/button";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";

type Snapshot = {
  profile: { name: string; email: string; status: string; lastLoginAt: string | null; revision: number };
  settings: { revision: number; preferences: { sessionWarningEnabled: boolean; sessionWarningLeadMinutes: number; operationalWarnings: boolean }; monitoring: { serverErrorPercent: number; latencyMs: number; reminderWarnings: boolean; monitoringNotices: boolean }; platform: { publicSupportNoticeEnabled: boolean; publicSupportNoticeText: string } };
  monitoring: { state: "healthy" | "warning" | "unknown" | "unavailable" | "disabled"; alerts: { metric: string; threshold: string; evidence: string }[] };
  session: { expiresAt: string; lifetimeMinutes: number };
};
const field = "min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#F8769C]";
function stamp(value: string | null) { return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No recorded sign-in"; }

export function AdminSettings() {
  const router = useRouter();
  const [data, setData] = useState<Snapshot | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [name, setName] = useState("");
  const [preferencesDraft, setPreferencesDraft] = useState<Snapshot["settings"]["preferences"] | null>(null);
  const [monitoringDraft, setMonitoringDraft] = useState<Snapshot["settings"]["monitoring"] | null>(null);
  const [platformDraft, setPlatformDraft] = useState<Snapshot["settings"]["platform"] | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", confirmed: false });
  const passwordDialog = useRef<HTMLDialogElement>(null);
  const confirmPasswordInput = useRef<HTMLInputElement>(null);
  const [expiryWarning, setExpiryWarning] = useState(false);
  const expires = useMemo(() => data ? new Date(data.session.expiresAt).getTime() : 0, [data]);
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!data?.settings.preferences.sessionWarningEnabled || !expires) return;
    const wait = Math.max(0, expires - Date.now() - data.settings.preferences.sessionWarningLeadMinutes * 60_000);
    const warning = window.setTimeout(() => setExpiryWarning(true), wait);
    const expired = window.setTimeout(() => window.location.replace("/login"), Math.max(0, expires - Date.now()) + 1000);
    return () => { window.clearTimeout(warning); window.clearTimeout(expired); };
  }, [data, expires]);
  async function load() {
    setError("");
    try { const response = await fetch("/api/admin/settings", { cache: "no-store" }); const value = await response.json() as Snapshot & { message?: string }; if (!response.ok) throw new Error(value.message || "Unable to load settings."); setData(value); setName(value.profile.name); setPreferencesDraft(value.settings.preferences); setMonitoringDraft(value.settings.monitoring); setPlatformDraft(value.settings.platform); setNeedsReload(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load settings."); }
  }
  async function save(payload: Record<string, unknown>, kind: string) {
    setPending(kind); setError(""); setFeedback("");
    try { const response = await fetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const value = await response.json() as { message?: string; snapshot?: Snapshot; signedOut?: boolean }; if (!response.ok) { setNeedsReload(response.status === 409); throw new Error(value.message || "Unable to save settings."); }
      if (value.signedOut) { window.location.replace("/login"); return; }
      if (!value.snapshot) throw new Error("Settings were not confirmed. Reload and try again.");
      setData(value.snapshot);
      if (kind === "profile") { setName(value.snapshot.profile.name); router.refresh(); }
      if (kind === "preferences") { setPreferencesDraft(value.snapshot.settings.preferences); setExpiryWarning(false); }
      if (kind === "monitoring") setMonitoringDraft(value.snapshot.settings.monitoring);
      if (kind === "platform") setPlatformDraft(value.snapshot.settings.platform);
      setFeedback("Saved successfully.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save settings."); }
    finally { setPending(""); }
  }
  if (!data) return error ? <div className="grid gap-3 rounded-xl border border-error/30 bg-error-bg p-5 text-error-text" role="alert"><p className="text-sm">{error}</p><Button variant="outline" onClick={() => void load()} className="justify-self-start">Retry loading settings</Button></div> : <SettingsSkeleton />;
  const preferences = preferencesDraft ?? data.settings.preferences;
  const monitoring = monitoringDraft ?? data.settings.monitoring;
  const platform = platformDraft ?? data.settings.platform;
  return <div className="grid min-w-0 gap-4">
    <header className="grid gap-1"><h2 className="text-lg font-bold tracking-tight">Administrator Settings</h2><p className="text-sm text-muted">Manage account preferences, security and platform configuration.</p><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FFE8EF] px-3 py-2 text-sm"><span className="inline-flex items-center gap-2 font-semibold"><ShieldCheck size={16} aria-hidden="true"/>Primary Administrator</span><span className="text-xs font-medium">Authenticator protected</span></div></header>
    {(feedback || error || (data.settings.preferences.operationalWarnings && (data.monitoring.state === "unavailable" || data.monitoring.state === "unknown"))) && <div role={error || expiryWarning ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${error ? "border-error/30 bg-error-bg text-error-text" : expiryWarning || data.monitoring.state === "warning" || data.monitoring.state === "unavailable" || data.monitoring.state === "unknown" ? "border-warning/30 bg-warning-bg text-warning-text" : "border-success/30 bg-success-bg text-success-text"}`}>{error || feedback || "Monitoring evidence is incomplete, so Abii is not treating missing telemetry as healthy."}{needsReload && <Button variant="ghost" size="sm" onClick={() => void load()} className="ml-2 min-h-0 px-0 text-xs underline">Reload settings</Button>}</div>}
    {expiryWarning && <div role="alert" className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm leading-6 text-warning-text">Your administrator session is close to expiry. Saving settings will require a fresh sign-in once it expires.</div>}
    <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div className="contents">
      <AdminPanel className="xl:col-start-1 xl:row-start-1" stretch title="Administrator Profile" description="Manage your administrator identity.">
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void save({ action: "profile", name, revision: data.profile.revision }, "profile"); }}>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Display name<input className={field} value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label><label className="grid gap-1.5 text-sm font-semibold">Registered email<input className={`${field} bg-[#FFFFFF] text-muted`} value={data.profile.email} readOnly /></label></div>
          <dl className="grid gap-2 rounded-lg bg-[#FFFFFF] p-3 text-sm sm:grid-cols-3"><div><dt className="text-muted">Role</dt><dd className="font-semibold">Primary Administrator</dd></div><div><dt className="text-muted">MFA</dt><dd className="font-semibold text-foreground">Authenticator protected</dd></div><div><dt className="text-muted">Last sign-in</dt><dd className="font-semibold">{stamp(data.profile.lastLoginAt)}</dd></div></dl>
          <div><Button type="submit" disabled={pending !== "" || name.trim() === data.profile.name || name.trim().length < 2}>{pending === "profile" ? "Saving…" : "Save profile"}</Button></div>
        </form>
        <div className="mt-5 border-t border-border pt-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#F8769C]" aria-hidden="true" /><p className="text-sm leading-6 text-muted">MFA uses the enrolled authenticator. Recovery and authenticator reset stay in the secured operator procedure; this workspace never reveals seeds, recovery codes, or keys.</p></div></div>
      </AdminPanel>
      <AdminPanel className="xl:col-start-1 xl:row-start-2" stretch title="Monitoring Alerts" description="Configure alerts using observed system evidence.">
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void save({ action: "settings", section: "monitoring", revision: data.settings.revision, values: monitoring }, "monitoring"); }}>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Server-error threshold<select className={field} value={monitoring.serverErrorPercent} onChange={event => setMonitoringDraft({ ...monitoring, serverErrorPercent: Number(event.target.value) })}>{[1, 2, 5, 10, 15, 20].map(value => <option key={value} value={value}>{value}%</option>)}</select></label><label className="grid gap-1.5 text-sm font-semibold">Latency threshold<select className={field} value={monitoring.latencyMs} onChange={event => setMonitoringDraft({ ...monitoring, latencyMs: Number(event.target.value) })}>{[250, 500, 1000, 2000, 5000].map(value => <option key={value} value={value}>{value} ms p95</option>)}</select></label></div>
          <Check label="Show in-dashboard monitoring alerts" checked={monitoring.monitoringNotices} onChange={checked => setMonitoringDraft({ ...monitoring, monitoringNotices: checked })} /><Check label="Surface reminder-job failures or overdue evidence" checked={monitoring.reminderWarnings} onChange={checked => setMonitoringDraft({ ...monitoring, reminderWarnings: checked })} />
          <div className="rounded-lg border border-border bg-[#FFFFFF] p-3 text-sm"><p className="font-semibold">Current state: {data.monitoring.state}</p>{data.monitoring.alerts.length ? <ul className="mt-2 grid gap-1 text-muted">{data.monitoring.alerts.map(alert => <li key={alert.metric}><span className="font-medium text-foreground">{alert.metric}</span> — {alert.evidence} (threshold {alert.threshold})</li>)}</ul> : <p className="mt-1 text-muted">No supported alert is currently triggered.</p>}</div>
          <div><Button type="submit" disabled={pending !== "" || JSON.stringify(monitoring) === JSON.stringify(data.settings.monitoring)}>{pending === "monitoring" ? "Saving…" : "Save monitoring alerts"}</Button></div>
        </form>
      </AdminPanel>
      <AdminPanel className="xl:col-span-2 xl:row-start-3" stretch title="Platform Configuration" description="Manage the public Support page notice.">
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void save({ action: "settings", section: "platform", revision: data.settings.revision, values: platform }, "platform"); }}>
          <Check label="Show a public support notice" checked={platform.publicSupportNoticeEnabled} onChange={checked => setPlatformDraft({ ...platform, publicSupportNoticeEnabled: checked })} />
          <div className="grid min-w-0 gap-3 md:grid-cols-2"><label className="grid min-w-0 gap-1.5 text-sm font-semibold">Notice text<span className="relative"><textarea className={`${field} min-h-24 py-2 pb-7`} maxLength={500} value={platform.publicSupportNoticeText} onChange={event => setPlatformDraft({ ...platform, publicSupportNoticeText: event.target.value })} /><span className="pointer-events-none absolute bottom-2 right-3 text-xs font-normal text-muted">{platform.publicSupportNoticeText.length} / 500</span></span></label><div className="min-w-0"><p className="mb-1.5 text-sm font-semibold">Notice Preview</p><div className="grid min-h-24 content-center rounded-lg border border-border bg-[#FFFFFF] px-4 py-3 text-center"><p className="break-words text-sm font-semibold">{platform.publicSupportNoticeEnabled && platform.publicSupportNoticeText.trim() ? platform.publicSupportNoticeText : "Public notice disabled"}</p>{(!platform.publicSupportNoticeEnabled || !platform.publicSupportNoticeText.trim()) && <p className="mt-1 text-xs text-muted">{platform.publicSupportNoticeEnabled ? "Add notice text to preview the public message." : "No notice will appear on the Support page."}</p>}</div></div></div>
          <p className="text-xs leading-5 text-muted">Displayed as plain text on the public Support page. Environment variables, authentication policy, credentials, and deployment configuration are never editable here.</p>
          <div><Button type="submit" disabled={pending !== "" || JSON.stringify(platform) === JSON.stringify(data.settings.platform) || (platform.publicSupportNoticeEnabled && !platform.publicSupportNoticeText.trim())}>{pending === "platform" ? "Saving…" : "Save platform configuration"}</Button></div>
        </form>
      </AdminPanel>
    </div>
    <div className="contents">
      <AdminPanel className="xl:col-start-2 xl:row-start-1" stretch title="Session & Preferences" description="Manage workspace alerts and session warnings.">
        <div className="grid gap-4"><p className="rounded-lg bg-[#FFFFFF] p-3 text-sm leading-6 text-muted">This session expires at <time dateTime={data.session.expiresAt} className="font-semibold text-foreground">{stamp(data.session.expiresAt)}</time>. Warnings never extend access.</p>
          <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void save({ action: "settings", section: "preferences", revision: data.settings.revision, values: preferences }, "preferences"); }}><Check label="Warn before this session expires" checked={preferences.sessionWarningEnabled} onChange={checked => setPreferencesDraft({ ...preferences, sessionWarningEnabled: checked })} /><label className="grid gap-1.5 text-sm font-semibold">Warning lead time<select className={field} value={preferences.sessionWarningLeadMinutes} disabled={!preferences.sessionWarningEnabled} onChange={event => setPreferencesDraft({ ...preferences, sessionWarningLeadMinutes: Number(event.target.value) })}>{[2, 5, 10].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label><Check label="Display operational warnings in this workspace" checked={preferences.operationalWarnings} onChange={checked => setPreferencesDraft({ ...preferences, operationalWarnings: checked })} /><div><Button type="submit" disabled={pending !== "" || JSON.stringify(preferences) === JSON.stringify(data.settings.preferences)}>{pending === "preferences" ? "Saving…" : "Save preferences"}</Button></div></form>
        </div>
      </AdminPanel>
      <AdminPanel className="xl:col-start-2 xl:row-start-2" stretch title="Account Security" description="Manage password and administrator access.">
        <div className="grid gap-4"><div className="rounded-lg bg-[#FFE8EF] p-3"><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} aria-hidden="true"/>Multi-factor authentication</p><p className="mt-1 pl-6 text-xs text-muted">Required · Authenticator protected</p></div><div><p className="text-sm font-semibold">Password</p><p className="mt-1 text-xs leading-5 text-muted">Requires your current password and a fresh MFA-backed session.</p><Button variant="outline" onClick={() => { setError(""); passwordDialog.current?.showModal(); }} className="mt-3 w-full">Change password <span aria-hidden="true" className="ml-1">→</span></Button></div><div className="border-t border-border pt-3"><p className="text-sm font-semibold">Administrator sessions</p><p className="mt-1 text-xs leading-5 text-muted">Revoke existing administrator access and sign out.</p><form className="mt-3" onSubmit={event => { event.preventDefault(); if (window.confirm("Sign out and revoke all active administrator sessions?")) void fetch("/api/auth/logout", { method: "POST" }).then(response => response.ok ? window.location.replace("/login") : setError("Sign-out could not be confirmed.")); }}><Button type="submit" variant="outline" className="w-full">Sign out and revoke sessions</Button></form></div></div>
      </AdminPanel>
      <div className="xl:col-span-2 xl:row-start-4 rounded-xl border border-border bg-[#FFE8EF] p-3 text-sm leading-6 text-muted"><MonitorCog className="mr-2 inline text-[#F8769C]" aria-hidden="true" /><strong className="text-foreground">Protected configuration.</strong> Credentials, deployment settings, and authentication policies remain operator-managed. Supported alerts are in-dashboard only.</div>
    </div>
    <dialog ref={passwordDialog} aria-labelledby="password-dialog-title" aria-describedby="password-dialog-description" className="m-auto w-[min(100%-2rem,32rem)] rounded-2xl border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-[#30262B]/30">
      <div className="border-b border-border px-5 py-4"><h3 id="password-dialog-title" className="text-lg font-bold">Change administrator password</h3><p id="password-dialog-description" className="mt-1 text-sm text-muted">Your current password and a fresh MFA-backed session are required.</p></div>
      <form className="grid gap-3 p-5" onSubmit={event => { event.preventDefault(); if (password.newPassword !== password.confirmPassword) { confirmPasswordInput.current?.focus(); setError("New passwords must match."); return; } void save({ action: "password", ...password }, "password"); }}>
        {error && <p role="alert" className="rounded-lg bg-error-bg p-3 text-sm text-error-text">{error}</p>}
        <label className="grid gap-1.5 text-sm font-semibold">Current password<input className={field} type="password" required autoComplete="current-password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })}/></label>
        <label className="grid gap-1.5 text-sm font-semibold">New password<input className={field} type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })}/></label>
        <label className="grid gap-1.5 text-sm font-semibold">Confirm new password<input ref={confirmPasswordInput} className={field} type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={password.confirmPassword} onChange={event => setPassword({ ...password, confirmPassword: event.target.value })}/></label>
        <Check label="I understand this signs out every administrator session." checked={password.confirmed} onChange={checked => setPassword({ ...password, confirmed: checked })}/>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => passwordDialog.current?.close()}>Cancel</Button><Button type="submit" disabled={pending !== "" || !password.confirmed}><KeyRound size={16} aria-hidden="true"/> {pending === "password" ? "Changing…" : "Change password and sign out"}</Button></div>
      </form>
    </dialog>
  </div></div>;
}
export function SettingsSkeleton({ includeHero = false }: { includeHero?: boolean }) {
  return <SkeletonRegion label="Loading administrator settings" className="grid min-w-0 gap-4">{includeHero && <SkeletonBlock className="h-[168px] rounded-[18px] sm:h-[188px] lg:h-[204px]"/>}<div className="grid gap-2"><SkeletonBlock className="h-6 w-56 rounded"/><SkeletonBlock className="h-4 w-96 max-w-full rounded"/><SkeletonBlock className="h-9 rounded-lg"/></div><div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"><div className="grid content-start gap-4 rounded-2xl border border-border bg-white p-5"><SkeletonBlock className="h-7 w-2/3 rounded"/><SkeletonBlock className="h-4 w-3/4 rounded"/><SkeletonBlock className="h-16 rounded-lg"/><div className="grid gap-3 sm:grid-cols-2"><SkeletonBlock className="h-16 rounded-lg"/><SkeletonBlock className="h-16 rounded-lg"/></div><SkeletonBlock className="h-10 w-32 rounded-lg"/></div><div className="grid content-start gap-4 rounded-2xl border border-border bg-white p-5"><SkeletonBlock className="h-7 w-3/4 rounded"/><SkeletonBlock className="h-4 w-4/5 rounded"/><SkeletonBlock className="h-16 rounded-lg"/>{[0,1,2].map(key=><SkeletonBlock key={key} className="h-10 rounded-lg"/>)}<SkeletonBlock className="h-10 w-36 rounded-lg"/></div><div className="grid content-start gap-4 rounded-2xl border border-border bg-white p-5"><SkeletonBlock className="h-7 w-1/2 rounded"/><SkeletonBlock className="h-4 w-4/5 rounded"/>{[0,1,2,3].map(key=><SkeletonBlock key={key} className="h-10 rounded-lg"/>)}<SkeletonBlock className="h-10 w-40 rounded-lg"/></div><div className="grid content-start gap-4 rounded-2xl border border-border bg-white p-5"><SkeletonBlock className="h-7 w-1/2 rounded"/><SkeletonBlock className="h-4 w-4/5 rounded"/>{[0,1,2,3].map(key=><SkeletonBlock key={key} className="h-10 rounded-lg"/>)}<SkeletonBlock className="h-10 w-40 rounded-lg"/></div><div className="col-span-full grid content-start gap-4 rounded-2xl border border-border bg-white p-5"><SkeletonBlock className="h-7 w-1/3 rounded"/><SkeletonBlock className="h-4 w-1/2 rounded"/><div className="grid gap-3 sm:grid-cols-2"><SkeletonBlock className="h-24 rounded-lg"/><SkeletonBlock className="h-24 rounded-lg"/></div><SkeletonBlock className="h-10 w-48 justify-self-end rounded-lg"/></div><SkeletonBlock className="col-span-full h-10 rounded-lg"/></div></SkeletonRegion>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="abii-checkbox size-4 shrink-0" checked={checked} onChange={event => onChange(event.target.checked)} />{label}</label>; }
