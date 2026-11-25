import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { SkeletonBlock } from "@/components/ui/skeleton";

const adminPages = {
  overview: { eyebrow: "ADMIN OVERVIEW", heading: "Everything in one view.", description: "Your platform, people, and activity." },
  users: { eyebrow: "USER MANAGEMENT", heading: "Every learner matters.", description: "Manage accounts and keep Abii welcoming." },
  analytics: { eyebrow: "PLATFORM ANALYTICS", heading: "See how learning grows.", description: "Understand the activity behind every study session." },
  performance: { eyebrow: "SYSTEM PERFORMANCE", heading: "Keep things running smoothly.", description: "Monitor Abii’s speed, stability, and reliability." },
  security: { eyebrow: "SECURITY & LOGS", heading: "Safety in every step.", description: "Monitor security activity and protect the Abii community." },
  announcements: { eyebrow: "ANNOUNCEMENTS", heading: "Keep everyone in the loop.", description: "Share meaningful updates with the Abii community." },
  support: { eyebrow: "SUPPORT", heading: "Here to help, always.", description: "Keep conversations organized and support within reach." },
  settings: { eyebrow: "SETTINGS", heading: "Make every detail count.", description: "Manage the essentials that keep Abii running your way." },
} as const;

export type AdminPageKey = keyof typeof adminPages;

export function AdminPageHero({ page }: { page: AdminPageKey }) {
  const content = adminPages[page];
  return <AbiiPageHero variant="admin-overview" headingId="admin-page-title" priority className="admin-page-hero"
    eyebrow={<span className="text-xs font-semibold tracking-[0.08em] text-[#812544]">{content.eyebrow}</span>}
    title={<h1 className="text-[clamp(1.25rem,3.3vw,2.8rem)] leading-[1.08] font-bold tracking-[-0.04em] text-[#30252D]">{content.heading}</h1>}
    description={<p className="mt-3 max-w-[42ch] text-xs leading-5 text-[#66565F] sm:text-sm sm:leading-6">{content.description}</p>}
    mascotSrc={`/dashboard-hero/admin/admin-${page}.png`} mascotAlt="" />;
}

export function AdminPageHeroSkeleton() {
  return <SkeletonBlock aria-hidden="true" className="h-[168px] rounded-[18px] sm:h-[188px] lg:h-[204px]" />;
}
