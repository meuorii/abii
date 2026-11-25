import { SkeletonBlock, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

export function AnalyticsSkeleton({ controls = false }: { controls?: boolean }) {
  return <SkeletonRegion label="Loading analytics report" className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6">
    {controls && <div className="flex flex-wrap items-end justify-between gap-3">
      <SkeletonBlock className="h-12 w-52 rounded-lg" /><SkeletonBlock className="h-12 w-56 rounded-xl" />
    </div>}
    <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} className="grid min-h-36 content-between gap-2">
        <SkeletonBlock className="h-4 w-4/5 rounded" /><SkeletonBlock className="h-7 w-14 rounded" /><SkeletonBlock className="h-4 rounded" />
      </SkeletonCard>)}
    </div>
    <div className="grid min-w-0 grid-cols-1 gap-3 min-[1100px]:grid-cols-12">
      <SkeletonCard className="grid gap-3 min-[1100px]:col-span-8"><SkeletonBlock className="h-5 w-44 rounded" /><SkeletonBlock className="h-4 w-4/5 rounded" /><SkeletonBlock className="h-48 rounded-lg" /></SkeletonCard>
      <SkeletonCard className="grid gap-3 min-[1100px]:col-span-4"><SkeletonBlock className="h-5 w-36 rounded" /><SkeletonBlock className="h-4 w-4/5 rounded" /><SkeletonBlock className="h-40 rounded-full justify-self-center" /></SkeletonCard>
      <SkeletonCard className="grid gap-3 min-[1100px]:col-span-8"><SkeletonBlock className="h-5 w-40 rounded" /><SkeletonBlock className="h-44 rounded-lg" /></SkeletonCard>
      <SkeletonCard className="grid gap-3 min-[1100px]:col-span-4"><SkeletonBlock className="h-5 w-36 rounded" /><SkeletonBlock className="h-44 rounded-lg" /></SkeletonCard>
      <SkeletonCard className="grid gap-3 min-[1100px]:col-span-12"><SkeletonBlock className="h-5 w-40 rounded" /><SkeletonBlock className="h-52 rounded-lg" /></SkeletonCard>
      {Array.from({ length: 2 }, (_, index) => <SkeletonCard key={index} className="grid gap-3 min-[1100px]:col-span-6"><SkeletonBlock className="h-5 w-40 rounded" /><SkeletonBlock className="h-44 rounded-lg" /></SkeletonCard>)}
    </div>
  </SkeletonRegion>;
}
