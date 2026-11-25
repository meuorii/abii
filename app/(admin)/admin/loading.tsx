"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import { OverviewSkeleton } from "@/components/admin/admin-overview";
import { UsersSkeleton } from "@/components/admin/admin-users-skeleton";
import { AnalyticsSkeleton } from "@/components/admin/admin-analytics-skeleton";

import { AnnouncementEditorSkeleton, AnnouncementsSkeleton } from "@/components/admin/admin-announcements";
import { SecuritySkeleton } from "@/components/admin/admin-security";
import { PerformanceSkeleton } from "@/components/admin/admin-performance";
import { AdminPageHeroSkeleton } from "@/components/admin/admin-page-hero";
import { SupportSkeleton } from "@/components/admin/admin-support";
import { SettingsSkeleton } from "@/components/admin/admin-settings";

export default function LoadingAdminPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const adminHero = <AdminPageHeroSkeleton />;
  if (pathname === "/admin") {
    return <div className="admin-overview-workspace grid gap-5 sm:gap-6">{adminHero}<OverviewSkeleton /></div>;
  }
  if (pathname === "/admin/users") {
    return <div className="admin-loading-refined grid gap-5 sm:gap-6">{adminHero}<UsersSkeleton /></div>;
  }
  if (pathname === "/admin/analytics") {
    return <div className="admin-loading-refined grid gap-5 sm:gap-6">{adminHero}<AnalyticsSkeleton controls /></div>;
  }
  if (pathname === "/admin/performance") {
    return <div className="admin-loading-refined grid gap-5 sm:gap-6">{adminHero}<PerformanceSkeleton controls /></div>;
  }
  if (pathname === "/admin/security") {
    return <div className="admin-refined grid gap-5 sm:gap-6">{adminHero}<SecuritySkeleton controls /></div>;
  }
  if (pathname === "/admin/announcements") {
    if (searchParams.get("editor") === "new" || searchParams.get("editor") === "edit") {
      return <div className="admin-refined grid gap-5 sm:gap-6"><AnnouncementEditorSkeleton /></div>;
    }
    return <div className="admin-refined grid gap-5 sm:gap-6">{adminHero}<AnnouncementsSkeleton /></div>;
  }
  if (pathname === "/admin/support") {
    return <div className="grid gap-5 sm:gap-6">{adminHero}<SupportSkeleton /></div>;
  }
  if (pathname === "/admin/settings") {
    return <div className="grid gap-5 sm:gap-6">{adminHero}<SettingsSkeleton /></div>;
  }
  const hasSummary = pathname !== "/admin/settings";
  return (
    <SkeletonRegion label="Loading administrator workspace" className="grid gap-5 sm:gap-6">
      {adminHero}
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
