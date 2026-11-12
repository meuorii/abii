"use client";
import Image from "next/image";
import { useState } from "react";
import { ScreenshotViewer } from "./screenshot-viewer";

const modes = [
  { name: "Multiple Choice", description: "Choose the correct answer from a set of options.", src: "multiple-choice.png", alt: "Abii multiple choice review screen" },
  { name: "Identification", description: "Recall the answer and type it yourself.", src: "identification.png", alt: "Abii identification review screen" },
  { name: "True or False", description: "Decide whether a statement is true or false.", src: "true-or-false.png", alt: "Abii true or false review screen" },
];

export function ReviewGallery() {
  const [active, setActive] = useState(0);
  const mode = modes[active];
  return <div className="mx-auto max-w-7xl"><div className="overflow-hidden rounded-2xl border border-border bg-white"><Image className="h-auto w-full object-contain" key={mode.src} src={`/landing/features/${mode.src}`} alt={mode.alt} width={1920} height={1080} unoptimized sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1200px) calc(100vw - 64px), 1280px" /></div><div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><p className="grid gap-1 text-sm text-muted" aria-live="polite" aria-atomic="true"><strong className="text-base text-foreground">{mode.name}</strong><span>{mode.description}</span></p><ScreenshotViewer src={`/landing/features/${mode.src}`} alt={mode.alt} width={1920} height={1080} sizes="100vw" /><div className="flex w-full gap-2 md:w-auto" role="group" aria-label="Choose a review type">{modes.map((item, index) => <button type="button" key={item.src} className={`min-w-0 flex-1 rounded-xl border p-1 text-left transition-colors md:w-40 md:flex-none ${index === active ? "border-pink-primary bg-pink-soft" : "border-transparent bg-white hover:border-border"}`} aria-pressed={index === active} aria-label={`Preview ${item.name}: ${item.description}`} onClick={() => setActive(index)}><Image className="aspect-[1.45] w-full rounded-lg bg-pink-soft object-contain" src={`/landing/features/${item.src}`} alt="" width={1920} height={1080} sizes="(max-width: 700px) 28vw, 210px" /><span className="block px-1 pt-1 text-[10px] font-semibold sm:text-xs">{item.name}</span></button>)}</div></div><p className="mt-4 text-center text-sm leading-relaxed text-muted">Want a little variety? Mixed / Random mode lets you practice all three question types in one review session.</p>
  </div>;
}
