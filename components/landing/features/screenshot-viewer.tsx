"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import styles from "./features-page.module.css";

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
        className={`${styles.viewerTrigger} ${className ?? ""}`}
        aria-label={`${label}: ${alt}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className={styles.viewerDialog}
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
          <button type="button" className={styles.viewerClose} aria-label="Close full-size image" onClick={closeViewer}>
            <X aria-hidden="true" />
          </button>
          <Image src={src} alt={alt} width={width} height={height} sizes={sizes} unoptimized />
        </dialog>
      )}
    </>
  );
}
