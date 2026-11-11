import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "../landing-nav";
import { LandingFooter } from "../landing-footer";
import styles from "./about-page.module.css";

const beliefs = [
  { title: "Practice", statement: "Remember by doing.", description: "A little practice helps you understand what you know and what deserves another look." },
  { title: "Progress", statement: "Notice the little wins.", description: "See what you've learned, discover where you can improve, and appreciate your progress." },
  { title: "Consistency", statement: "Grow at your own pace.", description: "Find a rhythm that works for you and come back when you're ready." },
];

export function AboutPageContent() {
  return <div className={styles.page}>
    <a className={styles.skipLink} href="#about-main">Skip to content</a>
    <LandingNav />
    <main id="about-main" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={styles.heroCopy}><h1 id="about-title">Meet Abii, your<br />little <span>study buddy.</span></h1><p>Abii is here to make studying feel a little lighter and learning a lot more rewarding. With a friendly companion by your side, every small step becomes part of something bigger.</p></div>
        <div className={styles.heroArt}><Image src="/landing/about/about-hero.png" alt="Abii welcoming you with an outstretched paw" width={1672} height={941} priority quality={95} sizes="(max-width: 700px) 100vw, 100vw" /></div>
      </section>
      <section className={styles.why} aria-labelledby="why-title"><div className={styles.whyInner}>
        <p className={styles.eyebrow}>WHY ABII EXISTS</p><h2 id="why-title">Studying shouldn&apos;t<br />feel <span>so overwhelming.</span></h2>
        <div className={styles.whyCopy}><p>Between scattered notes, endless rereading, and figuring out what to study next, learning can sometimes feel harder than it needs to be.</p><p>That&apos;s why Abii exists to bring a little clarity to your study routine, help you practice what you&apos;ve learned, and make every small step feel like progress.</p></div>
      </div></section>
      <section className={styles.beliefs} aria-labelledby="beliefs-title"><div className={styles.beliefsInner}><p className={styles.eyebrow}>WHAT WE BELIEVE</p><h2 id="beliefs-title">Small steps make a big difference.</h2><div className={styles.cards}>{beliefs.map((belief, index) => <article className={`${styles.card} ${index === 1 ? styles.cardSoft : ""}`} key={belief.title}><h3>{belief.title}</h3><div className={styles.cardCopy}><h4>{belief.statement}</h4><p>{belief.description}</p></div></article>)}</div></div></section>
      <section className={styles.cta} aria-labelledby="cta-title"><div className={styles.ctaPanel}><div className={styles.ctaCopy}><h2 id="cta-title">We&apos;ve met. Now let&apos;s <span>grow together.</span></h2><p>Getting to know Abii is just the start. Let&apos;s make learning friendlier, together.</p><Link href="/register" className={styles.button}>Get Started</Link></div><div className={styles.ctaArt}><Image src="/landing/about/about-cta-mascot.png" alt="Abii happily waving hello" width={1199} height={1312} quality={95} sizes="(max-width: 700px) 220px, (max-width: 1000px) 280px, 340px" /></div></div></section>
    </main>
    <LandingFooter />
  </div>;
}
