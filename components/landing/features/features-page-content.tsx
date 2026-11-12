import Image from "next/image";
import { LandingNav } from "../landing-nav";
import { LandingFooter } from "../landing-footer";
import { WorkspaceShowcase } from "./workspace-showcase";
import { ReviewGallery } from "./review-gallery";
import { ScreenshotViewer } from "./screenshot-viewer";
import { ResponsiveHero } from "../responsive-hero";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";
const container = "mx-auto w-[min(1152px,calc(100%-2.5rem))] sm:w-[min(1152px,calc(100%-3rem))]";
const heading = "mt-2 text-[clamp(1.875rem,6vw,2.5rem)] font-bold leading-[1.1] tracking-[-.04em] md:text-[clamp(2.5rem,3.5vw,3.375rem)]";

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
    <div className="overflow-x-clip bg-white text-foreground">
      <a className="absolute left-4 top-3 z-50 -translate-y-[180%] bg-white px-5 py-3 focus:translate-y-0 focus:outline-3 focus:outline-pink-active" href="#features-main">Skip to content</a>
      <LandingNav />
      <main id="features-main" tabIndex={-1}>
        <ResponsiveHero image="/landing/features/features-hero.png" titleId="features-title" mobileImageClassName="object-[70%_center]" desktopImageClassName="md:object-[54%_center] xl:object-center"><div className="max-w-[39rem] md:max-w-[48%]">
            <ScrollReveal><h1 id="features-title" className="max-w-[15ch] text-[clamp(2.125rem,8vw,3rem)] font-bold leading-[1.05] tracking-[-.04em] md:text-[clamp(3rem,4.5vw,4.25rem)]">Everything you need to make <span className="text-pink-primary">learning stick.</span></h1></ScrollReveal>
            <ScrollReveal delay={0.1}><p className="mt-4 max-w-[48ch] text-[clamp(.9375rem,1.2vw,1.0625rem)] leading-[1.62] text-muted sm:mt-5">Keep your study materials organized, turn knowledge into practice, and see how far you&apos;ve come all in one friendly space.</p></ScrollReveal>
          </div></ResponsiveHero>

        <section className="px-5 py-16 sm:px-6 sm:py-24" aria-labelledby="workspace-title">
          <div className="mx-auto mb-9 max-w-[48rem] text-center">
            <ScrollReveal><h2 id="workspace-title" className={heading}>A place for every subject.</h2></ScrollReveal>
            <ScrollReveal delay={0.1}><p className="mx-auto mt-3 max-w-[68ch] text-base leading-relaxed text-muted">From subject folders to individual flashcards, keep your study materials organized and easy to find. Everything has its place, so you can focus on learning.</p></ScrollReveal>
          </div>
          <ScrollReveal preset="image" delay={0.16}><WorkspaceShowcase /></ScrollReveal>
        </section>

        <section className={`${container} grid items-center gap-8 py-16 sm:py-24 lg:grid-cols-[1.18fr_.82fr] lg:gap-16`} aria-labelledby="flashcards-title">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <figure className="min-w-0 text-center">
              <div className="grid h-[min(112vw,430px)] place-items-center overflow-hidden rounded-2xl bg-pink-soft sm:h-[27.5rem]">
                <Image src="/landing/features/creating-flashcard-standard.png" alt="Standard flashcard creation form in Abii" width={810} height={1080} unoptimized sizes="(max-width: 700px) calc((100vw - 52px) / 2), (max-width: 1000px) 38vw, 430px" />
              </div>
              <figcaption>Standard Flashcards</figcaption>
              <ScreenshotViewer src="/landing/features/creating-flashcard-standard.png" alt="Standard flashcard creation form in Abii" width={810} height={1080} sizes="100vw" />
            </figure>
            <figure className="min-w-0 text-center">
              <div className="grid h-[min(112vw,430px)] place-items-center overflow-hidden rounded-2xl bg-pink-soft sm:h-[27.5rem]">
                <Image src="/landing/features/creating-flashcard-enumeration.png" alt="Enumeration flashcard creation form in Abii" width={810} height={1080} unoptimized sizes="(max-width: 700px) calc((100vw - 52px) / 2), (max-width: 1000px) 38vw, 430px" />
              </div>
              <figcaption>Enumeration Flashcards</figcaption>
              <ScreenshotViewer src="/landing/features/creating-flashcard-enumeration.png" alt="Enumeration flashcard creation form in Abii" width={810} height={1080} sizes="100vw" />
            </figure>
          </div>
          <div>
            <h2 id="flashcards-title" className={heading}>Your notes, made easier <span className="text-pink-primary">to remember.</span></h2>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-muted">Turn what you&apos;ve learned into your own flashcards. Create simple questions and answers or practice recalling complete lists all at your own pace.</p>
          </div>
        </section>

        <section className="bg-pink-soft px-5 py-16 sm:px-6 sm:py-[5.5rem]" aria-labelledby="practice-title">
          <div className="mx-auto mb-7 max-w-6xl">
            <h2 id="practice-title" className={heading}>Put your memory <span className="text-pink-primary">to work.</span></h2>
            <p className="mt-3 max-w-[50ch] text-base leading-relaxed text-muted">Go beyond rereading. Test what you know with different question types, focus on what matters, and build confidence one answer at a time.</p>
          </div>
          <ReviewGallery />
        </section>

        <section className={`${container} grid items-center gap-9 py-16 sm:py-24 lg:grid-cols-[.62fr_1.38fr]`} aria-labelledby="progress-title">
          <div>
            <h2 id="progress-title" className={heading}>Know what sticks. <span className="text-pink-primary">See what needs work.</span></h2>
            <p className="mt-4 text-base leading-relaxed text-muted">Follow your mastery, see how often you study, and discover which subjects or topics need a little more practice.</p>
            <ul className="mt-5 grid gap-2 text-sm text-muted">
              <li>• Subject and topic mastery</li><li>• Study activity and streaks</li><li>• Quiz accuracy and performance</li>
            </ul>
          </div>
          <ScrollReveal preset="image" className="flex min-w-0 flex-col items-end gap-2">
            <div className="overflow-hidden rounded-2xl bg-pink-soft p-1">
              <Image src="/landing/features/progress.png" alt="Abii progress dashboard showing mastery and study activity" width={1920} height={1080} unoptimized sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1000px) 68vw, 820px" />
            </div>
            <ScreenshotViewer src="/landing/features/progress.png" alt="Abii progress dashboard showing mastery and study activity" width={1920} height={1080} sizes="100vw" />
          </ScrollReveal>
        </section>

        <section className="bg-pink-soft px-5 py-16 sm:px-6 sm:py-[5.5rem]" aria-labelledby="achievements-title">
          <div className="mx-auto mb-8 max-w-[48rem] text-center"><h2 id="achievements-title" className={heading}>Little wins deserve a little celebration.</h2><p className="mx-auto mt-3 max-w-[66ch] text-base leading-relaxed text-muted">Every study session brings you closer to something great. Unlock badges, reach new milestones, and celebrate how far you&apos;ve come.</p>
          </div>
          <StaggerContainer stagger={0.06} className="mx-auto grid max-w-[62.5rem] grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
            {badges.map((badge) => (
              <StaggerItem className="text-center" index={badges.indexOf(badge)} key={badge.src}><figure><Image className="mx-auto h-auto w-full max-w-[142px] transition-transform duration-150 hover:-translate-y-0.5" src={`/badges/unlocked/${badge.src}`} alt="" width={240} height={240} sizes="(max-width: 500px) 30vw, (max-width: 900px) 20vw, 150px" />
                <figcaption className="mt-2 text-xs font-semibold text-pink-primary">{badge.name}</figcaption>
              </figure></StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
