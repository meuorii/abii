"use client";

import { usePathname } from "next/navigation";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import { OverviewSkeleton } from "@/components/admin/admin-overview";
import { UsersSkeleton } from "@/components/admin/admin-users-skeleton";
import { AnalyticsSkeleton } from "@/components/admin/admin-analytics-skeleton";

import { AnnouncementsSkeleton } from "@/components/admin/admin-announcements";
import { SecuritySkeleton } from "@/components/admin/admin-security";
import { PerformanceSkeleton } from "@/components/admin/admin-performance";

export default function LoadingAdminPage() {
  const pathname = usePathname();
  const hero = <SkeletonBlock className="h-[170px] rounded-[20px] sm:h-[250px] lg:h-[282px] xl:h-[312px]" />;
  if (pathname === "/admin") {
    return <div className="grid gap-5 sm:gap-6"><SkeletonBlock className="h-[164px] rounded-[18px] sm:h-[188px] lg:h-[204px]" /><OverviewSkeleton /></div>;
  }
  if (pathname === "/admin/users") {
    return <div className="grid gap-5 sm:gap-6">{hero}<UsersSkeleton /></div>;
  }
  if (pathname === "/admin/analytics") {
    return <div className="grid gap-5 sm:gap-6">{hero}<AnalyticsSkeleton controls /></div>;
  }
  if (pathname === "/admin/performance") {
    return <div className="grid gap-5 sm:gap-6">{hero}<PerformanceSkeleton controls /></div>;
  }
  if (pathname === "/admin/security") {
    return <div className="grid gap-5 sm:gap-6">{hero}<SecuritySkeleton controls /></div>;
  }
  if (pathname === "/admin/announcements") {
    return <div className="grid gap-5 sm:gap-6">{hero}<AnnouncementsSkeleton /></div>;
  }
  if (pathname === "/admin/support") {
    return <SkeletonRegion label="Loading support workspace" className="grid gap-5 sm:gap-6">
      {hero}
      <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(item => <SkeletonBlock key={item} className="h-20 rounded-xl" />)}</div>
      <div className="grid gap-4 min-[880px]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"><SkeletonBlock className="h-72 rounded-xl" /><SkeletonBlock className="h-96 rounded-xl" /></div>
    </SkeletonRegion>;
  }
  if (pathname === "/admin/settings") {
    return <SkeletonRegion label="Loading administrator settings" className="grid gap-5 sm:gap-6">
      {hero}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
        <div className="grid gap-4"><SkeletonBlock className="h-64 rounded-xl" /><SkeletonBlock className="h-72 rounded-xl" /><SkeletonBlock className="h-64 rounded-xl" /></div>
        <div className="grid content-start gap-4"><SkeletonBlock className="h-72 rounded-xl" /><SkeletonBlock className="h-80 rounded-xl" /></div>
      </div>
    </SkeletonRegion>;
  }
  const hasSummary = pathname !== "/admin/settings";
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
