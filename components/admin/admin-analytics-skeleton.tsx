import { SkeletonBlock, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

export function AnalyticsSkeleton({ controls = false }: { controls?: boolean }) {
  return <SkeletonRegion label="Loading analytics report" className="grid min-w-0 gap-5 sm:gap-6">
    {controls && <div className="flex flex-wrap items-end justify-between gap-3">
      <SkeletonBlock className="h-12 w-52 rounded-lg" /><SkeletonBlock className="h-12 w-56 rounded-xl" />
    </div>}
    <SkeletonCard className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="grid gap-2">
        <SkeletonBlock className="h-4 w-4/5 rounded" /><SkeletonBlock className="h-7 w-14 rounded" /><SkeletonBlock className="h-4 rounded" />
      </div>)}
    </SkeletonCard>
    <SkeletonBlock className="h-5 w-44 rounded" />
    <div className="grid min-w-0 gap-3 min-[980px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      {Array.from({ length: 2 }, (_, index) => <SkeletonCard key={index} className="grid gap-3">
        <SkeletonBlock className="h-5 w-36 rounded" /><SkeletonBlock className="h-4 w-4/5 rounded" /><SkeletonBlock className="h-44 rounded-lg" />
      </SkeletonCard>)}
    </div>
  </SkeletonRegion>;
}
