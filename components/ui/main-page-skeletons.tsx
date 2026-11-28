import { SkeletonBlock, SkeletonCard, SkeletonCircle } from "@/components/ui/skeleton";
import { SkeletonCollection, UnknownCollectionPlaceholder } from "@/components/ui/skeleton-collection";
import { FeaturedBadgesSkeletonContent } from "@/components/badges/featured-badges-skeleton-content";
import Image from "next/image";
import { getLearnerHeroMascotFrame } from "@/components/ui/abii-page-hero";

type HeroVariant = "dashboard" | "subjects" | "review" | "progress" | "badges" | "settings" | "profile";

function Bar({ className = "" }: { className?: string }) { return <SkeletonBlock className={`rounded-lg ${className}`} />; }
function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) { return <SkeletonCard className={className}>{children}</SkeletonCard>; }

export function MainPageHeroSkeleton({ variant }: { variant: HeroVariant }) {
  const src = variant === "dashboard" ? "/dashboard-hero/dashboard.png" : variant === "review" ? "/dashboard-hero/review.png" : variant === "progress" ? "/dashboard-hero/progress.png" : variant === "badges" ? "/dashboard-hero/badges.png" : variant === "settings" ? "/dashboard-hero/settings.png" : variant === "profile" ? "/dashboard-hero/profile-hero.png" : "/dashboard-hero/my-subjects.png";
  const frame = getLearnerHeroMascotFrame(src);
  return <section data-skeleton-section="hero" aria-hidden="true" className="relative isolate grid min-h-[180px] grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch overflow-hidden rounded-2xl border border-[#E8DDE1] bg-[#FFE8EF] sm:min-h-[240px] sm:rounded-[20px] lg:min-h-[280px]">
    <div className="relative z-10 flex min-w-0 flex-col justify-center py-4 pl-4 pr-7 sm:py-6 sm:pl-6 sm:pr-8 lg:py-8 lg:pl-8">
      {variant === "profile" ? <><Bar className="h-7 w-4/5 max-w-[340px] bg-[#E8DDE1] sm:h-9" /><Bar className="h-3 w-full max-w-[380px]" /><Bar className="h-3 w-4/5 max-w-[310px]" /></> : <><Bar className="h-3 w-24 bg-[#E8DDE1]" />{variant === "dashboard" ? <div className="space-y-1"><Bar className="h-7 w-full max-w-[490px] bg-[#E8DDE1] sm:h-11" /><Bar className="h-7 w-4/5 max-w-[390px] bg-[#E8DDE1] sm:h-11" /></div> : <Bar className="h-6 w-full max-w-[330px] bg-[#E8DDE1] sm:h-9" />}<Bar className="h-3 w-full max-w-[300px]" /><Bar className="h-3 w-4/5 max-w-[240px]" /></>}
    </div>
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[60%] right-3 flex items-end justify-end sm:right-6 lg:right-8"><div className="relative h-[88%] w-auto max-w-full overflow-hidden sm:h-[90%] sm:max-w-none" style={{ aspectRatio: frame.aspectRatio }}><Image src={src} alt="" width={frame.width} height={frame.height} sizes="(max-width: 639px) 40vw, 420px" className={`absolute max-w-none ${frame.fit === "contain" ? "object-contain object-bottom" : "object-cover object-bottom"}`} style={frame.imageStyle} /></div></div>
  </section>;
}

