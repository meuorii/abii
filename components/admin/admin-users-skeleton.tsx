import { SkeletonBlock, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

export function UsersSkeleton() {
  return <SkeletonRegion label="Loading users" className="grid min-w-0 gap-5 sm:gap-6">
    <div className="grid gap-3">
      <SkeletonBlock className="h-5 w-40 rounded-md" />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} className="grid gap-2">
          <SkeletonBlock className="h-4 w-4/5 rounded" /><SkeletonBlock className="h-7 w-12 rounded" /><SkeletonBlock className="h-3 w-full rounded" />
        </SkeletonCard>)}
      </div>
    </div>
    <SkeletonCard className="grid gap-3">
      <SkeletonBlock className="h-6 w-36 rounded-md" />
      <SkeletonBlock className="h-25 w-full rounded-lg xl:h-12" />
      <SkeletonBlock className="h-8 w-full rounded-lg" />
      {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-12 w-full rounded-lg" />)}
      <SkeletonBlock className="h-10 w-40 justify-self-end rounded-lg" />
    </SkeletonCard>
  </SkeletonRegion>;
}
