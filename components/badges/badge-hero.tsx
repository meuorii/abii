import { AbiiPageHero } from "@/components/ui/abii-page-hero";

export function BadgeHero() {
  return (
    <AbiiPageHero
      variant="badges"
      headingId="badges-hero-title"
      eyebrow={<p className="text-xs font-extrabold tracking-[.13em] text-[#D94E7B]">YOUR ACHIEVEMENTS</p>}
      title={<h1 className="mt-2 max-w-[620px] text-[28px] font-extrabold leading-tight tracking-[-.035em] text-[#183653] sm:text-3xl xl:text-4xl">Every Milestone Matters!</h1>}
      description={<p className="mt-3 max-w-[480px] text-sm leading-6 text-[#58718B] sm:text-base sm:leading-7">Celebrate your progress, collect achievements, and discover how far your learning journey has come.</p>}
      mascotSrc="/dashboard-hero/badges.png"
      mascotAlt="Abii celebrating your learning achievements"
      priority
      className="mb-5"
    />
  );
}
