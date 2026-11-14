import { SkeletonBlock, SkeletonCard, SkeletonCircle } from "@/components/ui/skeleton";
import { SkeletonCollection, UnknownCollectionPlaceholder } from "@/components/ui/skeleton-collection";
import { FeaturedBadgesSkeletonContent } from "@/components/badges/featured-badges-skeleton-content";

type HeroVariant = "dashboard" | "subjects" | "review" | "progress" | "badges" | "settings" | "profile";
const heroSize: Record<HeroVariant, string> = {
  dashboard: "sm:min-h-[248px] lg:min-h-[310px]",
  subjects: "sm:min-h-[238px] lg:min-h-[242px]",
  review: "sm:min-h-[245px] lg:min-h-[265px]",
  progress: "sm:min-h-[230px] xl:min-h-[250px]",
  badges: "sm:min-h-[230px] xl:min-h-[250px]",
  settings: "sm:min-h-[230px] lg:min-h-[248px]",
  profile: "sm:min-h-[230px] lg:min-h-[250px]",
};

function Bar({ className = "" }: { className?: string }) { return <SkeletonBlock className={`rounded-lg ${className}`} />; }
function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) { return <SkeletonCard className={className}>{children}</SkeletonCard>; }

export function MainPageHeroSkeleton({ variant, action = false }: { variant: HeroVariant; action?: boolean }) {
  return <section aria-hidden="true" className={`relative isolate grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-2 overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF4F7] pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:block sm:p-7 ${heroSize[variant]}`}>
    <div className="relative z-10 min-w-0 max-w-full space-y-3 py-3 sm:max-w-[62%] sm:py-0">
      {variant === "profile" ? <><Bar className="h-7 w-4/5 max-w-[340px] bg-[#EED7E0] sm:h-9" /><Bar className="h-3 w-full max-w-[380px]" /><Bar className="h-3 w-4/5 max-w-[310px]" /></> : <><Bar className="h-3 w-24 bg-[#F2DCE4]" />{variant === "dashboard" ? <div className="space-y-1"><Bar className="h-7 w-full max-w-[490px] bg-[#EED7E0] sm:h-11" /><Bar className="h-7 w-4/5 max-w-[390px] bg-[#EED7E0] sm:h-11" /></div> : <Bar className="h-6 w-full max-w-[330px] bg-[#EED7E0] sm:h-9" />}<Bar className="h-3 w-full max-w-[300px]" /><Bar className="h-3 w-4/5 max-w-[240px]" />{action && <Bar className="mt-2 h-10 w-32 rounded-full bg-[#F3D4DF]" />}</>}
    </div>
    <div aria-hidden="true" className="pointer-events-none relative col-start-2 row-start-1 min-h-[154px] min-w-0 min-[360px]:min-h-[158px] sm:absolute sm:inset-y-0 sm:right-0 sm:w-[40%]">
      <Bar className="absolute bottom-0 right-[5%] h-[76%] w-[85%] rounded-t-[48%] rounded-b-3xl bg-[#FFE6EE] sm:-bottom-8 sm:right-3 sm:h-[82%] sm:w-32" />
      <Bar className="absolute bottom-[43%] right-[28%] h-16 w-16 rounded-full bg-[#F7D5E0] sm:bottom-9 sm:right-16 sm:h-28 sm:w-28" />
    </div>
  </section>;
}

