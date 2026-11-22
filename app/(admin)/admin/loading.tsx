"use client";

import { usePathname } from "next/navigation";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import { OverviewSkeleton } from "@/components/admin/admin-overview";

export default function LoadingAdminPage() {
  const pathname = usePathname();
  const hero = <SkeletonBlock className="h-[170px] rounded-[20px] sm:h-[250px] lg:h-[282px] xl:h-[312px]" />;
  if (pathname === "/admin") {
    return <div className="grid gap-5 sm:gap-6">{hero}<OverviewSkeleton /></div>;
  }
  const hasSummary = pathname !== "/admin/performance" && pathname !== "/admin/settings";
  return (
    <SkeletonRegion label="Loading workspace" className="grid gap-5 sm:gap-6">
      {hero}
      {pathname === "/admin/analytics" && <SkeletonBlock className="h-24 rounded-2xl" />}
      {hasSummary && <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} className="h-20 rounded-2xl" />)}
      </div>}
      <div className={pathname === "/admin/users" ? "grid gap-4" : "grid gap-4 min-[880px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"}>
        <SkeletonBlock className="h-44 rounded-2xl" />
        {pathname !== "/admin/users" && <SkeletonBlock className="h-44 rounded-2xl" />}
      </div>
    </SkeletonRegion>
  );
}
