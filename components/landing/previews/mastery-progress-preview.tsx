"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BookOpen, Target } from "lucide-react";
import { demoMastery } from "@/components/landing/demo-data";

export function MasteryProgressPreview() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <section ref={ref} className="mastery-preview" aria-label="Illustrative subject mastery preview">
    <header className="mastery-preview-header"><div><span className="mastery-heading-icon"><Target aria-hidden="true"/></span><div><h3>Subject Mastery</h3><p>Track progress across your subjects.</p></div></div><span className="demo-chip">Illustrative Data</span></header>
    <div className="mastery-subject-list">{demoMastery.map((item) => <article key={item.subject} className="mastery-subject"><span className="mastery-book"><BookOpen aria-hidden="true"/></span><div className="mastery-subject-info"><div className="mastery-subject-label"><h4>{item.subject}</h4><strong>{item.mastery}%</strong></div><div className="mastery-track" role="progressbar" aria-label={`${item.subject} illustrative mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.mastery}><span className={visible ? "is-visible" : ""} style={{ "--mastery-width": `${item.mastery}%` } as CSSProperties}/></div></div></article>)}</div>
    <p className="mastery-note">Example values for this preview. Actual progress is based on your study activity.</p>
  </section>;
}
