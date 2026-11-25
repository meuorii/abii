"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  announcementContent, announcementDestinations, publicationTime, type AnnouncementContent, type AnnouncementTarget,
  type AnnouncementView, type AudienceEstimate,
} from "@/lib/admin/announcement-contract";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F8769C]";
const field = `mt-1.5 block w-full min-w-0 rounded-xl border border-border bg-[#FFFFFF] px-3 py-2.5 text-base sm:text-sm ${focus}`;
const primary = `inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F8769C] px-4 text-sm font-semibold text-white hover:bg-[#EC658D] active:bg-[#D9547D] disabled:opacity-50 ${focus}`;
const secondary = `inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-[#FFFFFF] px-3.5 text-sm font-semibold hover:bg-[#FFF1F5] disabled:opacity-50 ${focus}`;
const link = `inline-flex min-h-11 items-center rounded text-sm font-semibold text-[#30262B] hover:underline ${focus}`;
const panel = "min-w-0 rounded-2xl border border-border bg-[#FFFFFF] p-4 sm:p-5";
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const numeric = new Intl.NumberFormat("en");

type Preview = { estimate: AudienceEstimate; confirmation: string };
type ApiReply = Partial<Preview> & { announcement?: AnnouncementView; message?: string };

async function request(body: object) {
  const response = await fetch("/api/admin/announcements", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json() as ApiReply;
  if (!response.ok) throw new Error(result.message || "Abii could not confirm this request.");
  return result;
}

function Message({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm leading-6 text-error-text">{message}</p> : null;
}

function NotificationPreview({ title, message, target }: AnnouncementContent) {
  return <div className="notification-item--unread flex min-w-0 items-start gap-3 rounded-xl border border-border bg-[#FFE8EF] p-3.5">
    <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[#F8769C] text-white"><Sparkles size={17} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-semibold text-[#30262B]">{title || "Your notification title"}</p>
      <p className="mt-1 line-clamp-3 break-words text-xs leading-[1.45] text-[#6F5964]">{message || "Your announcement message will appear here."}</p>
      <p className="mt-2 text-xs font-medium text-[#6F5964]">{target ? `Opens ${announcementDestinations[target]}` : "Notification Center"}</p>
    </div>
  </div>;
}

function Confirmation({ heading, label, busy, onDismiss, onConfirm, children }: {
  heading: string; label: string; busy: boolean; onDismiss: () => void; onConfirm: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onClose={onDismiss} onCancel={event => { if (busy) event.preventDefault(); }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-[#FFFFFF] p-4 text-foreground shadow-xl backdrop:bg-[#30262B]/40 sm:p-6">
    <h2 id={titleId} className="text-xl font-semibold tracking-tight">{heading}</h2>
    <div className="my-4 grid gap-3 text-sm leading-6 text-muted">{children}</div>
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className={secondary}>Back</button>
      <button type="button" disabled={busy} onClick={onConfirm} className={primary}>{busy ? "Working…" : label}</button>
    </div>
  </dialog>;
}

function AudiencePreview({ preview }: { preview: Preview | null }) {
  return preview ? <div aria-live="polite">
    <p className="text-2xl font-semibold tabular-nums">{numeric.format(preview.estimate.count)} <span className="text-sm font-medium text-muted">{preview.estimate.count === 1 ? "estimated recipient" : "estimated recipients"}</span></p>
    <p className="mt-1 text-xs leading-5 text-muted">Calculated {dateTime.format(new Date(preview.estimate.calculatedAt))} UTC.</p>
  </div> : <p className="text-sm leading-6 text-muted">Calculate an estimate when the title and message are ready.</p>;
}

export function AnnouncementEditor({ initial, deliveryEnabled, back }: { initial: AnnouncementView | null; deliveryEnabled: boolean; back: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [target, setTarget] = useState<AnnouncementTarget | null>(initial?.target ?? null);
  const [day, setDay] = useState(initial?.scheduledAt?.slice(0, 10) ?? "");
  const [hour, setHour] = useState(initial?.scheduledAt?.slice(11, 16) ?? "");
  const [errors, setErrors] = useState<{ title?: string; message?: string; schedule?: string }>({});
  const [failure, setFailure] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [confirmation, setConfirmation] = useState<"schedule" | "publish" | null>(null);
  const [leave, setLeave] = useState("");
  const requestId = useRef(initial?.id ?? "");
  const confirmTrigger = useRef<HTMLButtonElement | null>(null);
  const busy = useRef(false);
  const clean = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const dirty = title !== (initial?.title ?? "") || message !== (initial?.message ?? "") || target !== (initial?.target ?? null) ||
    day !== (initial?.scheduledAt?.slice(0, 10) ?? "") || hour !== (initial?.scheduledAt?.slice(11, 16) ?? "");

  useEffect(() => setEditorReady(true), []);

  useEffect(() => {
    if (!dirty) return;
    function unload(event: BeforeUnloadEvent) {
      if (!clean.current) { event.preventDefault(); event.returnValue = ""; }
    }
    function intercept(event: MouseEvent) {
      if (clean.current || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      setLeave(url.pathname + url.search + url.hash);
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);

  function formContent(forSchedule = false): AnnouncementContent | null {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Enter an announcement title.";
    if (!message.trim()) next.message = "Enter the announcement message.";
    if (forSchedule) {
      try { publicationTime(`${day}T${hour}`, new Date()); }
      catch { next.schedule = "Choose a date and time in the future (UTC)."; }
    }
    setErrors(next);
    if (next.title || next.message || next.schedule) {
      (next.title ? titleInput.current : next.message ? messageInput.current : dateInput.current)?.focus();
      return null;
    }
    return announcementContent({ title, message, target });
  }

  async function loadPreview(action?: "schedule" | "publish") {
    if (busy.current) return;
    const content = formContent(action === "schedule");
    if (!content) return;
    busy.current = true;
    setWorking(true);
    setFailure("");
    try {
      const result = await request({ action: "preview", ...content });
      if (!result.estimate || !result.confirmation) throw new Error("Audience estimate could not be confirmed.");
      setPreview({ estimate: result.estimate, confirmation: result.confirmation });
      if (action) setConfirmation(action);
    } catch (error) { setFailure(error instanceof Error ? error.message : "Audience preview is unavailable."); }
    finally { busy.current = false; setWorking(false); }
  }

  async function commit(action: "save" | "schedule" | "publish") {
    if (busy.current) return;
    const content = formContent(action === "schedule");
    if (!content) return;
    busy.current = true;
    setWorking(true);
    setFailure("");
    requestId.current ||= crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    try {
      const result = await request({ action, id: requestId.current, revision: initial?.revision ?? null, ...content,
        ...(action === "save" ? {} : { confirmation: preview?.confirmation, confirmed: true }),
        ...(action === "schedule" ? { scheduledAt: `${day}T${hour}` } : {}) });
      if (!result.announcement) throw new Error("Abii could not confirm this change.");
      clean.current = true;
      setConfirmation(null);
      const params = new URLSearchParams(back.split("?")[1]?.split("#")[0]);
      params.set("id", result.announcement.id);
      window.location.replace(`/admin/announcements?${params}#announcement-details`);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Abii could not save this announcement.");
      setConfirmation(null);
    } finally { busy.current = false; setWorking(false); }
  }

  const scheduled = initial?.state === "scheduled";
  const submit = (event: FormEvent) => { event.preventDefault(); if (!scheduled) void commit("save"); };

  return <section aria-labelledby="announcement-editor" data-editor-ready={editorReady ? "true" : undefined} className="grid min-w-0 gap-4">
    <div className="flex flex-wrap flex-col-reverse items-start justify-between gap-x-4">
      <h2 id="announcement-editor" className="text-xl font-semibold tracking-tight sm:text-2xl">{initial ? "Edit Announcement" : "Create Announcement"}</h2>
      <a href={back} onClick={event => { if (!dirty) { event.preventDefault(); router.push(back); } }} className={link}>Back to announcements</a>
    </div>
    <Message message={failure} />
    <form onSubmit={submit} noValidate className="grid min-w-0 gap-4">
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className={`${panel} grid gap-4`}>
          <div>
            <label htmlFor="announcement-title" className="text-sm font-semibold">Announcement title</label>
            <input ref={titleInput} id="announcement-title" value={title} maxLength={120} required disabled={working}
              aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "announcement-title-error" : "announcement-title-count"}
              onChange={event => { setTitle(event.target.value); setPreview(null); }} className={field} />
            <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-xs text-muted">
              {errors.title ? <p id="announcement-title-error" className="text-error-text">{errors.title}</p> : <p>Use a short, specific headline.</p>}
              <span id="announcement-title-count" className="tabular-nums">{title.length}/120</span>
            </div>
          </div>
          <div>
            <label htmlFor="announcement-message" className="text-sm font-semibold">Message</label>
            <textarea ref={messageInput} id="announcement-message" rows={5} required maxLength={500} value={message} disabled={working}
              aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "announcement-message-error" : "announcement-message-count"}
              onChange={event => { setMessage(event.target.value); setPreview(null); }} className={`${field} resize-y`} />
            <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-xs text-muted">
              {errors.message ? <p id="announcement-message-error" className="text-error-text">{errors.message}</p> : <p>Tell learners what changed and what they can do.</p>}
              <span id="announcement-message-count" className="tabular-nums">{message.length}/500</span>
            </div>
          </div>
          <div>
            <label htmlFor="announcement-target" className="text-sm font-semibold">Destination</label>
            <select id="announcement-target" value={target ?? ""} disabled={working}
              onChange={event => { setTarget(event.target.value ? event.target.value as AnnouncementTarget : null); setPreview(null); }} className={field}>
              <option value="">Notification Center only</option>
              {Object.entries(announcementDestinations).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select>
          </div>
          <fieldset className="min-w-0 border-t border-border pt-3">
            <legend className="pr-2 text-sm font-semibold">Schedule (UTC)</legend>
            <div className="grid min-w-0 gap-3 min-[390px]:grid-cols-2">
              <label className="min-w-0 text-xs font-medium text-muted">Date<input ref={dateInput} type="date" value={day} disabled={working}
                aria-invalid={Boolean(errors.schedule)} aria-describedby="announcement-schedule-help" onChange={event => setDay(event.target.value)} className={field} /></label>
              <label className="min-w-0 text-xs font-medium text-muted">Time<input type="time" value={hour} disabled={working}
                aria-invalid={Boolean(errors.schedule)} aria-describedby="announcement-schedule-help" onChange={event => setHour(event.target.value)} className={field} /></label>
            </div>
            <p id="announcement-schedule-help" className={`mt-2 text-xs leading-5 ${errors.schedule ? "text-error-text" : "text-muted"}`}>
              {errors.schedule ?? "Delivery starts at or after this time. The scheduler checks every 15 minutes."}</p>
          </fieldset>
        </div>
        <aside className="grid min-w-0 gap-4">
        <div className={panel}>
          <h3 className="mb-3 text-base font-semibold">Notification Preview</h3>
            <NotificationPreview title={title} message={message} target={target} />
          </div>
          <div className={`${panel} grid gap-3`}>
            <h3 className="text-base font-semibold">Audience Preview</h3>
            <p className="text-sm font-medium">Verified learners</p>
            <p className="text-xs leading-5 text-muted">Learners must have an active account and allow What’s New notifications. The administrator is excluded.</p>
        <div className="rounded-lg border border-border bg-[#FFE8EF] px-3 py-3"><AudiencePreview preview={preview} /></div>
            <button type="button" className={`${secondary} justify-self-start`} disabled={working} onClick={() => void loadPreview()}>{preview ? "Refresh estimate" : "Estimate audience"}</button>
          </div>
        </aside>
      </div>
      <div className="flex flex-wrap justify-between gap-3 rounded-xl border border-border bg-[#FFFFFF] px-3.5 py-3">
        <p role="status" className="self-center text-xs leading-5 text-muted">{working ? "Working…" : !deliveryEnabled ? "Delivery is disabled for this deployment." : dirty ? "Unsaved changes" : scheduled ? "Schedule saved" : initial ? "Draft saved" : "New draft"}</p>
        <div className="flex flex-wrap gap-2">
          {!scheduled && <button type="submit" disabled={working} className={secondary}>Save draft</button>}
          <button type="button" disabled={working || !deliveryEnabled} className={secondary} onClick={event => { confirmTrigger.current = event.currentTarget; void loadPreview("schedule"); }}>{scheduled ? "Update schedule" : "Schedule"}</button>
          <button type="button" disabled={working || !deliveryEnabled} className={primary} onClick={event => { confirmTrigger.current = event.currentTarget; void loadPreview("publish"); }}>Publish now</button>
        </div>
      </div>
    </form>
    {confirmation && <Confirmation heading={confirmation === "publish" ? "Publish this announcement?" : "Confirm publication schedule"}
      label={confirmation === "publish" ? "Confirm publication" : "Confirm schedule"} busy={working}
      onDismiss={() => { setConfirmation(null); requestAnimationFrame(() => confirmTrigger.current?.focus()); }} onConfirm={() => void commit(confirmation)}>
      <NotificationPreview title={title} message={message} target={target} />
      <AudiencePreview preview={preview} />
      {confirmation === "schedule" && <p>Scheduled for {dateTime.format(new Date(`${day}T${hour}:00Z`))} UTC. You can change or cancel it before publication begins.</p>}
      <p>Delivery depends on eligibility at send time. Once learner notifications are created, they cannot be recalled.</p>
    </Confirmation>}
    {leave && <Confirmation heading="Discard unsaved changes?" label="Discard changes" busy={false}
      onDismiss={() => setLeave("")} onConfirm={() => { clean.current = true; router.push(leave); setLeave(""); }}>
      <p>Leaving this editor will discard the changes you haven’t saved.</p>
    </Confirmation>}
  </section>;
}

export function AnnouncementDeliveryActions({ row, enabled }: { row: AnnouncementView; enabled: boolean }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [action, setAction] = useState<"cancel" | "retry" | null>(null);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const outstanding = row.state === "scheduled" || row.state === "queued" || row.state === "publishing";
  useEffect(() => {
    if (!outstanding) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 12_000);
    return () => window.clearInterval(timer);
  }, [outstanding, router]);

  async function commit() {
    if (!action || working) return;
    setWorking(true);
    setFailure("");
    setNotice("");
    try {
      const result = await request({ action, id: row.id, revision: row.revision, confirmed: true });
      if (!result.announcement) throw new Error("The change could not be confirmed.");
      setNotice(action === "retry" ? "Delivery retry queued." : "Schedule canceled.");
      router.refresh();
    } catch (error) { setFailure(error instanceof Error ? error.message : "Abii could not confirm the change."); }
    finally { setWorking(false); setAction(null); }
  }

  return <div className="grid min-w-0 gap-2">
    <div className="flex flex-wrap gap-2">
      {row.state === "scheduled" && <button type="button" className={secondary} onClick={() => setAction("cancel")}>Cancel schedule</button>}
      {(row.state === "failed" || row.state === "incomplete") && <button type="button" className={primary} disabled={!enabled} onClick={() => setAction("retry")}>Retry delivery</button>}
      <button type="button" className={secondary} onClick={() => { setFailure(""); router.refresh(); }}>Refresh status</button>
    </div>
    {notice && <p role="status" className="text-xs font-semibold text-[#30262B]">{notice}</p>}
    <Message message={failure} />
    {action && <Confirmation heading={action === "retry" ? "Retry delivery?" : "Cancel scheduled publication?"}
      label={action === "retry" ? "Confirm retry" : "Confirm cancellation"} busy={working} onDismiss={() => setAction(null)} onConfirm={() => void commit()}>
      <p className="break-words font-semibold text-foreground">{row.title}</p>
      <p>{action === "retry" ? "Delivery resumes from the last committed batch with the original audience and content. Recipients already delivered to are skipped." :
        "Cancellation is available until publication is committed. The content will remain available to edit and schedule again."}</p>
    </Confirmation>}
  </div>;
}