type SubjectSkeletonIdentity = { id: string };
function SubjectCards({ items = null, visibleLimit }: { items?: readonly SubjectSkeletonIdentity[] | null; visibleLimit?: number }) {
  return <SkeletonCollection items={items} visibleLimit={visibleLimit} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4" unknownClassName="sm:px-2" getKey={(item) => item.id} renderItem={() => <Panel className="min-h-[160px] rounded-[18px] p-4 sm:p-5"><div className="flex min-w-0 items-center gap-3"><Bar className="h-11 w-11 shrink-0 rounded-xl bg-[#F8DCE5]"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-3/4"/><Bar className="h-3 w-1/2"/></div><Bar className="h-8 w-8 shrink-0 rounded-lg"/></div><Bar className="mt-5 h-2.5 w-full rounded-full"/><div className="mt-4 flex items-center justify-between"><Bar className="h-3 w-24"/><Bar className="h-8 w-8 rounded-lg"/></div></Panel>} />;
}

export function DashboardSkeleton() {
  return <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-4 pb-24 sm:space-y-6 sm:px-6 sm:py-6 lg:px-6 lg:py-5 lg:pb-8">
    <MainPageHeroSkeleton variant="dashboard" action />
    <section data-skeleton-section="overall-mastery"><Panel className="rounded-[18px] sm:p-6"><Bar className="h-5 w-40"/><Bar className="mt-5 h-3 w-full rounded-full"/><div className="mt-3 flex justify-between"><Bar className="h-3 w-32"/><Bar className="h-3 w-16"/></div><Bar className="mt-4 h-3 w-4/5 max-w-[620px]"/></Panel></section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"><section data-skeleton-section="due-review"><Panel className="min-h-[190px] rounded-[18px] sm:p-6"><Bar className="h-5 w-40"/><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><Bar className="h-10 w-20"/><Bar className="mt-2 h-3 w-36"/></div><Bar className="h-11 w-36 rounded-full bg-[#F3D4DF]"/></div><Bar className="mt-5 h-3 w-3/4"/></Panel></section><section data-skeleton-section="study-streak"><Panel className="min-h-[190px] rounded-[18px] sm:p-6"><Bar className="h-5 w-36"/><div className="mt-5 flex items-center gap-4"><Bar className="h-12 w-12 rounded-full bg-[#F8DCE5]"/><div><Bar className="h-8 w-24"/><Bar className="mt-2 h-3 w-32"/></div></div><div className="mt-5 grid grid-cols-7 gap-2">{Array.from({length:7},(_,i)=><div key={i} className="space-y-2 text-center"><Bar className="mx-auto h-8 w-8 rounded-full"/><Bar className="mx-auto h-2 w-7"/></div>)}</div></Panel></section></div>
    <section data-skeleton-section="subjects" className="space-y-4"><div className="flex items-center justify-between gap-3"><Bar className="h-5 w-36"/><Bar className="h-9 w-28 rounded-full"/></div><SubjectCards visibleLimit={4}/></section>
    <section data-skeleton-section="featured-badges"><FeaturedBadgesSkeletonContent /></section>
    <section data-skeleton-section="quick-actions" className="space-y-4"><Bar className="h-5 w-32"/><div className="grid gap-3 sm:grid-cols-3">{[0,1,2].map(i=><Panel key={i} className="flex min-h-[92px] items-center gap-3 rounded-[18px]"><Bar className="h-11 w-11 shrink-0 rounded-xl bg-[#F8DCE5]"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-3/4"/><Bar className="h-3 w-full"/></div></Panel>)}</div></section>
  </div>;
}

export function SubjectsSkeleton() {
  return <div className="space-y-5 p-4 sm:space-y-7 sm:p-6 xl:p-7"><MainPageHeroSkeleton variant="subjects" action/><section data-skeleton-section="subject-controls" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Bar className="h-5 w-36"/><div className="flex gap-2"><Bar className="h-10 w-28 rounded-xl"/><Bar className="h-10 w-32 rounded-xl"/></div></div><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><Bar className="h-11 w-full rounded-xl"/><Bar className="h-11 w-32 rounded-xl"/></div></section><section data-skeleton-section="subject-grid"><SubjectCards/></section></div>;
}

export function ReviewSkeleton() {
  return <div className="space-y-6 p-4 sm:p-6 xl:p-7">
    <MainPageHeroSkeleton variant="review" action />
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
        <section data-skeleton-section="study-activity"><Panel className="min-h-[330px]"><div className="flex flex-wrap items-center justify-between gap-3"><div><Bar className="h-5 w-36"/><Bar className="mt-2 h-3 w-56"/></div><Bar className="h-9 w-36 rounded-full"/></div><div aria-hidden="true" className="mt-5 flex h-[205px] flex-col justify-evenly gap-3 border-b border-l border-[#F0E5E9] px-4 py-3">{[0,1,2,3,4].map(i=><Bar key={i} className="h-px w-full rounded-none opacity-70"/>)}</div><div className="mt-4 grid grid-cols-2 gap-3"><Bar className="h-14 rounded-xl"/><Bar className="h-14 rounded-xl"/></div></Panel></section>
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
  return <div className="mx-auto w-full min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-6 xl:px-6 xl:py-7"><MainPageHeroSkeleton variant="settings"/><div className="grid gap-5 xl:grid-cols-2 xl:gap-6"><section data-skeleton-section="study-preferences"><Panel className="h-full"><Bar className="h-5 w-44"/><Bar className="mt-2 h-3 w-64 max-w-full"/><div className="mt-5 space-y-4 rounded-xl border border-[#F0E5E9] p-4">{[0,1,2,3].map(i=><div key={i} className="space-y-2"><Bar className="h-3 w-36"/><Bar className="h-10 w-full rounded-xl"/></div>)}<div className="flex gap-2"><Bar className="h-10 w-24 rounded-xl"/><Bar className="h-10 w-24 rounded-xl"/></div></div><div className="mt-4 space-y-3 rounded-xl border border-[#F0E5E9] p-4"><Bar className="h-4 w-32"/><Bar className="h-3 w-48"/><Bar className="h-2 w-full rounded-full"/><div className="flex gap-2">{[0,1,2].map(i=><Bar key={i} className="h-9 flex-1 rounded-lg"/>)}</div></div></Panel></section><section data-skeleton-section="data-privacy"><Panel className="h-full"><Bar className="h-5 w-36"/><Bar className="mt-2 h-3 w-56 max-w-full"/><div className="mt-5 space-y-3">{[0,1,2,3].map(i=><div key={i} className="flex min-h-[76px] items-center gap-3 rounded-xl border border-[#F0E5E9] p-3"><Bar className="h-10 w-10 shrink-0 rounded-xl"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-3/4"/><Bar className="h-3 w-full max-w-[300px]"/></div><Bar className="h-9 w-20 shrink-0 rounded-lg"/></div>)}</div></Panel></section></div></div>;
}

export function ProfileSkeleton() {
  return <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-7 px-4 py-7 pb-24 sm:space-y-9 sm:px-6 sm:py-9 xl:px-6"><MainPageHeroSkeleton variant="profile"/><section data-skeleton-section="account-overview"><Panel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:p-6"><SkeletonCircle className="h-[72px] w-[72px] shrink-0 bg-[#F8DCE5]"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-5 w-48 max-w-full"/><Bar className="h-3 w-64 max-w-full"/><Bar className="h-3 w-40"/></div><div className="flex gap-2"><Bar className="h-9 w-28 rounded-xl"/><Bar className="h-9 w-24 rounded-xl"/></div></Panel></section><div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:gap-10"><section data-skeleton-section="personal-information"><Panel className="space-y-5"><Bar className="h-5 w-44"/><div className="flex items-center gap-4"><SkeletonCircle className="h-16 w-16 bg-[#F8DCE5]"/><Bar className="h-9 w-32 rounded-xl"/><Bar className="h-9 w-28 rounded-xl"/></div>{[0,1].map(i=><div key={i} className="space-y-2"><Bar className="h-3 w-28"/><Bar className="h-11 w-full rounded-xl"/></div>)}<Bar className="h-10 w-32 rounded-xl"/></Panel></section><section data-skeleton-section="password-security"><Panel className="space-y-5"><Bar className="h-5 w-44"/>{[0,1,2].map(i=><div key={i} className="space-y-2"><Bar className="h-3 w-28"/><Bar className="h-11 w-full rounded-xl"/></div>)}<Bar className="h-10 w-36 rounded-xl"/></Panel></section></div><section data-skeleton-section="danger-zone" className="border-t border-[#F0E5E9] pt-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-2"><Bar className="h-5 w-32"/><Bar className="h-3 w-80 max-w-[80vw]"/><Bar className="h-3 w-64 max-w-[70vw]"/></div><Bar className="h-10 w-36 rounded-xl"/></div></section></div>;
}
