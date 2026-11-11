import Image from "next/image";
import { LandingNav } from "../landing-nav";
import { LandingFooter } from "../landing-footer";
import { WorkspaceShowcase } from "./workspace-showcase";
import { ReviewGallery } from "./review-gallery";
import { ScreenshotViewer } from "./screenshot-viewer";
import styles from "./features-page.module.css";

const badges = [
  { name: "Hello, Abii!", src: "hello-abi-unlocked.png" },
  { name: "Card Creator", src: "card-creator-unlocked.png" },
  { name: "Quiz Rookie", src: "quiz-rookie-unlocked.png" },
  { name: "Dedicated Otter", src: "dedicated-otter-unlocked.png" },
  { name: "Mastermind Abii", src: "mastermind-abii-unlocked.png" },
  { name: "Ultimate Scholar", src: "ultimate-scholar-unlocked.png" },
];

export function FeaturesPageContent() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#features-main">Skip to content</a>
      <LandingNav />
      <main id="features-main" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="features-title">
          <div className={styles.heroArt}>
            <Image
              src="/landing/features/features-hero.png"
              alt="Abii peeking around a doorway to welcome you into your study space"
              width={1672}
              height={941}
              priority
              quality={95}
              sizes="100vw"
            />
          </div>
          <div className={styles.heroCopy}>
            <h1 id="features-title">Everything you need to make <span>learning stick.</span></h1>
            <p className={styles.heroDescription}>Keep your study materials organized, turn knowledge into practice, and see how far you&apos;ve come all in one friendly space.</p>
          </div>
        </section>

        <section className={styles.workspace} aria-labelledby="workspace-title">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>ORGANIZE YOUR WORKSPACE</p>
            <h2 id="workspace-title">A place for every subject.</h2>
            <p>From subject folders to individual flashcards, keep your study materials organized and easy to find. Everything has its place, so you can focus on learning.</p>
          </div>
          <WorkspaceShowcase />
        </section>

        <section className={styles.flashcards} aria-labelledby="flashcards-title">
          <div className={styles.flashcardPreviews}>
            <figure>
              <div className={styles.modalPreview}>
                <Image src="/landing/features/creating-flashcard-standard.png" alt="Standard flashcard creation form in Abii" width={810} height={1080} unoptimized sizes="(max-width: 700px) calc((100vw - 52px) / 2), (max-width: 1000px) 38vw, 430px" />
              </div>
              <figcaption>Standard Flashcards</figcaption>
              <ScreenshotViewer src="/landing/features/creating-flashcard-standard.png" alt="Standard flashcard creation form in Abii" width={810} height={1080} sizes="100vw" className={styles.viewerInline} />
            </figure>
            <figure>
              <div className={styles.modalPreview}>
                <Image src="/landing/features/creating-flashcard-enumeration.png" alt="Enumeration flashcard creation form in Abii" width={810} height={1080} unoptimized sizes="(max-width: 700px) calc((100vw - 52px) / 2), (max-width: 1000px) 38vw, 430px" />
              </div>
              <figcaption>Enumeration Flashcards</figcaption>
              <ScreenshotViewer src="/landing/features/creating-flashcard-enumeration.png" alt="Enumeration flashcard creation form in Abii" width={810} height={1080} sizes="100vw" className={styles.viewerInline} />
            </figure>
          </div>
          <div className={styles.flashcardCopy}>
            <p className={styles.eyebrow}>CREATE YOUR FLASHCARDS</p>
            <h2 id="flashcards-title">Your notes, made easier <span>to remember.</span></h2>
            <p>Turn what you&apos;ve learned into your own flashcards. Create simple questions and answers or practice recalling complete lists all at your own pace.</p>
          </div>
        </section>

        <section className={styles.practice} aria-labelledby="practice-title">
          <div className={styles.sectionIntroLeft}>
            <p className={styles.eyebrow}>PRACTICE ACTIVE RECALL</p>
            <h2 id="practice-title">Put your memory <span>to work.</span></h2>
            <p>Go beyond rereading. Test what you know with different question types, focus on what matters, and build confidence one answer at a time.</p>
          </div>
          <ReviewGallery />
        </section>

        <section className={styles.progress} aria-labelledby="progress-title">
          <div className={styles.progressCopy}>
            <p className={styles.eyebrow}>SEE YOUR PROGRESS</p>
            <h2 id="progress-title">Know what sticks. <span>See what needs work.</span></h2>
            <p>Follow your mastery, see how often you study, and discover which subjects or topics need a little more practice.</p>
            <ul>
              <li>Subject and topic mastery</li>
              <li>Study activity and streaks</li>
              <li>Quiz accuracy and performance</li>
            </ul>
          </div>
          <div className={styles.progressMedia}>
            <div className={styles.progressImage}>
              <Image src="/landing/features/progress.png" alt="Abii progress dashboard showing mastery and study activity" width={1920} height={1080} unoptimized sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1000px) 68vw, 820px" />
            </div>
            <ScreenshotViewer src="/landing/features/progress.png" alt="Abii progress dashboard showing mastery and study activity" width={1920} height={1080} sizes="100vw" className={styles.viewerInline} />
          </div>
        </section>

        <section className={styles.achievements} aria-labelledby="achievements-title">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>CELEBRATE YOUR WINS</p>
            <h2 id="achievements-title">Little wins deserve a little celebration.</h2>
            <p>Every study session brings you closer to something great. Unlock badges, reach new milestones, and celebrate how far you&apos;ve come.</p>
          </div>
          <div className={styles.badges}>
            {badges.map((badge) => (
              <figure key={badge.src}>
                <Image src={`/badges/unlocked/${badge.src}`} alt="" width={240} height={240} sizes="(max-width: 500px) 30vw, (max-width: 900px) 20vw, 150px" />
                <figcaption>{badge.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
