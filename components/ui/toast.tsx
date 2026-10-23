"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { toastConfig, type ToastKind } from "@/components/ui/toast-config";

export type ToastInput = {
  kind: ToastKind;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

export type ToastRecord = ToastInput & { id: string; exiting?: boolean; paused?: boolean };

export function ToastCard({ item, onDismiss, onPause, onResume }: { item: ToastRecord; onDismiss: (id: string) => void; onPause: (id: string) => void; onResume: (id: string) => void }) {
  const config = toastConfig[item.kind];
  const StatusIcon = config.icon;
  return (
    <article
      className={`abii-toast ${item.exiting ? "abii-toast-exit" : "abii-toast-enter"}`}
      style={{ "--toast-bg": config.background, "--toast-accent": config.accent, "--toast-label": config.labelColor, "--toast-duration": `${item.duration ?? config.duration}ms`, "--toast-progress-state": item.paused ? "paused" : "running" } as React.CSSProperties}
      role={item.kind === "error" || item.kind === "warning" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => onPause(item.id)}
      onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) onResume(item.id); }}
      onFocusCapture={() => onPause(item.id)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !event.currentTarget.matches(":hover")) onResume(item.id); }}
    >
      <div className="abii-toast-surface" aria-hidden="true" />
      <span className="abii-toast-accent" aria-hidden="true" />
      <div className="abii-toast-mascot" aria-hidden="true">
        <Image src={config.mascot} alt="" fill priority={false} sizes="(max-width: 640px) 110px, 180px" className="object-contain object-bottom" />
      </div>
      <div className="abii-toast-copy">
        <div className="abii-toast-label"><StatusIcon size={17} strokeWidth={2.2} aria-hidden="true" /><span>{config.label}</span></div>
        <h2 className="abii-toast-title">{item.title}</h2>
        {item.message && <p className="abii-toast-message">{item.message}</p>}
        {item.actionLabel && item.onAction && <button className="abii-toast-action" type="button" onClick={item.onAction}>{item.actionLabel}</button>}
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(item.id)} className="abii-toast-dismiss"><X size={24} strokeWidth={2.2} aria-hidden="true" /></button>
      {!item.persistent && !item.exiting && <span className="abii-toast-progress" aria-hidden="true" />}
    </article>
  );
}

