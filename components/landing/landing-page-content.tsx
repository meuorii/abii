import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { ProductExperienceTabs } from "@/components/landing/product-experience-tabs";
import { ScrollReveal, StaggerItem } from "@/components/motion/scroll-reveal";
import styles from "./landing-page.module.css";

export function LandingPageContent() {
  return <div className={styles.page} id="home">
    <a className={styles.skipLink} href="#main-content">Skip to content</a>
    <LandingNav />
    <main id="main-content">
      <LandingHero />

      <section className={`${styles.section} ${styles.experience}`} id="experience" aria-labelledby="experience-heading">
        <div className={styles.experienceIntro}>
          <ScrollReveal className={styles.experienceHeading}>
            <p className={styles.eyebrow}>A better way to study</p>
            <h2 id="experience-heading">See how a better study session comes together.</h2>
          </ScrollReveal>
          <ScrollReveal className={styles.experienceIntroCopy} delay={0.08}>
            <p>From organizing your subjects to testing your memory and tracking your progress, Abii helps you make every study session count.</p>
            <a href="#why-abii" className={styles.textLink}>Why active recall <ArrowDownRight aria-hidden="true" size={17}/></a>
          </ScrollReveal>
        </div>
        <ScrollReveal amount={0.06} delay={0.04}>
          <ProductExperienceTabs />
        </ScrollReveal>
      </section>

      <section className={styles.why} id="why-abii" aria-labelledby="why-heading">
        <div className={styles.whyInner}>
          <p className={styles.eyebrow}>Make your study time count</p>
          <div className={styles.whyLines}>
            <ScrollReveal><h2 id="why-heading">Less rereading.</h2></ScrollReveal>
            <ScrollReveal delay={0.1}><h2 className={styles.whyEmphasis}>More remembering.</h2></ScrollReveal>
          </div>
          <ScrollReveal className={styles.whyCopy} delay={0.2}>
            <p>Highlighting notes feels productive. Remembering them without looking is where learning gets stronger.</p>
            <p>Abii helps you make active recall part of your everyday study routine, one question and one small win at a time.</p>
          </ScrollReveal>
        </div>
      </section>

      <section className={`${styles.section} ${styles.personality}`} id="meet-abii" aria-labelledby="personality-heading">
        <ScrollReveal className={styles.personalityArt}>
          <Image src="/landing/home/brand-personality-mascot.png" alt="Abii, your cheerful study companion" width={1254} height={1254} sizes="(max-width: 700px) 78vw, (max-width: 1050px) 42vw, 470px" loading="lazy" />
        </ScrollReveal>
        <div className={styles.personalityCopy}>
          <ScrollReveal>
            <p className={styles.eyebrow}>A friendlier way to learn</p>
            <h2 id="personality-heading">Studying feels lighter with Abii around.</h2>
            <p className={styles.bodyCopy}>Meet Abii, your cheerful study companion who makes showing up, practicing, and celebrating small victories feel a little more rewarding.</p>
            <p className={styles.personalityAside}>Because studying should feel like progress, not pressure.</p>
            <span className={styles.plannedLink} aria-disabled="true" title="The About page is planned">Get to Know Abii <ArrowUpRight aria-hidden="true" size={17}/><small>Planned</small></span>
          </ScrollReveal>
        </div>
      </section>

      <section className={`${styles.section} ${styles.discover}`} id="discover" aria-labelledby="discover-heading">
        <div className={styles.discoverHead}>
          <ScrollReveal>
            <p className={styles.eyebrow}>Keep your curiosity going</p>
            <h2 id="discover-heading">A little help for your next study session.</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.08}><p className={styles.bodyCopy}>Discover practical learning guides, helpful study ideas, and small ways to make your next review more effective.</p></ScrollReveal>
        </div>
        <ul className={styles.editorialList}>
          <StaggerItem index={0} as="li" className={styles.editorialRow}>
            <span className={styles.editorialNumber}>01</span>
            <div className={styles.editorialType}>Guides</div>
            <div className={styles.editorialText}><h3>Getting Started with Active Recall</h3><p>Learn how to practice remembering instead of simply rereading your notes.</p></div>
            <span className={styles.plannedArrow} aria-hidden="true"><ArrowUpRight size={21}/></span>
            <small className={styles.plannedNote}>Planned</small>
          </StaggerItem>
          <StaggerItem index={1} as="li" className={styles.editorialRow}>
            <span className={styles.editorialNumber}>02</span>
            <div className={styles.editorialType}>Blog</div>
            <div className={styles.editorialText}><h3>Why Rereading Isn&apos;t Always Enough</h3><p>Explore why retrieval practice can make studying more meaningful.</p></div>
            <span className={styles.plannedArrow} aria-hidden="true"><ArrowUpRight size={21}/></span>
            <small className={styles.plannedNote}>Planned</small>
          </StaggerItem>
        </ul>
      </section>

      <section className={styles.cta} aria-labelledby="cta-heading">
        <div className={styles.ctaInner}>
          <div className={styles.ctaCopy}>
            <ScrollReveal>
              <p className={styles.eyebrow}>Your next small win</p>
              <h2 id="cta-heading">Ready to make it stick?</h2>
              <p className={styles.bodyCopy}>Your next study session could be the start of something better. Bring your subjects, take the first quiz, and let Abii help you along the way.</p>
              <Link href="/register" className="landing-button landing-button-primary">Start Studying with Abii <ArrowUpRight aria-hidden="true" size={17}/></Link>
            </ScrollReveal>
          </div>
          <ScrollReveal className={styles.ctaArt} delay={0.12}>
            <Image src="/landing/home/cta-mascot.png" alt="Abii cheering you on as you begin studying" width={1254} height={1254} sizes="(max-width: 700px) 72vw, (max-width: 1050px) 38vw, 440px" loading="lazy" />
          </ScrollReveal>
        </div>
      </section>
    </main>
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.footerBrand}><Link href="/" className="landing-brand" aria-label="Abii home"><span className="font-brand">abii</span><span>.</span></Link><p>A calmer way to remember.</p></div>
        <nav aria-label="Footer navigation"><a href="#home">Home</a><a href="#experience">Features</a><a href="#meet-abii">About</a><span aria-disabled="true">Blog · Planned</span><span aria-disabled="true">Guides · Planned</span></nav>
      </div>
      <small>© {new Date().getFullYear()} Abii. All rights reserved.</small>
    </footer>
  </div>;
}
