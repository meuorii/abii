"use client";

import { BadgeCheck, CircleSlash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import { Button, buttonClassNames } from "@/components/ui/button";
import { type AccountChange, type AccountChangeResult, type DirectoryUser, type UserDetail,
  accountReason, reasonMax, reasonMin, usersPath } from "@/lib/admin/users-contract";

export const control = "inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EC658D]";
const datetime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const number = new Intl.NumberFormat("en-US");
const milliseconds = 25_000;

export function accountDate(date: string | null) {
  return date ? datetime.format(new Date(date)) : "Unavailable";
}

export function AccountAvatar({ name, profileImage, large }: { name: string; profileImage?: string | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [profileImage]);
  const initials = name.trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase();
  return <span aria-hidden="true" className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#FFE8EF] font-bold text-foreground ${large ? "size-[76px] text-xl" : "size-10 text-xs"}`}>
    {profileImage && !failed ? <Image src={profileImage} alt="" fill sizes={large ? "76px" : "40px"} unoptimized className="object-cover" onError={() => setFailed(true)} /> : initials || "?"}
  </span>;
}

export function AccountFlags({ user, kind }: { user: DirectoryUser; kind: "verification" | "status" }) {
  if (kind === "verification") return user.verifiedAt
    ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-text"><BadgeCheck aria-hidden="true" size={14} />Verified</span>
    : <span className="text-xs font-medium text-muted">Unverified</span>;
  return user.suspendedAt
    ? <span className="inline-flex items-center gap-1 rounded-md bg-error-bg px-1.5 py-1 text-xs font-semibold text-error-text"><CircleSlash2 aria-hidden="true" size={13} />Suspended</span>
    : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted"><span aria-hidden="true" className="size-1.5 rounded-full bg-[#F8769C]" />Active</span>;
}

const learning = [
  ["subjects", "Subjects"], ["topics", "Topics"], ["flashcards", "Flashcards"],
  ["reviews", "Recorded review attempts"], ["quizzes", "Quizzes with completion records"],
] as const;
const signIn = `/login?next=${encodeURIComponent(usersPath)}`;

function DetailSkeleton() {
  return <SkeletonRegion label="Loading account details" className="grid gap-5 px-4 py-5 sm:px-6">
    <div className="flex items-center gap-3"><SkeletonBlock className="size-12 rounded-xl" /><SkeletonBlock className="h-10 w-48 rounded-lg" /></div>
    <SkeletonBlock className="h-32 rounded-xl" />
    <div className="grid grid-cols-2 gap-2">{learning.map(([key]) => <SkeletonBlock key={key} className="h-16 rounded-lg" />)}</div>
  </SkeletonRegion>;
}

export function UserDetailSheet({ user, onClose, onChanged, onRefresh, fallbackFocus }: {
  user: DirectoryUser; onClose: () => void; onChanged: () => void; onRefresh: () => void; fallbackFocus: RefObject<HTMLHeadingElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const locked = useRef(false);
  const reading = useRef<AbortController | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [readError, setReadError] = useState<AccountChangeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState<AccountChange["action"] | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<AccountChangeResult | null>(null);
  const [reasonError, setReasonError] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const endpoint = `/api/admin/users/${user.id}`;

  async function load(url: string) {
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    setLoading(true);
    setReadError(null);
    setDetail(null);
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(milliseconds)]) });
      if (!response.ok) {
        const result = await response.json() as AccountChangeResult;
        if (!controller.signal.aborted) setReadError(result);
        return null;
      }
      const current = await response.json() as UserDetail;
      if (controller.signal.aborted) return null;
      setDetail(current);
      return current;
    } catch {
      if (!controller.signal.aborted) setReadError({ message: "Account details could not be loaded. Try again." });
      return null;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const node = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const heading = fallbackFocus.current;
    node?.showModal();
    close.current?.focus();
    return () => {
      node?.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else heading?.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);

  useEffect(() => {
    // Let the sheet mount before starting its request, including development effect replays.
    const start = window.setTimeout(() => void load(endpoint), 0);
    return () => {
      window.clearTimeout(start);
      reading.current?.abort();
    };
  }, [endpoint]);

  useEffect(() => {
    if (confirmation) reasonField.current?.focus({ preventScroll: true });
  }, [confirmation]);

  function cancelConfirmation() {
    setConfirmation(null);
    setError(null);
    setReasonError(false);
    requestAnimationFrame(() => actionButton.current?.focus({ preventScroll: true }));
  }

  async function reconcile(action: AccountChange["action"], message: string) {
    onRefresh();
    const current = await load(endpoint);
    if (!current) {
      setNotice(message);
      return;
    }
    if (Boolean(current.suspendedAt) === (action === "suspend")) {
      setConfirmation(null);
      setError(null);
      setNotice(`${message} This account is currently ${current.suspendedAt ? "suspended" : "active"}.`);
      close.current?.focus();
    } else {
      setNotice("");
      setError({ message: `${message} Review the account before confirming again.` });
      requestAnimationFrame(() => reasonField.current?.focus({ preventScroll: true }));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !confirmation || locked.current || error?.code === "reauthenticate") return;
    const validated = accountReason(reason);
    if (!validated) {
      setReasonError(true);
      reasonField.current?.focus();
      return;
    }
    locked.current = true;
    setPending(true);
    setError(null);
    try {
      const body: AccountChange = { action: confirmation, reason: validated, revision: detail.revision };
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(milliseconds) });
      const result = await response.json() as AccountChangeResult;
      if (response.ok) {
        setConfirmation(null);
        setReason("");
        setNotice(result.message);
        close.current?.focus();
        toast({ kind: "success", title: result.message });
        onChanged();
        await load(endpoint);
      } else if (result.code === "stale" || result.code === "unconfirmed") {
        await reconcile(confirmation, result.message);
      } else setError(result);
    } catch {
      await reconcile(confirmation, "The connection was interrupted and Abii could not confirm the change.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  const suspended = Boolean(detail?.suspendedAt);
  const suspending = confirmation === "suspend";
  const identity = detail ?? user;
  const title = confirmation ? suspending ? "Suspend this account?" : "Reactivate this account?" : "Account details";
  return (
    <dialog ref={dialog} aria-labelledby="admin-user-detail-title" aria-describedby={confirmation && detail ? "admin-user-change-description" : undefined}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-full overflow-y-auto overscroll-contain border-0 bg-white text-foreground shadow-2xl backdrop:bg-[#30262B]/40 sm:max-w-[480px]"
      onCancel={event => {
        event.preventDefault();
        if (locked.current) return;
        if (confirmation) cancelConfirmation();
        else onClose();
      }}>
      <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-white px-4 py-2 sm:px-6">
        <h2 id="admin-user-detail-title" className="text-lg font-bold tracking-tight">{title}</h2>
        <button type="button" ref={close} aria-label={confirmation ? "Close confirmation" : "Close account details"} className={`${control} size-11 shrink-0 hover:bg-pink-soft disabled:opacity-45`}
          onClick={confirmation ? cancelConfirmation : onClose} disabled={pending}><X size={19} aria-hidden="true" /></button>
      </header>
      {notice && <p role="status" className="mx-4 mt-4 rounded-lg border border-border bg-pink-soft px-3 py-2 text-sm sm:mx-6">{notice}</p>}
      {confirmation && detail ? (
        <form onSubmit={submit} className="grid gap-4 px-4 py-5 sm:px-6" aria-busy={pending}>
          <p id="admin-user-change-description" className="text-sm leading-6 text-muted">{suspending
            ? "This user will lose access to Abii until reactivated. All of their current sign-ins will end."
            : "This user can sign in again. They will need to start a new session."}</p>
          <div className="min-w-0 rounded-xl border border-border bg-[#FFFFFF] px-3 py-2.5 [overflow-wrap:anywhere]">
            <p className="font-semibold">{identity.name}</p><p className="text-sm text-muted">{identity.email}</p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="admin-account-reason" className="text-sm font-semibold">Reason (required)</label>
            <textarea id="admin-account-reason" ref={reasonField} rows={4} maxLength={reasonMax} required value={reason}
              readOnly={pending} aria-invalid={reasonError || undefined} aria-describedby="admin-account-reason-hint"
              onChange={event => { setReason(event.target.value); setReasonError(false); }}
              placeholder={suspending ? "Explain why this account is being suspended." : "Explain why this account is being reactivated."}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EC658D]" />
            <div id="admin-account-reason-hint" className="flex flex-wrap justify-between gap-1 text-xs text-muted">
              <span>Saved in the administrator audit log.</span><span className="tabular-nums">{reason.length}/{reasonMax}</span>
            </div>
            {reasonError && <p role="alert" className="text-sm text-error-text">Enter at least {reasonMin} characters.</p>}
          </div>
          {error && <div role="alert" className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error-text">
            <p>{error.message}</p>
            {error.code === "reauthenticate" && <Link className={buttonClassNames({ variant: "ghost", className: "mt-2 underline underline-offset-2" })} href={signIn} prefetch={false}>Sign in again</Link>}
          </div>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" className="px-3" disabled={pending} onClick={cancelConfirmation}>Cancel</Button>
            <Button type="submit" variant={suspending ? "danger" : "primary"} className="px-3"
              disabled={pending || error?.code === "reauthenticate"}>{pending ? "Confirming…" : suspending ? "Confirm suspension" : "Confirm reactivation"}</Button>
          </div>
        </form>
      ) : loading ? <DetailSkeleton /> : readError ? (
        <div className="px-4 py-5 sm:px-6" role="alert">
          <p className="text-sm">{readError.message}</p>
          {readError.code === "reauthenticate"
            ? <Link href={signIn} prefetch={false} className={buttonClassNames({ variant: "outline", className: "mt-3 px-3" })}>Sign in again</Link>
            : <Button type="button" variant="outline" onClick={() => confirmation ? void reconcile(confirmation, notice) : void load(endpoint)}
              className="mt-3 px-3">Try again</Button>}
        </div>
      ) : detail && (
        <div className="divide-y divide-border px-4 sm:px-6">
          <section className="my-4 rounded-2xl bg-[#FFE8EF] px-3 py-4 sm:px-4">
            <div className="flex items-center gap-3">
              <AccountAvatar name={identity.name} profileImage={identity.profileImage} large />
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <h3 className="text-xl font-bold leading-tight tracking-tight">{identity.name}</h3>
                <p className="mt-0.5 text-sm text-muted">{identity.email || "Email unavailable"}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              <div><dt className="text-xs text-muted">Verification</dt><dd className="mt-1"><AccountFlags user={detail} kind="verification" /></dd></div>
              <div><dt className="text-xs text-muted">Account status</dt><dd className="mt-1"><AccountFlags user={detail} kind="status" /></dd></div>
              <div><dt className="text-xs text-muted">Joined (UTC)</dt><dd className="mt-1">{accountDate(detail.joinedAt)}</dd></div>
              {detail.suspendedAt && <div><dt className="text-xs text-muted">Suspended (UTC)</dt><dd className="mt-1">{accountDate(detail.suspendedAt)}</dd></div>}
              <div className="col-span-2"><dt className="text-xs text-muted">Account ID</dt><dd className="mt-1 [overflow-wrap:anywhere]">{detail.id}</dd></div>
            </dl>
          </section>
          <section className="py-5">
            <h3 className="font-bold tracking-tight">Learning statistics</h3>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {learning.map(([key, label]) => (
                <div key={key} className={`rounded-lg border border-border bg-[#FFFFFF] px-3 py-2 ${key === "quizzes" ? "col-span-2" : ""}`}>
                  <dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-bold tabular-nums">{detail.learning[key] === null ? <span className="text-sm font-medium text-muted">Unavailable</span> : number.format(detail.learning[key])}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs leading-5 text-muted">Quiz totals reflect retained completion records and may omit older quizzes.</p>
          </section>
          <section className="py-5">
            <h3 className="font-bold tracking-tight">Account access</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{suspended ? "This learner’s sign-in is currently blocked." : "Suspending this account blocks sign-in and ends existing sessions."}</p>
            <Button ref={actionButton} type="button" variant="outline" onClick={() => { setNotice(""); setReason(""); setConfirmation(suspended ? "reactivate" : "suspend"); }}
              className="mt-3 px-3">
              {suspended ? "Reactivate account" : "Suspend account"}
            </Button>
          </section>
        </div>
      )}
    </dialog>
  );
}
