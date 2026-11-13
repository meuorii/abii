import { SkeletonBlock } from "@/components/ui/skeleton";

/** Shared shape-only content for the streamed fallback and route skeletons. */
export function FeaturedBadgesSkeletonContent() {
  return <div aria-hidden="true" className="min-w-0 rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2.5"><SkeletonBlock className="h-9 w-9 rounded-xl" /><div className="space-y-2"><SkeletonBlock className="h-4 w-36 rounded" /><SkeletonBlock className="h-3 w-56 max-w-full rounded" /></div></div>
    <div className="grid grid-cols-1 gap-2.5 min-[390px]:grid-cols-2 xl:grid-cols-3"><SkeletonBlock className="h-24 rounded-xl" /><SkeletonBlock className="hidden h-24 rounded-xl min-[390px]:block" /></div>
  </div>;
}
