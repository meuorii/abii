import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingBrand } from "./landing-brand";
import styles from "./landing-page.module.css";
const steps = [
  { image: "1%20organize.png", category: "Organize", title: "Make it yours.", description: "Create subjects, organize topics, and build flashcards that fit the way you study.", alt: "Abii organizing study cards at a desk" },
  { image: "2%20practice.png", category: "Practice", title: "Put your memory to work.", description: "Choose a review mode and practice recalling what you've learned.", alt: "Abii thinking through a flashcard answer" },
  { image: "3%20progress.png", category: "Progress", title: "See what sticks.", description: "Follow your mastery and find out what needs a little more practice.", alt: "Abii celebrating learning progress beside a tablet" },
];
function Planned({ children }: { children: React.ReactNode }) { return <span className={styles.planned} aria-disabled="true">{children}<small>Planned</small></span>; }
export function LandingPageContent() {
  return <div className={styles.page} id="home"><a className={styles.skipLink} href="#main-content">Skip to content</a><LandingNav />
    <main id="main-content" tabIndex={-1}><LandingHero />
      <section className={`${styles.container} ${styles.product}`} id="features" aria-labelledby="product-heading">
        <Image className={styles.productArt} src="/landing/home/product.png" alt="Abii organizing, reading, recalling, and celebrating in a connected study workspace" width={1448} height={1086} sizes="(max-width: 700px) 100vw, 560px" />
        <div className={styles.productCopy}><h2 id="product-heading">Your space to learn,<br className={styles.desktopBreak}/> practice, and grow.</h2><p>Keep your subjects organized, turn what you&apos;ve learned into active recall practice, and see your progress along the way. Everything you need for a better study routine, all in one friendly space.</p><a className={styles.textLink} href="#how-abii-works">Explore All Features</a></div>
      </section>
      <section className={styles.why} id="why-abii" aria-labelledby="why-heading"><div className={`${styles.container} ${styles.whyInner}`}><p className={styles.eyebrow}>THE IDEA BEHIND ABII</p><h2 id="why-heading">Don&apos;t just read it.<br/><span>Remember it.</span></h2><p className={styles.whyDescription}>Reading your notes is a good start, but real learning happens when you try to remember what you&apos;ve studied. That&apos;s where active recall comes in. Abii helps you practice what you know, discover what needs more attention, and build stronger understanding one question at a time.</p></div></section>
      <section className={`${styles.container} ${styles.how}`} id="how-abii-works" aria-labelledby="how-heading"><p className={styles.eyebrow}>HOW ABII WORKS</p><h2 id="how-heading">A little structure. A lot of progress.</h2><p className={styles.howDescription}>Getting started with Abii is simple. Create your study space, challenge what you know, and watch your learning grow one review at a time.</p>
        <ol className={styles.steps}>{steps.map((step, index) => <li key={step.category}><div className={styles.stepArt}><Image src={`/landing/home/${step.image}`} alt={step.alt} width={1448} height={1086} sizes="(max-width: 700px) 100vw, (max-width: 899px) 44vw, 360px" /><div className={styles.stepLabel}><span>{index + 1}</span>{step.category}</div></div><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
      </section>
      <section className={`${styles.container} ${styles.cta}`} aria-labelledby="cta-heading"><div className={styles.ctaPanel}><div className={styles.ctaArt}><Image src="/landing/home/cta-mascot.png" alt="Abii welcoming you to your study journey" width={1254} height={1254} sizes="(max-width: 700px) 260px, 400px" /></div><div className={styles.ctaCopy}><h2 id="cta-heading">A little progress starts here.</h2><p>Your study journey is better with Abii by your side.</p><Link href="/register" className={styles.button}>Get Started</Link></div></div></section>
    </main>
    <footer className={styles.footer}><div className={styles.container}><div className={styles.footerTop}><div className={styles.footerBrand}><LandingBrand /><p>Learn a little. Remember a lot.</p></div><nav aria-label="Explore"><h2>Explore</h2><Link href="/">Home</Link><a href="#why-abii">About</a><a href="#features">Features</a><Planned>Blogs</Planned></nav><nav aria-label="Support"><h2>Support</h2><Planned>Help Center</Planned><Planned>FAQs</Planned><Planned>Contact Us</Planned></nav></div><div className={styles.footerBottom}><small>© 2026 Abii. All rights reserved.</small><div><Planned>Privacy Policy</Planned><Planned>Terms of Service</Planned></div></div></div></footer>
  </div>;
}
