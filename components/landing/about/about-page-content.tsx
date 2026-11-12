import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "../landing-nav";
import { LandingFooter } from "../landing-footer";
import { ResponsiveHero } from "../responsive-hero";
const container = "mx-auto w-[min(1152px,calc(100%-2.5rem))] sm:w-[min(1152px,calc(100%-3rem))]";
const button = "inline-flex min-h-11 items-center justify-center rounded-full bg-pink-primary px-7 py-2.5 text-sm font-semibold text-foreground transition-[transform,background-color] duration-150 ease-out hover:-translate-y-px hover:bg-pink-accent active:scale-[.97] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-pink-active";

const beliefs = [
  { title: "Practice", statement: "Remember by doing.", description: "A little practice helps you understand what you know and what deserves another look." },
  { title: "Progress", statement: "Notice the little wins.", description: "See what you've learned, discover where you can improve, and appreciate your progress." },
  { title: "Consistency", statement: "Grow at your own pace.", description: "Find a rhythm that works for you and come back when you're ready." },
];

export function AboutPageContent() {
  return <div className="bg-white text-foreground">
    <a className="absolute left-4 top-3 z-50 -translate-y-[180%] bg-white px-5 py-3 focus:translate-y-0 focus:outline-3 focus:outline-pink-active" href="#about-main">Skip to content</a>
    <LandingNav />
    <main id="about-main" tabIndex={-1}>
      <ResponsiveHero image="/landing/about/about-hero.png" titleId="about-title" mobileImageClassName="object-[68%_center]" desktopImageClassName="md:object-[55%_center] xl:object-center"><div className="max-w-[34rem] md:max-w-[48%]"><h1 id="about-title" className="max-w-[14ch] text-[clamp(2.125rem,8vw,3rem)] font-bold leading-[1.05] tracking-[-.04em] md:text-[clamp(3rem,4.5vw,4.25rem)]">Meet Abii, your<br />little <span className="text-pink-primary">study buddy.</span></h1><p className="mt-4 max-w-[48ch] text-[clamp(.9375rem,1.2vw,1.0625rem)] leading-[1.62] text-muted sm:mt-5">Abii is here to make studying feel a little lighter and learning a lot more rewarding. With a friendly companion by your side, every small step becomes part of something bigger.</p></div></ResponsiveHero>
      <section className="bg-pink-card" aria-labelledby="why-title"><div className={`${container} grid gap-7 py-16 sm:grid-cols-2 sm:gap-10 sm:py-20`}>
        <h2 id="why-title" className="max-w-[16ch] text-[clamp(1.875rem,6vw,2.5rem)] font-bold leading-[1.1] tracking-[-.035em] md:text-[clamp(2.5rem,3.5vw,3.375rem)]">Studying shouldn&apos;t<br />feel <span className="text-pink-primary">so overwhelming.</span></h2>
        <div className="grid gap-5 text-[15px] leading-[1.7] text-muted sm:grid-cols-2"><p>Between scattered notes, endless rereading, and figuring out what to study next, learning can sometimes feel harder than it needs to be.</p><p>That&apos;s why Abii exists to bring a little clarity to your study routine, help you practice what you&apos;ve learned, and make every small step feel like progress.</p></div>
      </div></section>
      <section className={`${container} py-16 text-center sm:py-[5.5rem]`} aria-labelledby="beliefs-title"><h2 id="beliefs-title" className="mx-auto max-w-[19ch] text-[clamp(1.875rem,6vw,2.5rem)] font-bold leading-[1.1] tracking-[-.035em] md:text-[clamp(2.5rem,3.5vw,3.125rem)]">Small steps make a big difference.</h2><div className="mt-8 grid gap-4 text-left md:grid-cols-3 sm:mt-12">{beliefs.map((belief, index) => <article className={`flex min-h-56 flex-col justify-between rounded-[1.5rem] p-6 sm:p-7 ${index === 1 ? "bg-pink-soft" : "bg-pink-card"}`} key={belief.title}><h3 className="text-2xl font-bold tracking-[-.035em] text-pink-primary">{belief.title}</h3><div><h4 className="text-xl font-bold leading-tight tracking-[-.025em]">{belief.statement}</h4><p className="mt-2 max-w-[32ch] text-[15px] leading-[1.7] text-muted">{belief.description}</p></div></article>)}</div></section>
      <section className={`${container} pb-16 pt-14 sm:pb-20 sm:pt-24`} aria-labelledby="cta-title"><div className="relative isolate overflow-visible"><div aria-hidden="true" className="absolute inset-0 rounded-[2rem] bg-pink-card" /><div className="relative z-10 grid md:min-h-[264px] md:grid-cols-[1fr_310px] md:items-center"><div className="relative z-20 px-6 pt-8 text-center md:px-10 md:py-9 md:text-left"><h2 id="cta-title" className="text-[clamp(1.875rem,6vw,2rem)] font-bold leading-[1.12] tracking-[-.035em]">We&apos;ve met. Now let&apos;s <span className="text-pink-primary">grow together.</span></h2><p className="mx-auto mt-3 max-w-[42ch] text-sm leading-relaxed text-muted md:mx-0">Getting to know Abii is just the start. Let&apos;s make learning friendlier, together.</p><Link href="/register" className={`${button} relative z-30 mt-5`}>Get Started</Link></div><div className="pointer-events-none relative z-10 mx-auto mt-8 h-[242px] w-[220px] overflow-hidden md:absolute md:bottom-0 md:right-[4%] md:z-20 md:mt-0 md:h-[340px] md:w-[310px]"><Image className="h-auto w-full" src="/landing/about/about-cta-mascot.png" alt="Abii happily waving hello" width={1199} height={1312} quality={95} sizes="(max-width: 767px) 220px, 310px" /></div></div></div></section>
    </main>
    <LandingFooter />
  </div>;
}
