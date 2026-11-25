"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { ChevronRight, X } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/admin-ui";
import { auditRetentionDays, eventRetentionDays, type SecurityRow } from "@/lib/admin/security-contract";

const timestamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});
const precise = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC",
});
export const outcomeLabels = { success: "Success", failure: "Failed", denied: "Denied", "rate-limited": "Rate limited", committed: "Committed" };
const outcomeColors = { success: "text-success-text", committed: "text-success-text", failure: "text-error-text", denied: "text-error-text", "rate-limited": "text-warning-text" };
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover";

function actorLabel(row: SecurityRow) {
  return row.actor === "admin" ? "Administrator" : row.actor === "learner" ? "Learner" : "Unverified";
}

export function SecurityEvidenceTable({ rows }: { rows: SecurityRow[] }) {
  const [selected, select] = useState<SecurityRow | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useId();

  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);

  function show(row: SecurityRow, event: MouseEvent<HTMLButtonElement>) {
    trigger.current = event.currentTarget;
    select(row);
  }

  return <>
    <div role="region" aria-label="Security evidence table" tabIndex={0} className={`relative min-w-0 overflow-x-auto rounded-xl border border-border ${focus}`}>
      <table className="w-full min-w-[550px] text-left text-sm sm:min-w-[650px]">
        <caption className="sr-only">Audit and security events, newest first. Open an event for its details.</caption>
        <thead className="bg-[#FFFFFF] text-xs text-muted">
          <tr>{["Time (UTC)", "Event", "Actor", "Target", "Outcome"].map(label => <th scope="col" key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length ? rows.map(row => <tr key={`${row.source}-${row.id}`} className="hover:bg-[#FFF1F5]">
            <td className="whitespace-nowrap px-3 py-1 text-xs tabular-nums text-muted"><time dateTime={new Date(row.at).toISOString()}>{timestamp.format(row.at)}</time></td>
            <th scope="row" className="px-3 py-1">
              <button type="button" onClick={event => show(row, event)} aria-haspopup="dialog"
                className={`inline-flex min-h-11 items-center gap-1 rounded text-left text-sm font-semibold hover:text-[#30262B] ${focus}`}>
                <span>{row.label}{row.count !== null && row.count > 1 && <span className="ml-1.5 text-xs font-medium tabular-nums text-muted">×{row.count}</span>}
                  <span aria-hidden="true" className={`block pt-0.5 text-xs font-medium sm:hidden ${outcomeColors[row.outcome]}`}>{outcomeLabels[row.outcome]}</span></span>
                <ChevronRight aria-hidden="true" size={14} className="shrink-0 text-[#6F5964]" />
              </button>
            </th>
            <td className="px-3 py-1 text-xs text-muted">{actorLabel(row)}</td>
            <td className="px-3 py-1 text-xs text-muted">{row.target?.kind ?? "—"}</td>
            <td className={`whitespace-nowrap px-3 py-1 text-xs font-semibold ${outcomeColors[row.outcome]}`}>{outcomeLabels[row.outcome]}</td>
          </tr>) : <tr><td colSpan={5} className="h-44 px-3 text-center"><AdminEmptyState size="compact" title="No evidence in this view" description="No security evidence was returned for the selected filters." /></td></tr>}
        </tbody>
      </table>
    </div>
    <dialog ref={dialog} aria-labelledby={title}
      onClose={() => { select(null); trigger.current?.focus(); }}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[460px] bg-transparent p-0 text-foreground backdrop:bg-[#30262B]/35">
      {selected && <div className="flex h-full flex-col overflow-y-auto border-l border-border bg-[#FFFFFF] shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-border bg-[#FFE8EF] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className={`mb-1 text-xs font-semibold ${outcomeColors[selected.outcome]}`}>{outcomeLabels[selected.outcome]}</p>
            <h2 id={title} className="text-xl font-semibold tracking-tight">{selected.label}</h2>
          </div>
          <button type="button" aria-label="Close event details" onClick={() => dialog.current?.close()}
            className={`grid size-11 shrink-0 place-items-center rounded-lg hover:bg-[#FFF1F5] ${focus}`}><X aria-hidden="true" size={19} /></button>
        </header>
        <dl className="divide-y divide-border px-5 py-1 text-sm sm:px-6">
          {[
            ["Occurred (UTC)", precise.format(selected.at)],
            ["Last observed (UTC)", selected.lastAt > selected.at ? precise.format(selected.lastAt) : null],
            ["Actor", selected.actorId ? `${actorLabel(selected)} · ${selected.actorId}` : actorLabel(selected)],
            ["Target", selected.target ? `${selected.target.kind} · ${selected.target.id}` : null],
            ["Source", selected.source === "audit" ? "Administrator audit" : "Security observations"],
            ["Event ID", selected.id],
            ["Correlation ID", selected.correlation],
            ["Limiter scope", selected.scope],
            ["Observed count", selected.count === null ? null : String(selected.count)],
          ].map(([name, value]) => <div key={name} className="grid gap-1 py-3">
            <dt className="text-xs font-semibold text-muted">{name}</dt>
            <dd className="break-all tabular-nums">{value ?? "Unavailable"}</dd>
          </div>)}
        </dl>
        <p className="mx-5 my-3 rounded-lg border border-border bg-[#FFE8EF] px-3 py-2.5 text-xs leading-5 text-muted sm:mx-6">
          {selected.coverage === "representative" ? "This historical record represents one retained observation. The original attempt count is unknown." :
            selected.coverage === "committed" ? "This record was committed with the underlying administrator action." :
              "This record reflects stored observations. Collection gaps are possible."}
          {" "}Retention is {selected.source === "audit" ? auditRetentionDays : eventRetentionDays} days.
        </p>
      </div>}
    </dialog>
  </>;
}
