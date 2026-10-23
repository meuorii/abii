"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type ModalAction = "create" | "view" | "update" | "delete" | "confirmation" | "information" | "logout";
const actionLabels: Record<ModalAction, string> = { create: "CREATE", view: "VIEW", update: "UPDATE", delete: "DELETE", confirmation: "CONFIRM", information: "INFORMATION", logout: "LOG OUT" };
const mascot: Record<ModalAction, string> = { create: "/mascot/modal/create.png", view: "/mascot/modal/read.png", update: "/mascot/modal/update.png", delete: "/mascot/modal/delete.png", confirmation: "/mascot/modal/delete.png", information: "/mascot/modal/read.png", logout: "/mascot/modal/delete.png" };

export function Modal({ open, onClose, action, title, description, children, footer, busy = false, size = "md", mascotSrc, alert = false }: {
  open: boolean; onClose: () => void; action: ModalAction; title: string; description?: string; children: ReactNode; footer?: ReactNode; busy?: boolean; size?: "sm" | "md" | "lg"; mascotSrc?: string; alert?: boolean;
}) {
  const titleId = useId(); const descriptionId = useId(); const dialogRef = useRef<HTMLElement>(null); const previousFocus = useRef<HTMLElement | null>(null); const closeRef = useRef(onClose); const [present, setPresent] = useState(open);
  useEffect(() => { if (open) { setPresent(true); return; } const timeout = window.setTimeout(() => setPresent(false), 210); return () => window.clearTimeout(timeout); }, [open]);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
    requestAnimationFrame(() => (focusable()?.[0] ?? dialog)?.focus());
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) { event.preventDefault(); closeRef.current(); }
      if (event.key === "Tab") { const items = focusable(); if (!items?.length) { event.preventDefault(); return; } const first = items[0], last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    }
    document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("keydown", keys); document.body.style.overflow = priorOverflow; previousFocus.current?.focus(); };
  }, [open, busy]);
  if (!present) return null;
  return <div aria-hidden={!open} className={`abii-modal-overlay fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-[#21151B]/40 p-3 backdrop-blur-[3px] sm:p-5 ${open ? "" : "abii-modal-overlay-out"}`} onMouseDown={(e) => { if (open && e.target === e.currentTarget && !busy) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} inert={!open} role={alert ? "alertdialog" : "dialog"} aria-modal={open ? "true" : undefined} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={`abii-modal-panel relative my-auto flex max-h-[min(94dvh,900px)] w-full flex-col overflow-hidden rounded-[24px] border border-[#F3E9ED] bg-white shadow-[0_24px_80px_rgba(53,28,39,0.24)] ${open ? "" : "abii-modal-panel-out"} ${size === "sm" ? "max-w-[480px]" : size === "lg" ? "max-w-[680px]" : "max-w-[570px]"}`}>
      <header className="relative min-h-[160px] shrink-0 overflow-hidden bg-[radial-gradient(ellipse_at_80%_55%,#FFE1EB_0%,#FFF0F5_46%,#FFF8FA_100%)] px-6 pb-5 pt-7 sm:min-h-[174px] sm:px-7 sm:pt-7">
        <span aria-hidden className="absolute -right-8 -top-20 h-48 w-48 rounded-full bg-white/35"/><span aria-hidden className="absolute right-28 -bottom-20 h-36 w-36 rounded-full bg-[#FFE6ED]/55"/>
        <div className="relative z-10 max-w-[62%]"><p className={`text-[12px] font-extrabold tracking-[.06em] ${action === "delete" || action === "confirmation" ? "text-[#F04469]" : action === "update" ? "text-[#E69542]" : "text-[#F23F83]"}`}>{actionLabels[action]}</p><h2 id={titleId} className="mt-2 text-[23px] font-bold leading-[1.1] tracking-[-.035em] text-[#17243D] sm:text-[25px]">{title}</h2>{description && <p id={descriptionId} className="mt-2 max-w-[310px] text-[13px] leading-[1.45] text-[#756B72]">{description}</p>}</div>
        <div className="pointer-events-none absolute -bottom-1 right-2 h-[150px] w-[44%] sm:right-5 sm:h-[168px] sm:w-[42%]"><Image src={mascotSrc ?? mascot[action]} alt="" fill sizes="(max-width: 640px) 42vw, 240px" className="object-contain object-bottom" priority /></div>
        <button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-xl leading-none text-[#51464D] shadow-[0_2px_10px_rgba(47,41,48,.12)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">×</button>
      </header>
      <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-5">{children}</div>
      {footer && <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#F6F0F2] px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-3 sm:px-7 [&>button]:min-h-11 [&>button]:rounded-xl [&>button]:px-4 [&>button]:text-sm [&>button]:font-semibold [&>button]:transition [&>button]:focus-visible:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-[#E9577D]">{footer}</footer>}
    </section>
  </div>;
}

export const modalCancelClass = "border border-[#E8E2E5] bg-[#F4F2F4] text-[#51464D] hover:bg-[#ECE9EC] disabled:opacity-50";
export const modalPrimaryClass = "bg-[#FF6F96] text-white hover:bg-[#E9577D] disabled:cursor-wait disabled:opacity-60";
export const modalDangerClass = "bg-[#F04469] text-white hover:bg-[#D92F57] disabled:cursor-wait disabled:opacity-60";
