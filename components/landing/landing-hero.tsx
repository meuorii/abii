import Image from "next/image";
import Link from "next/link";
import styles from "./landing-page.module.css";
export function LandingHero() {
  return <section className={styles.hero} aria-labelledby="landing-title">
    <div className={`${styles.container} ${styles.heroInner}`}><div className={styles.heroCopy}>
      <h1 id="landing-title">Learn a little.<br/><span>Remember a lot.</span></h1>
      <p>Meet Abii, your friendly study buddy. Organize your learning, practice with active recall, and turn little study sessions into lasting knowledge all in one place.</p>
      <div className={styles.heroActions}><Link href="/register" className={styles.button}>Get Started</Link><a href="#features" className={`${styles.button} ${styles.secondaryButton}`}>Explore Features</a></div>
    </div></div>
    <div className={styles.heroArt}><Image src="/landing/home/hero.png" alt="Abii studying with flashcards and an open book at a sunlit desk" width={1672} height={941} priority sizes="100vw" /></div>
  </section>;
}
