"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MonitorCog, ShieldCheck } from "lucide-react";
import { AdminPanel } from "./admin-ui";

type Snapshot = {
  profile: { name: string; email: string; status: string; lastLoginAt: string | null; revision: number };
  settings: { revision: number; preferences: { sessionWarningEnabled: boolean; sessionWarningLeadMinutes: number; operationalWarnings: boolean }; monitoring: { serverErrorPercent: number; latencyMs: number; reminderWarnings: boolean; monitoringNotices: boolean }; platform: { publicSupportNoticeEnabled: boolean; publicSupportNoticeText: string } };
  monitoring: { state: "healthy" | "warning" | "unknown" | "unavailable" | "disabled"; alerts: { metric: string; threshold: string; evidence: string }[] };
  session: { expiresAt: string; lifetimeMinutes: number };
};
const field = "min-h-11 w-full rounded-lg border border-[#E7D8DF] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#AF3860]";
const button = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#91314E] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#AF3860]";
const quietButton = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E2CDD5] bg-white px-4 text-sm font-semibold text-[#81304D] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#AF3860]";
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
  if (!data) return <div className="rounded-xl border border-[#F0E5E9] bg-white p-5 text-sm text-muted" role={error ? "alert" : "status"}>{error || "Loading administrator settings…"}</div>;
  const preferences = preferencesDraft ?? data.settings.preferences;
  const monitoring = monitoringDraft ?? data.settings.monitoring;
  const platform = platformDraft ?? data.settings.platform;
  return <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
    <div className="grid min-w-0 gap-4">
      {(feedback || error || (data.settings.preferences.operationalWarnings && (data.monitoring.state === "unavailable" || data.monitoring.state === "unknown"))) && <div role={error || expiryWarning ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${error ? "border-[#E8B7C7] bg-[#FFF5F7] text-[#862541]" : "border-[#EDD9E1] bg-[#FFF9FB] text-[#66505B]"}`}>{error || feedback || "Monitoring evidence is incomplete, so Abii is not treating missing telemetry as healthy."}{needsReload && <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Reload settings</button>}</div>}
      {expiryWarning && <div role="alert" className="rounded-xl border border-[#E3C28D] bg-[#FFF9EE] px-4 py-3 text-sm leading-6 text-[#76501B]">Your administrator session is close to expiry. Saving settings will require a fresh sign-in once it expires.</div>}
      <AdminPanel title="Administrator profile & security" description="The registered email is intentionally immutable.">
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void save({ action: "profile", name, revision: data.profile.revision }, "profile"); }}>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Display name<input className={field} value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label><label className="grid gap-1.5 text-sm font-semibold">Registered email<input className={`${field} bg-[#FCF8FA] text-muted`} value={data.profile.email} readOnly /></label></div>
          <dl className="grid gap-2 rounded-lg bg-[#FFF8FA] p-3 text-sm sm:grid-cols-3"><div><dt className="text-muted">Role</dt><dd className="font-semibold">Primary Administrator</dd></div><div><dt className="text-muted">MFA</dt><dd className="font-semibold text-[#32654E]">Authenticator protected</dd></div><div><dt className="text-muted">Last sign-in</dt><dd className="font-semibold">{stamp(data.profile.lastLoginAt)}</dd></div></dl>
          <div><button className={button} disabled={pending !== "" || name.trim() === data.profile.name || name.trim().length < 2} type="submit">{pending === "profile" ? "Saving…" : "Save profile"}</button></div>
        </form>
        <div className="mt-5 border-t border-[#F0E5E9] pt-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#51748A]" aria-hidden="true" /><p className="text-sm leading-6 text-muted">MFA uses the enrolled authenticator. Recovery and authenticator reset stay in the secured operator procedure; this workspace never reveals seeds, recovery codes, or keys.</p></div></div>
      </AdminPanel>
      <AdminPanel title="Monitoring alerts" description="Uses observed monitoring evidence; incomplete data stays unknown.">
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void save({ action: "settings", section: "monitoring", revision: data.settings.revision, values: monitoring }, "monitoring"); }}>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Server-error threshold<select className={field} value={monitoring.serverErrorPercent} onChange={event => setMonitoringDraft({ ...monitoring, serverErrorPercent: Number(event.target.value) })}>{[1, 2, 5, 10, 15, 20].map(value => <option key={value} value={value}>{value}%</option>)}</select></label><label className="grid gap-1.5 text-sm font-semibold">Latency threshold<select className={field} value={monitoring.latencyMs} onChange={event => setMonitoringDraft({ ...monitoring, latencyMs: Number(event.target.value) })}>{[250, 500, 1000, 2000, 5000].map(value => <option key={value} value={value}>{value} ms p95</option>)}</select></label></div>
          <Check label="Show in-dashboard monitoring alerts" checked={monitoring.monitoringNotices} onChange={checked => setMonitoringDraft({ ...monitoring, monitoringNotices: checked })} /><Check label="Surface reminder-job failures or overdue evidence" checked={monitoring.reminderWarnings} onChange={checked => setMonitoringDraft({ ...monitoring, reminderWarnings: checked })} />
          <div className="rounded-lg border border-[#EBDDE2] bg-[#FFFBFC] p-3 text-sm"><p className="font-semibold">Current state: {data.monitoring.state}</p>{data.monitoring.alerts.length ? <ul className="mt-2 grid gap-1 text-muted">{data.monitoring.alerts.map(alert => <li key={alert.metric}><span className="font-medium text-foreground">{alert.metric}</span> — {alert.evidence} (threshold {alert.threshold})</li>)}</ul> : <p className="mt-1 text-muted">No supported alert is currently triggered.</p>}</div>
          <div><button className={button} disabled={pending !== "" || JSON.stringify(monitoring) === JSON.stringify(data.settings.monitoring)} type="submit">{pending === "monitoring" ? "Saving…" : "Save monitoring alerts"}</button></div>
        </form>
      </AdminPanel>
      <AdminPanel title="Platform configuration" description="Only explicitly allowlisted, non-secret configuration is available here.">
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void save({ action: "settings", section: "platform", revision: data.settings.revision, values: platform }, "platform"); }}>
          <Check label="Show a public support notice" checked={platform.publicSupportNoticeEnabled} onChange={checked => setPlatformDraft({ ...platform, publicSupportNoticeEnabled: checked })} />
          <label className="grid gap-1.5 text-sm font-semibold">Notice text<textarea className={`${field} min-h-24 py-2`} maxLength={500} value={platform.publicSupportNoticeText} onChange={event => setPlatformDraft({ ...platform, publicSupportNoticeText: event.target.value })} /></label>
          <p className="text-xs leading-5 text-muted">Displayed as plain text on the public Support page. Environment variables, authentication policy, credentials, and deployment configuration are never editable here.</p>
          <div><button className={button} disabled={pending !== "" || JSON.stringify(platform) === JSON.stringify(data.settings.platform) || (platform.publicSupportNoticeEnabled && !platform.publicSupportNoticeText.trim())} type="submit">{pending === "platform" ? "Saving…" : "Save platform configuration"}</button></div>
        </form>
      </AdminPanel>
    </div>
    <div className="grid min-w-0 content-start gap-4">
      <AdminPanel title="Sessions & notifications" description={`Administrator sessions expire after ${data.session.lifetimeMinutes} minutes.`}>
        <div className="grid gap-4"><p className="rounded-lg bg-[#FFF8FA] p-3 text-sm leading-6 text-muted">This session expires at <time dateTime={data.session.expiresAt} className="font-semibold text-foreground">{stamp(data.session.expiresAt)}</time>. Warnings never extend access.</p>
          <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void save({ action: "settings", section: "preferences", revision: data.settings.revision, values: preferences }, "preferences"); }}><Check label="Warn before this session expires" checked={preferences.sessionWarningEnabled} onChange={checked => setPreferencesDraft({ ...preferences, sessionWarningEnabled: checked })} /><label className="grid gap-1.5 text-sm font-semibold">Warning lead time<select className={field} value={preferences.sessionWarningLeadMinutes} disabled={!preferences.sessionWarningEnabled} onChange={event => setPreferencesDraft({ ...preferences, sessionWarningLeadMinutes: Number(event.target.value) })}>{[2, 5, 10].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label><Check label="Display operational warnings in this workspace" checked={preferences.operationalWarnings} onChange={checked => setPreferencesDraft({ ...preferences, operationalWarnings: checked })} /><div><button className={button} disabled={pending !== "" || JSON.stringify(preferences) === JSON.stringify(data.settings.preferences)} type="submit">{pending === "preferences" ? "Saving…" : "Save preferences"}</button></div></form>
          <form onSubmit={event => { event.preventDefault(); if (window.confirm("Sign out and revoke all active administrator sessions?")) void fetch("/api/auth/logout", { method: "POST" }).then(response => response.ok ? window.location.replace("/login") : setError("Sign-out could not be confirmed.")); }}><button type="submit" className={quietButton}>Sign out and revoke sessions</button></form>
        </div>
      </AdminPanel>
      <AdminPanel title="Change password" description="Requires your current password and a fresh MFA-backed session.">
        <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void save({ action: "password", ...password }, "password"); }}><label className="grid gap-1.5 text-sm font-semibold">Current password<input className={field} type="password" autoComplete="current-password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">New password<input className={field} type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Confirm new password<input className={field} type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password.confirmPassword} onChange={event => setPassword({ ...password, confirmPassword: event.target.value })} /></label><Check label="I understand this signs out every administrator session." checked={password.confirmed} onChange={checked => setPassword({ ...password, confirmed: checked })} /><button className={button} disabled={pending !== "" || !password.confirmed} type="submit"><KeyRound size={16} aria-hidden="true" /> {pending === "password" ? "Changing…" : "Change password and sign out"}</button></form>
      </AdminPanel>
      <div className="rounded-xl border border-[#EBDDE2] bg-[#FFFBFC] p-4 text-sm leading-6 text-muted"><MonitorCog className="mb-2 text-[#91314E]" aria-hidden="true" /><p><strong className="text-foreground">Supported delivery:</strong> in-dashboard alerts only. Abii does not claim email, SMS, push, or background administrator alert delivery in this workspace.</p></div>
    </div>
  </div>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[#91314E]" checked={checked} onChange={event => onChange(event.target.checked)} />{label}</label>; }
