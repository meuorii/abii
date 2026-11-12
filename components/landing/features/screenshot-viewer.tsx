"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
  label?: string;
};

export function ScreenshotViewer({ src, alt, width, height, sizes, className, label = "View full size" }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  const closeViewer = () => dialog.current?.close();
  const restoreFocus = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-[0_2px_8px_rgb(47_41_48_/_8%)] transition-colors hover:border-pink-primary hover:bg-pink-soft focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active ${className ?? ""}`}
        aria-label={`${label}: ${alt}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="fixed m-auto max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[1500px] overflow-auto rounded-xl border border-white/30 bg-white p-2 pt-12 shadow-[0_24px_80px_rgb(0_0_0_/_30%)] backdrop:bg-[rgb(34_27_31_/_78%)] sm:max-h-[calc(100dvh-1.5rem)] sm:w-[calc(100vw-1.5rem)] sm:p-3.5 sm:pt-13"
          aria-label={alt}
          onClose={restoreFocus}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeViewer();
            }
          }}
          onClick={(event) => {
            if (event.target === dialog.current) closeViewer();
          }}
        >
          <button type="button" className="absolute right-2 top-2 grid size-10 place-items-center rounded-full border border-border bg-white text-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active" aria-label="Close full-size image" onClick={closeViewer}>
            <X aria-hidden="true" />
          </button>
          <Image className="block h-auto w-full max-h-[calc(100dvh-4.75rem)] object-contain sm:max-h-[calc(100dvh-5.75rem)]" src={src} alt={alt} width={width} height={height} sizes={sizes} unoptimized />
        </dialog>
      )}
    </>
  );
}
