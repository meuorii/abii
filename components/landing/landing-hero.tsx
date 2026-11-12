import Link from "next/link";
import { ResponsiveHero } from "./responsive-hero";
export function LandingHero() {
  return <ResponsiveHero image="/landing/home/hero.png" titleId="landing-title" mobileImageClassName="object-[69%_center]" desktopImageClassName="md:object-[57%_center] xl:object-center"><div className="w-full max-w-[35rem] md:max-w-[48%]">
      <h1 id="landing-title" className="text-[clamp(2.125rem,8vw,3rem)] font-bold leading-[1.05] tracking-[-.04em] md:text-[clamp(3rem,4.5vw,4.5rem)]">Learn a little.<br/><span className="text-[var(--pink-primary)]">Remember a lot.</span></h1>
      <p className="mt-4 max-w-[48ch] text-[clamp(.9375rem,1.2vw,1.125rem)] leading-[1.62] text-[var(--muted)] sm:mt-5">Meet Abii, your friendly study buddy. Organize your learning, practice with active recall, and turn little study sessions into lasting knowledge all in one place.</p>
      <div className="mt-6 flex flex-wrap gap-3 sm:mt-7"><Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--pink-primary)] px-[26px] py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-px hover:bg-[var(--pink-accent)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--foreground)] motion-reduce:transform-none">Get Started</Link><a href="#features" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--foreground)] px-[18px] py-2.5 text-sm font-semibold transition hover:bg-[var(--pink-soft)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--foreground)]">Explore Features</a></div>
    </div></ResponsiveHero>;
}
