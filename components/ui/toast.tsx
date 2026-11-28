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
      className={`abii-toast relative isolate pointer-events-auto min-h-[166px] p-[25px_65px_24px_190px] [filter:drop-shadow(0_12px_23px_rgba(87,56,70,0.13))] max-sm:min-h-[126px] max-sm:p-[17px_49px_17px_118px] ${item.exiting ? "abii-toast-exit" : "abii-toast-enter"}`}
      style={{ "--toast-bg": config.background, "--toast-accent": config.accent, "--toast-label": config.labelColor, "--toast-duration": `${item.duration ?? config.duration}ms`, "--toast-progress-state": item.paused ? "paused" : "running" } as React.CSSProperties}
      role={item.kind === "error" || item.kind === "warning" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => onPause(item.id)}
      onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) onResume(item.id); }}
      onFocusCapture={() => onPause(item.id)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !event.currentTarget.matches(":hover")) onResume(item.id); }}
    >
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-[29px] border border-white/90 bg-[var(--toast-bg)] shadow-[inset_0_0_0_1px_rgba(234,216,224,0.48)] before:absolute before:right-[-5%] before:bottom-[-60%] before:z-0 before:h-[115%] before:w-[70%] before:rounded-[48%_52%_0_0/53%_49%_0_0] before:bg-[color-mix(in_srgb,var(--toast-accent)_5%,transparent)] before:content-[''] before:rotate-[-9deg] after:absolute after:right-[26%] after:bottom-[-82%] after:z-0 after:h-[115%] after:w-1/2 after:rounded-[48%_52%_0_0/53%_49%_0_0] after:bg-[color-mix(in_srgb,var(--toast-accent)_3.5%,transparent)] after:content-[''] after:rotate-[11deg] max-sm:rounded-[23px]" aria-hidden="true" />
      <span className="absolute inset-y-0 left-0 z-[1] w-1.5 rounded-l-[29px] bg-[var(--toast-accent)] max-sm:rounded-l-[23px]" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-0 left-[13px] z-[2] h-[calc(100%+20px)] w-[170px] overflow-hidden max-sm:left-1 max-sm:h-[calc(100%+12px)] max-sm:w-[111px]" aria-hidden="true">
        <Image src={config.mascot} alt="" fill priority={false} sizes="(max-width: 640px) 110px, 180px" className="object-contain object-bottom" />
      </div>
      <div className="relative z-[2] min-w-0 pt-[5px] max-sm:pt-0.5">
        <div className="flex items-center gap-2 text-xs font-extrabold leading-[1.25] tracking-[0.045em] text-[var(--toast-label)] max-sm:gap-1.5 max-sm:text-[11px]"><StatusIcon className="size-[17px] shrink-0 max-sm:size-[15px]" strokeWidth={2.2} aria-hidden="true" /><span>{config.label}</span></div>
        <h2 className="mt-[11px] break-words text-xl font-[750] leading-[1.25] tracking-[-0.025em] text-foreground max-sm:mt-2 max-sm:text-[17px]">{item.title}</h2>
        {item.message && <p className="mt-2.5 break-words text-sm font-normal leading-[1.45] text-muted max-sm:mt-1.5 max-sm:text-xs max-sm:leading-[1.4]">{item.message}</p>}
        {item.actionLabel && item.onAction && <button className="mt-2.5 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold text-[var(--toast-label)] underline underline-offset-[3px]" type="button" onClick={item.onAction}>{item.actionLabel}</button>}
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(item.id)} className="absolute right-[17px] top-[17px] z-[3] grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-[color-mix(in_srgb,var(--toast-accent)_7%,white)] text-muted transition-[background-color,color] duration-[150ms] hover:bg-[color-mix(in_srgb,var(--toast-accent)_15%,white)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--toast-label)] motion-reduce:transition-none max-sm:right-[9px] max-sm:top-[9px]"><X className="size-6 max-sm:size-[21px]" strokeWidth={2.2} aria-hidden="true" /></button>
      {!item.persistent && !item.exiting && <span className="abii-toast-progress absolute bottom-0 left-[190px] right-[29px] z-[4] h-0.5 origin-left scale-x-100 overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--toast-accent)_22%,transparent)] animate-[abii-toast-progress_var(--toast-duration)_linear_forwards] [animation-play-state:var(--toast-progress-state)] max-sm:left-[118px] max-sm:right-[23px]" aria-hidden="true" />}
    </article>
  );
}

