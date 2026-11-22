"use client";

import { usePathname } from "next/navigation";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import { OverviewSkeleton } from "@/components/admin/admin-overview";
import { UsersSkeleton } from "@/components/admin/admin-users-skeleton";
import { AnalyticsSkeleton } from "@/components/admin/admin-analytics-skeleton";

export default function LoadingAdminPage() {
  const pathname = usePathname();
  const hero = <SkeletonBlock className="h-[170px] rounded-[20px] sm:h-[250px] lg:h-[282px] xl:h-[312px]" />;
  if (pathname === "/admin") {
    return <div className="grid gap-5 sm:gap-6">{hero}<OverviewSkeleton /></div>;
  }
  if (pathname === "/admin/users") {
    return <div className="grid gap-5 sm:gap-6">{hero}<UsersSkeleton /></div>;
  }
  if (pathname === "/admin/analytics") {
    return <div className="grid gap-5 sm:gap-6">{hero}<AnalyticsSkeleton controls /></div>;
  }
  const hasSummary = pathname !== "/admin/performance" && pathname !== "/admin/settings";
  return (
    <SkeletonRegion label="Loading workspace" className="grid gap-5 sm:gap-6">
      {hero}
      {hasSummary && <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} className="h-20 rounded-2xl" />)}
      </div>}
      <div className="grid gap-4 min-[880px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SkeletonBlock className="h-44 rounded-2xl" />
        <SkeletonBlock className="h-44 rounded-2xl" />
      </div>
    </SkeletonRegion>
  );
}
