import { Suspense } from "react";
import { AdminAnalytics, AnalyticsControls } from "@/components/admin/admin-analytics";
import { AnalyticsSkeleton } from "@/components/admin/admin-analytics-skeleton";
import { AdminPageHero } from "@/components/admin/admin-page";
import { readAnalytics } from "@/lib/admin/analytics";
import { precedingWindow, reportingWindow } from "@/lib/admin/reporting";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";

async function AnalyticsData({ period, now }: { period: string; now: Date }) {
  return <AdminAnalytics report={await readAnalytics(period, now)} />;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  if ((await getAdminPageAccess()).status !== 200) return null;
  const { period } = await searchParams;
  const now = new Date();
  const window = reportingWindow(period, now);
  return (
    <div className="admin-overview-workspace admin-refined grid min-w-0 gap-5 bg-[#FFF9FC] sm:gap-6">
      <AdminPageHero page="analytics" />
      <section aria-labelledby="platform-insights" className="grid min-w-0 gap-4">
        <AnalyticsControls window={window} previous={precedingWindow(window)} />
        <Suspense key={window.days} fallback={<AnalyticsSkeleton />}>
          <AnalyticsData period={String(window.days)} now={now} />
        </Suspense>
      </section>
    </div>
  );
}