type SubjectSkeletonIdentity = { id: string };
function SubjectCards({ items = null, visibleLimit }: { items?: readonly SubjectSkeletonIdentity[] | null; visibleLimit?: number }) {
  return <SkeletonCollection items={items} visibleLimit={visibleLimit} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4" unknownClassName="sm:px-2" getKey={(item) => item.id} renderItem={() => <Panel className="min-h-[160px] rounded-[18px] p-4 sm:p-5"><div className="flex min-w-0 items-center gap-3"><Bar className="h-11 w-11 shrink-0 rounded-xl bg-[#FFE8EF]"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-3/4"/><Bar className="h-3 w-1/2"/></div><Bar className="h-8 w-8 shrink-0 rounded-lg"/></div><Bar className="mt-5 h-2.5 w-full rounded-full"/><div className="mt-4 flex items-center justify-between"><Bar className="h-3 w-24"/><Bar className="h-8 w-8 rounded-lg"/></div></Panel>} />;
}

export function DashboardSkeleton() {
  return <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-4 pb-24 sm:space-y-6 sm:px-6 sm:py-6 lg:px-6 lg:py-5 lg:pb-8">
    <MainPageHeroSkeleton variant="dashboard" />
    <section data-skeleton-section="overall-mastery"><Panel className="rounded-[18px] sm:p-6"><Bar className="h-5 w-40"/><Bar className="mt-5 h-3 w-full rounded-full"/><div className="mt-3 flex justify-between"><Bar className="h-3 w-32"/><Bar className="h-3 w-16"/></div><Bar className="mt-4 h-3 w-4/5 max-w-[620px]"/></Panel></section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"><section data-skeleton-section="due-review"><Panel className="min-h-[190px] rounded-[18px] sm:p-6"><Bar className="h-5 w-40"/><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><Bar className="h-10 w-20"/><Bar className="mt-2 h-3 w-36"/></div><Bar className="h-11 w-36 rounded-full bg-[#E8DDE1]"/></div><Bar className="mt-5 h-3 w-3/4"/></Panel></section><section data-skeleton-section="study-streak"><Panel className="min-h-[190px] rounded-[18px] sm:p-6"><Bar className="h-5 w-36"/><div className="mt-5 flex items-center gap-4"><Bar className="h-12 w-12 rounded-full bg-[#FFE8EF]"/><div><Bar className="h-8 w-24"/><Bar className="mt-2 h-3 w-32"/></div></div><div className="mt-5 grid grid-cols-7 gap-2">{Array.from({length:7},(_,i)=><div key={i} className="space-y-2 text-center"><Bar className="mx-auto h-8 w-8 rounded-full"/><Bar className="mx-auto h-2 w-7"/></div>)}</div></Panel></section></div>
    <section data-skeleton-section="subjects" className="space-y-4"><div className="flex items-center justify-between gap-3"><Bar className="h-5 w-36"/><Bar className="h-9 w-28 rounded-full"/></div><SubjectCards visibleLimit={4}/></section>
    <section data-skeleton-section="featured-badges"><FeaturedBadgesSkeletonContent /></section>
    <section data-skeleton-section="quick-actions" className="space-y-4"><Bar className="h-5 w-32"/><div className="grid gap-3 sm:grid-cols-3">{[0,1,2].map(i=><Panel key={i} className="flex min-h-[92px] items-center gap-3 rounded-[18px]"><Bar className="h-11 w-11 shrink-0 rounded-xl bg-[#FFE8EF]"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-3/4"/><Bar className="h-3 w-full"/></div></Panel>)}</div></section>
  </div>;
}

export function SubjectsSkeleton() {
  return <div className="space-y-5 p-4 sm:space-y-7 sm:p-6 xl:p-7"><MainPageHeroSkeleton variant="subjects"/><section data-skeleton-section="subject-controls" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Bar className="h-5 w-36"/><div className="flex gap-2"><Bar className="h-10 w-28 rounded-xl"/><Bar className="h-10 w-32 rounded-xl"/></div></div><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><Bar className="h-11 w-full rounded-xl"/><Bar className="h-11 w-32 rounded-xl"/></div></section><section data-skeleton-section="subject-grid"><SubjectCards/></section></div>;
}

export function ReviewSkeleton() {
  return <div className="space-y-6 p-4 sm:p-6 xl:p-7">
    <MainPageHeroSkeleton variant="review" />
    <section data-skeleton-section="review-overview" className="space-y-4"><Bar className="h-5 w-40"/><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0,1,2,3].map(i=><Panel key={i} className="min-h-[118px]"><Bar className="h-3 w-32"/><Bar className="mt-4 h-8 w-16"/><Bar className="mt-2 h-3 w-28"/></Panel>)}</div></section>
    <section data-skeleton-section="recent-subjects" className="space-y-4"><div className="flex justify-between"><Bar className="h-5 w-40"/><Bar className="h-4 w-24"/></div><UnknownCollectionPlaceholder className="max-w-3xl"/></section>
    <section data-skeleton-section="review-by-topic"><Panel><Bar className="h-5 w-44"/><UnknownCollectionPlaceholder className="mt-2"/></Panel></section>
    <section data-skeleton-section="review-progress"><Panel><Bar className="h-5 w-40"/><div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_1.25fr] md:items-center"><div className="flex items-center justify-center"><Bar className="h-40 w-40 rounded-full"/></div><div className="space-y-4">{[0,1].map(i=><div key={i}><div className="flex justify-between"><Bar className="h-3 w-28"/><Bar className="h-3 w-12"/></div><Bar className="mt-2 h-3 w-full rounded-full"/></div>)}</div></div></Panel></section>
  </div>;
}

export function ProgressSkeleton() {
  return <div className="space-y-5 p-4 sm:p-6 xl:p-7">
    <MainPageHeroSkeleton variant="progress" />
    <section data-skeleton-section="summary" className="grid grid-cols-2 gap-3 xl:grid-cols-5">{[0,1,2,3].map(i=><Panel key={i} className="min-h-[110px]"><Bar className="h-3 w-24"/><Bar className="mt-4 h-7 w-16"/><Bar className="mt-2 h-3 w-20"/></Panel>)}<Panel><Bar className="h-3 w-24"/><Bar className="mt-4 h-7 w-16"/><Bar className="mt-2 h-3 w-20"/></Panel></section>
    <section data-skeleton-section="featured-badges"><FeaturedBadgesSkeletonContent /></section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,.95fr)]">
      <div className="space-y-5">
        <section data-skeleton-section="study-activity"><Panel className="min-h-[330px]"><div className="flex flex-wrap items-center justify-between gap-3"><div><Bar className="h-5 w-36"/><Bar className="mt-2 h-3 w-56"/></div><Bar className="h-9 w-36 rounded-full"/></div><div aria-hidden="true" className="mt-5 flex h-[205px] flex-col justify-evenly gap-3 border-b border-l border-[#E8DDE1] px-4 py-3">{[0,1,2,3,4].map(i=><Bar key={i} className="h-px w-full rounded-none opacity-70"/>)}</div><div className="mt-4 grid grid-cols-2 gap-3"><Bar className="h-14 rounded-xl"/><Bar className="h-14 rounded-xl"/></div></Panel></section>
        <section data-skeleton-section="subject-performance"><Panel><Bar className="h-5 w-44"/><UnknownCollectionPlaceholder className="mt-2"/></Panel></section>
        <section data-skeleton-section="topic-mastery"><Panel><Bar className="h-5 w-40"/><UnknownCollectionPlaceholder className="mt-2"/></Panel></section>
      </div>
      <div className="space-y-5">
        <section data-skeleton-section="needs-more-practice"><Panel><Bar className="h-5 w-44"/><UnknownCollectionPlaceholder className="mt-2"/></Panel></section>
        <section data-skeleton-section="recent-sessions"><Panel><Bar className="h-5 w-40"/><UnknownCollectionPlaceholder className="mt-2"/></Panel></section>
      </div>
    </div>
  </div>;
}

