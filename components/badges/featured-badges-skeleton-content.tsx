import { SkeletonBlock } from "@/components/ui/skeleton";
import { UnknownCollectionPlaceholder } from "@/components/ui/skeleton-collection";

/** Shared shape-only content for the streamed fallback and route skeletons. */
export function FeaturedBadgesSkeletonContent() {
  return <div aria-hidden="true" className="min-w-0 rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2.5"><SkeletonBlock className="h-9 w-9 rounded-xl" /><div className="space-y-2"><SkeletonBlock className="h-4 w-36 rounded" /><SkeletonBlock className="h-3 w-56 max-w-full rounded" /></div></div>
    <UnknownCollectionPlaceholder className="px-0 py-1" />
  </div>;
}
