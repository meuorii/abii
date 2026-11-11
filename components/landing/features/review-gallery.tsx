"use client";
import Image from "next/image";
import { useState } from "react";
import styles from "./features-page.module.css";
import { ScreenshotViewer } from "./screenshot-viewer";

const modes = [
  { name: "Multiple Choice", description: "Choose the correct answer from a set of options.", src: "multiple-choice.png", alt: "Abii multiple choice review screen" },
  { name: "Identification", description: "Recall the answer and type it yourself.", src: "identification.png", alt: "Abii identification review screen" },
  { name: "True or False", description: "Decide whether a statement is true or false.", src: "true-or-false.png", alt: "Abii true or false review screen" },
];

export function ReviewGallery() {
  const [active, setActive] = useState(0);
  const mode = modes[active];
  return <div className={styles.reviewGallery}>
    <div className={styles.featuredReview}><Image key={mode.src} src={`/landing/features/${mode.src}`} alt={mode.alt} width={1920} height={1080} unoptimized sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1200px) calc(100vw - 64px), 1280px" /></div>
    <div className={styles.reviewMeta}><p aria-live="polite" aria-atomic="true"><strong>{mode.name}</strong><span>{mode.description}</span></p><ScreenshotViewer src={`/landing/features/${mode.src}`} alt={mode.alt} width={1920} height={1080} sizes="100vw" className={styles.viewerInline} /><div className={styles.thumbnails} role="group" aria-label="Choose a review type">{modes.map((item, index) => <button type="button" key={item.src} className={`${styles.thumbnail} ${index === active ? styles.thumbnailActive : ""}`} aria-pressed={index === active} aria-label={`Preview ${item.name}: ${item.description}`} onClick={() => setActive(index)}><Image src={`/landing/features/${item.src}`} alt="" width={1920} height={1080} sizes="(max-width: 700px) 28vw, 210px" /><span>{item.name}</span></button>)}</div></div>
    <p className={styles.mixedNote}>Want a little variety? Mixed / Random mode lets you practice all three question types in one review session.</p>
  </div>;
}
