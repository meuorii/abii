import { AbiiPageHero } from "@/components/ui/abii-page-hero";

export function BadgeHero() {
  return (
    <AbiiPageHero
      variant="badges"
      headingId="badges-hero-title"
      eyebrow={<p>YOUR ACHIEVEMENTS</p>}
      title={<h1 className="abii-hero-heading max-w-[620px]">Every Milestone Matters!</h1>}
      description={<p className="max-w-[480px]">Celebrate your progress, collect achievements, and discover how far your learning journey has come.</p>}
      mascotSrc="/dashboard-hero/badges.png"
      mascotAlt="Abii celebrating your learning achievements"
      priority
      className="mb-5"
    />
  );
}
