import { Suspense } from "react";
import { AdminPageHero } from "@/components/admin/admin-page";
import { AdminOverview, OverviewSkeleton } from "@/components/admin/admin-overview";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";
import { readOverview } from "@/lib/admin/overview";

async function OverviewData({ period }: { period: string | string[] | undefined }) {
  return <AdminOverview report={await readOverview(period)} />;
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  if ((await getAdminPageAccess()).status !== 200) return null;
  const { period } = await searchParams;
  return (
    <div className="grid min-w-0 gap-5 sm:gap-6">
      <AdminPageHero page="overview" />
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewData period={period} />
      </Suspense>
    </div>
  );
}
