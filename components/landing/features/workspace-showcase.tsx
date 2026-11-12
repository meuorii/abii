"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScreenshotViewer } from "./screenshot-viewer";

const slides = [
  {
    stepName: "Subject Folders",
    label: "01 - SUBJECT FOLDERS",
    title: "Bring your subjects together.",
    description: "Group related subjects into folders and keep your study space organized from the start.",
    src: "1-subject-folders.png",
    alt: "Abii workspace showing organized subject folders",
  },
  {
    stepName: "Subjects",
    label: "02 - SUBJECTS",
    title: "Every subject, all in one place.",
    description: "Keep your subjects together and easily access their topics, flashcards, and mastery progress.",
    src: "2-subjects.png",
    alt: "Abii workspace showing a student's subjects",
  },
  {
    stepName: "Topic Folders",
    label: "03 - TOPIC FOLDERS",
    title: "Make room for every lesson.",
    description: "Group your topics into folders for lessons, units, or exam coverage so everything stays easy to find.",
    src: "3-topic-folders.png",
    alt: "Abii workspace showing topic folders",
  },
  {
    stepName: "Topics",
    label: "04 - TOPICS",
    title: "One topic at a time.",
    description: "Break your subjects into manageable topics so you can focus on what you want to learn next.",
    src: "4-topics.png",
    alt: "Abii workspace showing topics within a subject",
  },
  {
    stepName: "Flashcards",
    label: "05 - FLASHCARDS",
    title: "Your flashcards, ready to review.",
    description: "Keep your study cards organized within each topic, ready whenever it's time to practice.",
    src: "flashcards.png",
    alt: "Abii workspace showing flashcards within a topic",
  },
];

export function WorkspaceShowcase() {
  const [active, setActive] = useState(0);
  const slide = slides[active];
  const select = (next: number) => setActive((next + slides.length) % slides.length);

  return (
    <div className="mx-auto max-w-[1360px]">
      <div className="mb-5 flex overflow-x-auto border-b border-border" role="group" aria-label="Workspace walkthrough steps">
        {slides.map((item, index) => (
          <button
            type="button"
            key={item.src}
            className={`flex min-h-14 shrink-0 items-center gap-2 border-b-2 px-3 pb-3 text-left text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active ${index === active ? "border-pink-primary text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
            aria-current={index === active ? "step" : undefined}
            onClick={() => select(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{item.stepName}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <Image
          key={slide.src}
          src={`/landing/features/${slide.src}`}
          alt={slide.alt}
          width={1920}
          height={1080}
          unoptimized
          sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1200px) calc(100vw - 48px), 1360px"
        />
      </div>

      <div className="flex flex-col gap-4 pt-4 md:flex-row md:items-center md:justify-between" aria-live="polite" aria-atomic="true">
        <div>
          <p className="text-xs font-semibold text-pink-primary">{slide.label}</p><h3 className="mt-1 text-xl font-bold tracking-[-.025em]">{slide.title}</h3><p className="mt-1 max-w-[45rem] text-sm leading-relaxed text-muted">{slide.description}</p>
        </div>
        <div className="flex items-center gap-3 self-end md:self-auto"><span className="text-xs tabular-nums text-muted">{String(active + 1).padStart(2, "0")} / 05</span>
          <ScreenshotViewer
            src={`/landing/features/${slide.src}`}
            alt={slide.alt}
            width={1920}
            height={1080}
            sizes="100vw"
          />
          <button type="button" className="grid size-11 place-items-center rounded-xl border border-border bg-white transition-colors hover:bg-pink-soft focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active" onClick={() => select(active - 1)} aria-label="Previous workspace view">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className="grid size-11 place-items-center rounded-xl border border-border bg-white transition-colors hover:bg-pink-soft focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active" onClick={() => select(active + 1)} aria-label="Next workspace view">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
