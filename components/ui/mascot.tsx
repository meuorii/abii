"use client";

import Image from "next/image";
import { useState } from "react";

export type MascotState =
  | "welcome"
  | "correct"
  | "wrong"
  | "review-reminder"
  | "complete"
  | "empty";

type MascotProps = {
  state?: MascotState;
  size?: "sm" | "md" | "lg";
  className?: string;
  alt?: string;
};

const mascotAssets: Record<MascotState, { src: string; alt: string; fallbackLabel: string }> = {
  welcome: {
    src: "/mascot/welcome.png",
    alt: "Abii the soft pastel-pink otter waving hello",
    fallbackLabel: "Hi, I’m Abii!",
  },
  correct: {
    src: "/mascot/correct.png",
    alt: "Abii the soft pastel-pink otter celebrating a correct answer",
    fallbackLabel: "Correct answer",
  },
  wrong: {
    src: "/mascot/wrong.png",
    alt: "Abii the soft pastel-pink otter encouraging another try",
    fallbackLabel: "Try again",
  },
  "review-reminder": {
    src: "/mascot/review-reminder.png",
    alt: "Abii the soft pastel-pink otter reminding you to review",
    fallbackLabel: "Time to review",
  },
  complete: {
    src: "/mascot/complete.png",
    alt: "Abii the soft pastel-pink otter celebrating a completed study session",
    fallbackLabel: "Well done",
  },
  empty: {
    src: "/mascot/empty.png",
    alt: "Abii the soft pastel-pink otter welcoming you to an empty study space",
    fallbackLabel: "Ready when you are",
  },
};

const sizeClasses = {
  sm: "h-14 w-14",
  md: "h-24 w-24 sm:h-28 sm:w-28",
  lg: "h-32 w-32 sm:h-40 sm:w-40",
};

/** Displays the supplied Abii artwork for a named UI state. Missing files use a neutral text fallback. */
export function Mascot({ state = "welcome", size = "md", className = "", alt }: MascotProps) {
  const asset = mascotAssets[state];
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={["relative flex shrink-0 items-center justify-center overflow-hidden", sizeClasses[size], className].filter(Boolean).join(" ")}
      role="img"
      aria-label={alt ?? asset.alt}
    >
      {imageFailed ? (
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-[#F5D9E2] bg-pink-soft px-2 text-center text-xs font-semibold text-[#756B72]">
          Abii
        </div>
      ) : (
        <Image
          src={asset.src}
          alt={alt ?? asset.alt}
          fill
          sizes="(max-width: 640px) 56px, 160px"
          className="object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}
