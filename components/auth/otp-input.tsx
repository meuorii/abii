"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from "react";
import { changedOtpPositions, nextOtpCaretPosition, otpDigitDelay, sanitizeOtpInput } from "./otp-input-state";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  hasError?: boolean;
  className?: string;
  autoFocus?: boolean;
};

export function OtpInput({ value, onChange, disabled = false, label = "Six-digit code", hasError = false, className = "", autoFocus = false }: OtpInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const [digitVersions, setDigitVersions] = useState([0, 0, 0, 0, 0, 0]);
  const [digitDelays, setDigitDelays] = useState([0, 0, 0, 0, 0, 0]);
  const [caretPosition, setCaretPosition] = useState(value.length);

  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);

  function update(next: string, pasted = false, caret = next.length) {
    const clean = sanitizeOtpInput(next);
    if (clean !== value) {
      const changed = changedOtpPositions(value, clean);
      setDigitVersions(current => current.map((version, index) => changed.includes(index) ? version + 1 : version));
      setDigitDelays(Array.from({ length: 6 }, (_, index) => changed.includes(index) ? otpDigitDelay(index, pasted) : 0));
    }
    setCaretPosition(Math.max(0, Math.min(clean.length, caret)));
    onChange(clean);
  }

  function paste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    update(event.clipboardData.getData("text"), true);
  }

  function changed(event: ChangeEvent<HTMLInputElement>) {
    update(event.target.value, false, event.target.selectionStart ?? event.target.value.length);
  }

  function keydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const el = input.current;
      const pos = el?.selectionStart ?? 0;
      const next = nextOtpCaretPosition(pos, event.key === "ArrowLeft" ? "left" : "right");
      setCaretPosition(Math.min(next, value.length));
      el?.setSelectionRange(next, next);
    }
  }

  function selectionChanged(event: SyntheticEvent<HTMLInputElement>) {
    setCaretPosition(Math.min(value.length, event.currentTarget.selectionStart ?? value.length));
  }

  return <div className={`otp-input-shell relative mx-auto w-fit ${className} ${hasError ? "otp-error-state" : ""}`} role="group" aria-label={label}>
    <div aria-hidden="true" className="otp-visual-slots flex justify-center gap-[clamp(4px,1.5vw,8px)]">
      {Array.from({ length: 6 }, (_, index) => {
        const filled = Boolean(value[index]);
        const active = value.length < 6 && index === Math.min(caretPosition, value.length);
        const digitStyle = { animationDelay: `${digitDelays[index]}ms` } as CSSProperties;
        return <span key={index} className={`otp-digit-slot flex h-[clamp(46px,13vw,58px)] w-[clamp(38px,11vw,52px)] items-center justify-center rounded-xl border border-[#E9DFE4] bg-white text-xl font-bold tracking-wide text-[#D9366D] ${filled ? "otp-slot-filled" : ""} ${active ? "otp-slot-active" : ""}`}>
          <span key={`${index}-${digitVersions[index]}`} className={filled ? "otp-digit-pop" : ""} style={digitStyle}>{value[index] || ""}</span>
        </span>;
      })}
    </div>
    <input
      ref={input}
      value={value}
      onChange={changed}
      onPaste={paste}
      onKeyDown={keydown}
      onSelect={selectionChanged}
      onFocus={selectionChanged}
      disabled={disabled}
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      aria-label={label}
      aria-invalid={hasError}
      className="absolute inset-0 h-full w-full cursor-text opacity-[0.015] outline-none"
    />
    <span className="sr-only" aria-live="polite">{value.length} of 6 digits entered</span>
  </div>;
}
