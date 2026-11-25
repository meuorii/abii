import { Suspense } from "react";
import { AdminPerformance, PerformanceControls, PerformanceSkeleton } from "@/components/admin/admin-performance";
import { AdminPageHero } from "@/components/admin/admin-page";
import { readPerformance } from "@/lib/admin/performance";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";
import { monitoringWindow } from "@/lib/performance/monitoring";

async function PerformanceData({ period, now }: { period: string; now: Date }) {
  return <AdminPerformance report={await readPerformance(period, now)} />;
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  if ((await getAdminPageAccess()).status !== 200) return null;
  const { period } = await searchParams;
  const now = new Date();
  const window = monitoringWindow(period, now);
  return (
    <div className="admin-overview-workspace admin-refined grid min-w-0 gap-5 bg-[#FFF9FC] sm:gap-6">
      <AdminPageHero page="performance" />
      <section aria-labelledby="system-monitoring" className="grid min-w-0 gap-4">
        <PerformanceControls window={window} />
        <Suspense key={window.period} fallback={<PerformanceSkeleton />}>
          <PerformanceData period={window.period} now={now} />
        </Suspense>
      </section>
    </div>
  );
}
