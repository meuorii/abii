"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import styles from "./landing-page.module.css";

const steps = [
  {
    id: "organize",
    number: "01",
    label: "Organize",
    description: "Keep your subjects, folders, topics, and flashcards in one organized study space.",
    src: "/landing/home/workspace-demo.png",
    alt: "Abii study workspace with Biology Basics, folder navigation, and a topic list.",
    width: 1786,
    height: 880,
  },
  {
    id: "practice",
    number: "02",
    label: "Practice",
    description: "Test what you know through questions that make you recall the answer.",
    src: "/landing/home/quiz-demo.png",
    alt: "Abii quiz experience with a sample multiple-choice question and review progress.",
    width: 1783,
    height: 882,
  },
  {
    id: "progress",
    number: "03",
    label: "Progress",
    description: "See what you’ve learned and what could use another review.",
    src: "/landing/home/progress-demo.png",
    alt: "Abii progress page with sample study activity and mastery information.",
    width: 1782,
    height: 883,
  },
] as const;

export function ProductExperienceTabs() {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [horizontal, setHorizontal] = useState(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const reduceMotion = useReducedMotion();
  const current = steps[active];

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (expanded && !node.open) node.showModal();
    if (!expanded && node.open) node.close();
  }, [expanded]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const updateOrientation = () => setHorizontal(query.matches);
    updateOrientation();
    query.addEventListener("change", updateOrientation);
    return () => query.removeEventListener("change", updateOrientation);
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let next = active;
    if (event.key === "ArrowRight" || (!horizontal && event.key === "ArrowDown")) next = (active + 1) % steps.length;
    else if (event.key === "ArrowLeft" || (!horizontal && event.key === "ArrowUp")) next = (active + steps.length - 1) % steps.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = steps.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return <div className={styles.experienceGrid}>
    <div className={styles.stepRail} role="tablist" aria-label="Explore the study experience" aria-orientation={horizontal ? "horizontal" : "vertical"}>
      {steps.map((step, index) => <button key={step.id} ref={(node) => { tabs.current[index] = node; }} type="button" id={`experience-tab-${step.id}`} role="tab" aria-selected={active === index} aria-controls="experience-panel" tabIndex={active === index ? 0 : -1} className={styles.step} onClick={() => setActive(index)} onKeyDown={onKeyDown}>
        <span className={styles.stepTop}><span className={styles.stepNumber}>{step.number}</span><span className={styles.stepLabel}>{step.label}</span>{active === index && <m.span className={styles.stepIndicator} layoutId="landing-step-indicator" transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}/>}</span>
        <span className={styles.stepDescription}>{step.description}</span>
      </button>)}
    </div>

    <div id="experience-panel" className={styles.screenshotStage} role="tabpanel" aria-labelledby={`experience-tab-${current.id}`} tabIndex={0}>
      <button type="button" className={styles.screenshotButton} onClick={() => setExpanded(true)} aria-label={`View the ${current.label.toLowerCase()} screenshot at a larger size`}>
        <AnimatePresence initial={false} mode="sync">
          <m.span key={current.id} className={styles.screenshotSlide}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            <Image className={styles.screenshotImage} src={current.src} alt={current.alt} width={current.width} height={current.height} sizes="(max-width: 900px) calc(100vw - 44px), (max-width: 1300px) 66vw, 820px" loading="lazy" />
          </m.span>
        </AnimatePresence>
      </button>
      <dialog ref={dialog} className={styles.screenshotDialog} aria-label={`Larger ${current.label.toLowerCase()} screenshot`} onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)}>
        <button type="button" className={styles.screenshotClose} onClick={() => setExpanded(false)} aria-label="Close enlarged screenshot">Close</button>
        <Image src={current.src} alt={current.alt} width={current.width} height={current.height} sizes="96vw" />
      </dialog>
    </div>
  </div>;
}
