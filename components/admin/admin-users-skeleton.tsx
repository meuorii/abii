import { SkeletonBlock, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

export function UsersSkeleton() {
  return <SkeletonRegion label="Loading users" className="grid min-w-0 gap-5 sm:gap-6">
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between"><SkeletonBlock className="h-5 w-40 rounded-md" /><SkeletonBlock className="h-4 w-36 rounded" /></div>
      <div className="grid min-w-0 gap-3 min-[1050px]:grid-cols-12">
        <SkeletonCard className="grid min-h-56 content-between gap-4 min-[1050px]:col-span-5"><div className="grid gap-2"><SkeletonBlock className="h-4 w-32 rounded" /><SkeletonBlock className="h-10 w-36 rounded" /><SkeletonBlock className="h-4 w-44 rounded" /></div><SkeletonBlock className="h-24 w-48 rounded-full" /></SkeletonCard>
        <div className="grid gap-3 sm:grid-cols-2 min-[1050px]:col-span-7">
          {Array.from({ length: 3 }, (_, index) => <SkeletonCard key={index} className={`grid min-h-28 content-between gap-3 ${index === 2 ? "sm:col-span-2" : ""}`}>
            <SkeletonBlock className="h-4 w-4/5 rounded" /><SkeletonBlock className="h-8 w-16 rounded" /><SkeletonBlock className="h-2 w-full rounded" />
          </SkeletonCard>)}
        </div>
      </div>
    </div>
    <SkeletonCard className="grid gap-3">
      <div className="flex justify-between"><SkeletonBlock className="h-6 w-36 rounded-md" /><SkeletonBlock className="h-4 w-20 rounded" /></div>
      <SkeletonBlock className="h-10 w-full rounded-lg" />
      <SkeletonBlock className="h-25 w-full rounded-lg xl:h-12" />
      <SkeletonBlock className="h-8 w-full rounded-lg" />
      {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-12 w-full rounded-lg" />)}
      <SkeletonBlock className="h-10 w-40 justify-self-end rounded-lg" />
    </SkeletonCard>
  </SkeletonRegion>;
}