export function SettingsSkeleton() {
  return <div className="mx-auto w-full min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-6 xl:px-6 xl:py-7"><MainPageHeroSkeleton variant="settings"/><div className="grid gap-5 xl:grid-cols-2 xl:gap-6"><section data-skeleton-section="study-preferences"><Panel className="h-full"><Bar className="h-5 w-44"/><Bar className="mt-2 h-3 w-64 max-w-full"/><div className="mt-5 space-y-4 rounded-xl border border-[#E8DDE1] p-4">{[0,1,2,3].map(i=><div key={i} className="space-y-2"><Bar className="h-3 w-36"/><Bar className="h-10 w-full rounded-xl"/></div>)}<div className="flex gap-2"><Bar className="h-10 w-24 rounded-xl"/><Bar className="h-10 w-24 rounded-xl"/></div></div><div className="mt-4 space-y-3 rounded-xl border border-[#E8DDE1] p-4"><Bar className="h-4 w-32"/><Bar className="h-3 w-48"/><Bar className="h-2 w-full rounded-full"/><div className="flex gap-2">{[0,1,2].map(i=><Bar key={i} className="h-9 flex-1 rounded-lg"/>)}</div></div></Panel></section><section data-skeleton-section="data-privacy"><Panel className="h-full"><Bar className="h-5 w-36"/><Bar className="mt-2 h-3 w-56 max-w-full"/><div className="mt-5 space-y-3">{[0,1,2,3].map(i=><div key={i} className="flex min-h-[76px] items-center gap-3 rounded-xl border border-[#E8DDE1] p-3"><Bar className="h-10 w-10 shrink-0 rounded-xl"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-3/4"/><Bar className="h-3 w-full max-w-[300px]"/></div><Bar className="h-9 w-20 shrink-0 rounded-lg"/></div>)}</div></Panel></section></div></div>;
}

export function ProfileSkeleton() {
  return <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-7 px-4 py-7 pb-24 sm:space-y-9 sm:px-6 sm:py-9 xl:px-6"><MainPageHeroSkeleton variant="profile"/><section data-skeleton-section="account-overview"><Panel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:p-6"><SkeletonCircle className="h-[72px] w-[72px] shrink-0 bg-[#FFE8EF]"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-5 w-48 max-w-full"/><Bar className="h-3 w-64 max-w-full"/><Bar className="h-3 w-40"/></div><div className="flex gap-2"><Bar className="h-9 w-28 rounded-xl"/><Bar className="h-9 w-24 rounded-xl"/></div></Panel></section><div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:gap-10"><section data-skeleton-section="personal-information"><Panel className="space-y-5"><Bar className="h-5 w-44"/><div className="flex items-center gap-4"><SkeletonCircle className="h-16 w-16 bg-[#FFE8EF]"/><Bar className="h-9 w-32 rounded-xl"/><Bar className="h-9 w-28 rounded-xl"/></div>{[0,1].map(i=><div key={i} className="space-y-2"><Bar className="h-3 w-28"/><Bar className="h-11 w-full rounded-xl"/></div>)}<Bar className="h-10 w-32 rounded-xl"/></Panel></section><section data-skeleton-section="password-security"><Panel className="space-y-5"><Bar className="h-5 w-44"/>{[0,1,2].map(i=><div key={i} className="space-y-2"><Bar className="h-3 w-28"/><Bar className="h-11 w-full rounded-xl"/></div>)}<Bar className="h-10 w-36 rounded-xl"/></Panel></section></div><section data-skeleton-section="danger-zone" className="border-t border-[#E8DDE1] pt-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-2"><Bar className="h-5 w-32"/><Bar className="h-3 w-80 max-w-[80vw]"/><Bar className="h-3 w-64 max-w-[70vw]"/></div><Bar className="h-10 w-36 rounded-xl"/></div></section></div>;
}
