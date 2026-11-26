"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Fingerprint, RefreshCw, ShieldCheck, Timer } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { SkeletonBlock } from "@/components/ui/skeleton";

type Snapshot = {
  serverNow: number;
  authenticatedAt: number;
  absoluteExpiresAt: number;
  lastActivityAt: number;
  inactivityExpiresAt: number;
  freshExpiresAt: number;
  sessionLifetimeSeconds: number;
  inactivityTimeoutSeconds: number;
  freshAuthenticationSeconds: number;
  mfaVerified: boolean;
};
type LoadState = "loading" | "ready" | "unavailable" | "denied";
const returnToSecurity = `/login?adminReauth=1&next=${encodeURIComponent("/admin/security")}`;
const pht = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

function formatTime(seconds: number, hours = false) {
  const total = Math.ceil(Math.max(0, seconds));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return hours ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function TimerCard({ icon: Icon, label, policy, remaining, total, detail, hours, warning, expired }: {
  icon: typeof Clock; label: string; policy: string; remaining: number; total: number; detail: string; hours?: boolean; warning: boolean; expired?: boolean;
}) {
  const percentage = total > 0 ? Math.min(100, Math.max(0, remaining / total * 100)) : 0;
  return <article className="flex min-h-[174px] min-w-0 flex-col rounded-xl border border-border bg-white p-4 sm:p-5">
    <div className="flex min-w-0 items-center gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFE8EF] text-[#A13C62]"><Icon aria-hidden="true" size={18} /></span><h3 className="min-w-0 text-sm font-semibold">{label}</h3></div>
    <p className={`mt-4 whitespace-nowrap text-[clamp(1.7rem,4vw,2.1rem)] font-bold leading-none tracking-tight tabular-nums ${warning || expired ? "text-[#946013]" : "text-foreground"}`}>{formatTime(remaining, hours)}</p>
    <p className="mt-2 text-xs text-muted">{policy}</p>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F1E6EA]" role="progressbar" aria-label={`${label} remaining`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(total, Math.floor(remaining))} aria-valuetext={formatTime(remaining, hours)}>
      <div className={`h-full rounded-full ${warning || expired ? "bg-[#D69A39]" : "bg-[#F8769C]"}`} style={{ width: `${percentage}%` }} />
    </div>
    <p className={`mt-2 text-xs leading-5 ${warning || expired ? "font-medium text-[#946013]" : "text-muted"}`}>{detail}</p>
  </article>;
}

function Timestamp({ label, value }: { label: string; value: number }) {
  const date = new Date(value);
  return <div className="min-w-0"><dt className="text-[11px] font-medium text-muted">{label}</dt><dd className="mt-0.5 break-words text-xs font-medium text-foreground"><time dateTime={date.toISOString()}>{pht.format(date)} PHT</time></dd></div>;
}

