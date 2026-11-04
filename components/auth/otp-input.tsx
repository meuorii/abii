"use client";
import { useRef, type ClipboardEvent, type ChangeEvent, type KeyboardEvent } from "react";
export function OtpInput({ value, onChange, disabled = false, label = "Six-digit code" }: { value: string; onChange: (value: string) => void; disabled?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  function update(next: string) { onChange(next.replace(/\D/g, "").slice(0, 6)); }
  function paste(event: ClipboardEvent<HTMLInputElement>) { event.preventDefault(); update(event.clipboardData.getData("text")); }
  function changed(event: ChangeEvent<HTMLInputElement>) { update(event.target.value); }
  function keydown(event: KeyboardEvent<HTMLInputElement>) { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); const el = input.current; const pos = el?.selectionStart ?? 0; el?.setSelectionRange(Math.max(0, Math.min(6, pos + (event.key === "ArrowLeft" ? -1 : 1))), Math.max(0, Math.min(6, pos + (event.key === "ArrowLeft" ? -1 : 1)))); } }
  return <div className="relative mx-auto w-fit" role="group" aria-label={label}>
    <div aria-hidden="true" className="flex justify-center gap-[clamp(4px,1.5vw,8px)]">
      {Array.from({ length: 6 }, (_, i) => <span key={i} className={`flex h-[clamp(46px,13vw,58px)] w-[clamp(38px,11vw,52px)] items-center justify-center rounded-xl border bg-white text-xl font-bold tracking-wide text-[#D9366D] ${i === value.length ? "border-[#C65380] ring-2 ring-[#FCE7F3]" : "border-[#E9DFE4]"}`}>{value[i] || ""}</span>)}
    </div>
    <input ref={input} value={value} onChange={changed} onPaste={paste} onKeyDown={keydown} disabled={disabled} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" aria-label={label} className="absolute inset-0 h-full w-full cursor-text opacity-[0.015]" />
    <span className="sr-only" aria-live="polite">{value.length} of 6 digits entered</span>
  </div>;
}
