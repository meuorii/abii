import { SkeletonBlock, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";
import { MainPageHeroSkeleton } from "@/components/ui/main-page-skeletons";

function Block({ className = "" }: { className?: string }) { return <SkeletonBlock className={`rounded-xl ${className}`} />; }

export function BadgesPageSkeleton() {
  return <SkeletonRegion label="Loading badges page" className="mx-auto w-full min-w-0 space-y-5 p-4 pb-24 sm:p-6 xl:px-6">
    <MainPageHeroSkeleton variant="badges" />
    <section data-skeleton-section="statistics" className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 xl:grid-cols-4">
      <div data-skeleton-stat="total"><SkeletonCard className="min-h-32 rounded-[18px]"><Block className="h-3 w-24"/><Block className="mt-3 h-8 w-14"/><Block className="mt-2 h-3 w-28"/></SkeletonCard></div>
      <div data-skeleton-stat="unlocked"><SkeletonCard className="min-h-32 rounded-[18px]"><Block className="h-3 w-24"/><Block className="mt-3 h-8 w-14"/><Block className="mt-2 h-3 w-28"/></SkeletonCard></div>
      <div data-skeleton-stat="locked"><SkeletonCard className="min-h-32 rounded-[18px]"><Block className="h-3 w-24"/><Block className="mt-3 h-8 w-14"/><Block className="mt-2 h-3 w-28"/></SkeletonCard></div>
      <div data-skeleton-stat="collection"><SkeletonCard className="min-h-32 rounded-[18px]"><Block className="h-3 w-24"/><Block className="mt-3 h-8 w-14"/><Block className="mt-2 h-3 w-28"/></SkeletonCard></div>
    </section>
    <section data-skeleton-section="collection-progress"><SkeletonCard className="rounded-[18px] bg-[#FFF8FA]"><div className="flex items-center justify-between gap-3"><Block className="h-5 w-48"/><Block className="h-5 w-12"/></div><Block className="mt-4 h-3 w-full rounded-full"/></SkeletonCard></section>
    <section data-skeleton-section="rarity"><SkeletonCard className="rounded-[18px]"><Block className="h-5 w-40"/><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[0,1,2,3].map(i=><Block key={i} className="h-10"/>)}</div></SkeletonCard></section>
    <section data-skeleton-section="filters" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Block className="h-7 w-56"/><Block className="h-4 w-24"/></div><SkeletonCard className="space-y-3 rounded-[18px]"><div className="flex flex-wrap gap-2">{[0,1,2].map(i=><Block key={i} className="h-9 w-24 rounded-full"/>)}</div><div className="grid gap-3 sm:grid-cols-2"><Block className="h-10 rounded-xl"/><Block className="h-10 rounded-xl"/></div></SkeletonCard></section>
    <section data-skeleton-section="badge-grid" className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 sm:gap-4">{[0,1,2,3,4,5,6,7].map(i=><SkeletonCard key={i} className="min-w-0 rounded-[18px] p-3 sm:p-4"><div className="flex justify-between gap-2"><Block className="h-6 w-16"/><Block className="h-6 w-20"/></div><Block className="mx-auto mt-3 aspect-square w-full max-w-[104px] rounded-full bg-[#EBDDE3] sm:max-w-[124px] xl:max-w-[148px]"/><Block className="mx-auto mt-3 h-4 w-3/4"/><Block className="mt-4 h-2 w-full rounded-full"/></SkeletonCard>)}</section>
  </SkeletonRegion>;
}
