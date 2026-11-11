"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./features-page.module.css";
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
    <div className={styles.workspaceShowcase}>
      <div className={styles.stepRail} role="group" aria-label="Workspace walkthrough steps">
        {slides.map((item, index) => (
          <button
            type="button"
            key={item.src}
            className={index === active ? styles.stepCurrent : styles.step}
            aria-current={index === active ? "step" : undefined}
            onClick={() => select(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{item.stepName}</span>
          </button>
        ))}
      </div>

      <div className={styles.workspaceImage}>
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

      <div className={styles.workspaceDetails} aria-live="polite" aria-atomic="true">
        <div>
          <p className={styles.slideLabel}>{slide.label}</p>
          <h3>{slide.title}</h3>
          <p>{slide.description}</p>
        </div>
        <div className={styles.carouselControls}>
          <span className={styles.stepCount}>{String(active + 1).padStart(2, "0")} / 05</span>
          <ScreenshotViewer
            src={`/landing/features/${slide.src}`}
            alt={slide.alt}
            width={1920}
            height={1080}
            sizes="100vw"
            className={styles.viewerInline}
          />
          <button type="button" className={styles.arrow} onClick={() => select(active - 1)} aria-label="Previous workspace view">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className={styles.arrow} onClick={() => select(active + 1)} aria-label="Next workspace view">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