export function AdminSessionSecurity() {
  const { toast } = useToast();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [now, setNow] = useState(0);
  const requestVersion = useRef(0);
  const latestServerNow = useRef(0);
  const clockOffset = useRef(0);
  const checkedDeadline = useRef("");
  const warned = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const sent = Date.now();
    try {
      const response = await fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" });
      if (version !== requestVersion.current) return;
      if (response.status === 401) {
        window.location.replace(`/login?sessionExpired=1&next=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
        return;
      }
      if (!response.ok) { setState(response.status === 403 ? "denied" : "unavailable"); return; }
      const data = await response.json() as Snapshot;
      if (version !== requestVersion.current || !Number.isFinite(data.serverNow) || data.serverNow < latestServerNow.current) return;
      const received = Date.now();
      latestServerNow.current = data.serverNow;
      clockOffset.current = data.serverNow - (sent + received) / 2;
      setSnapshot(data);
      setNow(received + clockOffset.current);
      setState("ready");
    } catch {
      if (version === requestVersion.current) setState("unavailable");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  // Anchor each display tick to the server clock estimate captured with its snapshot.
  useEffect(() => {
    if (!snapshot || state !== "ready") return;
    const tick = window.setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => window.clearInterval(tick);
  }, [snapshot, state]);
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    const onSync = () => { void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("admin-session-sync", onSync);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("abii-admin-session");
    if (channel) channel.onmessage = event => { if (event.data === "refresh" || event.data === "invalidate") void refresh(); };
    return () => { document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("admin-session-sync", onSync); channel?.close(); };
  }, [refresh]);

  const absolute = snapshot ? Math.max(0, (snapshot.absoluteExpiresAt - now) / 1000) : 0;
  const inactivity = snapshot ? Math.max(0, (snapshot.inactivityExpiresAt - now) / 1000) : 0;
  const fresh = snapshot ? Math.max(0, (snapshot.freshExpiresAt - now) / 1000) : 0;
  const expirationPending = state === "ready" && Boolean(snapshot) && (absolute === 0 || inactivity === 0);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("admin-session-check", { detail: expirationPending }));
    return () => { if (expirationPending) window.dispatchEvent(new CustomEvent("admin-session-check", { detail: false })); };
  }, [expirationPending]);
  useEffect(() => {
    if (!snapshot || state !== "ready") return;
    if (absolute === 0 || inactivity === 0) {
      const deadline = `${snapshot.absoluteExpiresAt}:${snapshot.inactivityExpiresAt}`;
      if (checkedDeadline.current !== deadline) { checkedDeadline.current = deadline; void refresh(); }
      return;
    }
    checkedDeadline.current = "";
    const warnings = [
      ["lifetime", absolute, 900, "Administrator session expires soon", "Sign in again soon to continue your work."],
      ["inactivity", inactivity, 120, "Inactivity sign-out is near", "Continue working to keep this session active."],
      ["fresh", fresh, 30, "Fresh authentication expired", "Reauthenticate before sensitive actions."],
    ] as const;
    for (const [key, remaining, threshold, title, message] of warnings) {
      const id = `${key}:${key === "lifetime" ? snapshot.absoluteExpiresAt : key === "inactivity" ? snapshot.inactivityExpiresAt : snapshot.freshExpiresAt}`;
      if (remaining > 0 && remaining <= threshold && !warned.current.has(id)) {
        warned.current.add(id);
        toast({ kind: "warning", title, message });
      }
    }
  }, [absolute, inactivity, fresh, refresh, snapshot, state, toast]);

  const expired = expirationPending;
  const active = state === "ready" && !expired;
  const unavailable = state === "unavailable" || state === "denied";
  const statusText = state === "loading" ? "Verifying" : active ? "Active" : expired ? "Checking" : state === "denied" ? "Access denied" : "Unavailable";
  const statusStyle = active ? "bg-[#E7F4EC] text-[#287454]" : "bg-[#FFF4E0] text-[#946013]";

  return <section aria-labelledby="session-security-title" className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="session-security-title" className="text-lg font-semibold tracking-tight">Session Security</h2><p className="mt-1 text-sm text-muted">Monitor your current administrator session.</p></div>
      <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${statusStyle}`}><ShieldCheck size={14} aria-hidden="true" />{statusText}</span>
    </div>
    {unavailable ? <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[#FAF9F7] p-4 text-sm text-muted">
      <span>{state === "denied" ? "Administrator session access was denied." : "Session status is temporarily unavailable."}</span><button type="button" onClick={() => { setState("loading"); void refresh(); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 font-semibold text-foreground hover:bg-[#FFE8EF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F8769C]"><RefreshCw size={15} aria-hidden="true" />Retry</button>
    </div> : state === "loading" ? <SessionSecuritySkeleton embedded /> : <>
      {expired && <p role="status" className="mt-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-sm text-[#765318]">Confirming your session with the server…</p>}
      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <TimerCard icon={Clock} label="Session lifetime" policy="8-hour maximum" remaining={absolute} total={snapshot!.sessionLifetimeSeconds} hours detail={absolute <= 900 ? "Session expires soon" : `Expires at ${pht.format(snapshot!.absoluteExpiresAt)} PHT`} warning={absolute <= 900} />
        <TimerCard icon={Timer} label="Inactivity timeout" policy="30-minute limit" remaining={inactivity} total={snapshot!.inactivityTimeoutSeconds} detail={inactivity <= 120 ? "Sign-out is approaching" : "Time before inactivity sign-out"} warning={inactivity <= 120} />
        <div className="sm:col-span-2 xl:col-span-1"><TimerCard icon={Fingerprint} label="Fresh authentication" policy="5-minute window" remaining={fresh} total={snapshot!.freshAuthenticationSeconds} detail={fresh > 0 ? "Fresh authentication verified" : "Reauthentication required for sensitive actions"} warning={fresh <= 30} expired={fresh === 0} /></div>
      </div>
      <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2 text-sm font-semibold text-[#287454]"><ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><div><p>Password + Google Authenticator · MFA verified</p><dl className="mt-2 grid min-w-0 grid-cols-1 gap-x-5 gap-y-2 text-foreground sm:grid-cols-2 xl:grid-cols-3"><Timestamp label="Session started" value={snapshot!.authenticatedAt} /><Timestamp label="Absolute expiration" value={snapshot!.absoluteExpiresAt} /><Timestamp label="Last verified activity" value={snapshot!.lastActivityAt} /></dl></div></div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end"><div className="text-xs leading-5 text-muted"><p className="font-semibold text-foreground">Refresh authentication</p><p>Verify your identity before performing sensitive actions.</p></div><Link href={returnToSecurity} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[#F4B8CD] bg-[#FFE8EF] px-4 text-sm font-semibold text-[#30262B] hover:bg-[#FFDCE7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F8769C]">Reauthenticate</Link></div>
      </div>
    </>}
  </section>;
}

export function SessionSecuritySkeleton({ embedded = false }: { embedded?: boolean }) {
  const details = <><div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(index => <div key={index} className={index === 2 ? "sm:col-span-2 xl:col-span-1" : ""}>
      <SkeletonBlock className="h-[174px] rounded-xl" />
    </div>)}</div>
    <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><SkeletonBlock className="h-16 w-full rounded-lg" /><SkeletonBlock className="h-16 w-full rounded-lg sm:max-w-sm" /></div></>;
  if (embedded) return <div aria-hidden="true" className="mt-4 grid min-w-0 gap-4">{details}</div>;
  return <section aria-hidden="true" className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-start justify-between gap-3"><div className="grid gap-2"><SkeletonBlock className="h-6 w-40 rounded-md" /><SkeletonBlock className="h-4 w-64 max-w-full rounded-md" /></div><SkeletonBlock className="h-7 w-20 rounded-full" /></div>
    {details}
  </section>;
}
