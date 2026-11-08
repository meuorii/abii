"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import styles from "./landing-page.module.css";

export function LandingHero() {
  return <section className={styles.hero} aria-labelledby="landing-title">
    <div className={styles.heroInner}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow} data-enter style={{ animationDelay: "0ms" }}>Your little study companion</p>
        <h1 id="landing-title" data-enter style={{ animationDelay: "60ms" }}>Your study space,<br/>made for <span>remembering.</span></h1>
        <p className={styles.heroDescription} data-enter style={{ animationDelay: "130ms" }}>Studying doesn&apos;t have to mean reading the same notes over and over. Keep your subjects organized, practice what you&apos;ve learned, and build confidence with every review.</p>
        <div className={styles.heroActions} data-enter style={{ animationDelay: "200ms" }}>
          <Link href="/register" className="landing-button landing-button-primary">Start Studying Free <ArrowUpRight aria-hidden="true" size={17}/></Link>
          <a href="#experience" className={styles.heroSecondary}>See Abii in Action <ArrowDownRight aria-hidden="true" size={17}/></a>
        </div>
      </div>
      <div className={styles.heroArt} data-enter style={{ animationDelay: "180ms" }}>
        <Image src="/landing/home/hero mascot.png" alt="Abii, your little study companion" width={1254} height={1196} priority sizes="(max-width: 700px) 88vw, (max-width: 1100px) 44vw, 540px" />
      </div>
    </div>
    <a className={styles.heroFootnote} href="#experience" aria-label="Scroll to the product experience"><span>Organize · Practice · Grow</span><ArrowDownRight aria-hidden="true" size={17}/></a>
  </section>;
}
