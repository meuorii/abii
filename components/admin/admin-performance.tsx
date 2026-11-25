import Link from "next/link";
import { CircleCheck, CircleHelp, CircleX, Clock3, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { AnalyticsChart } from "@/components/admin/analytics-chart";
import { AdminSparkline } from "@/components/admin/admin-echart";
import { AdminPanel } from "@/components/admin/admin-ui";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import type { PerformanceReport } from "@/lib/admin/performance";
import { emptyLatency, latencyBounds, mergeLatency, percentiles, routeLabels, type HealthState, type Latency, type MonitoringWindow } from "@/lib/performance/monitoring";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const preciseDate = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const date = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", timeZone: "UTC" });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#993557]";
const split = "grid min-w-0 grid-cols-1 items-start gap-4 min-[1100px]:col-span-12 min-[1100px]:grid-cols-12";
const columns = ["Endpoint", "Requests", "p50", "p95", "p99", "Server errors", "Last seen"];
const coverageText = {
  observed: "Recorded observations. Delivery gaps are possible.",
  empty: "No telemetry collected for this period.",
  disabled: "Telemetry collection is disabled.",
  "read-failed": "Monitoring storage could not be read.",
  limited: "The read limit was reached. Only the newest complete sets of stored fragments are included.",
};
const stateIcon = { Healthy: CircleCheck, Degraded: TriangleAlert, Unavailable: CircleX, Unknown: CircleHelp, Stale: Clock3 } satisfies Record<HealthState, typeof CircleCheck>;
const jobLabels = {
  completed: "Completed", partial: "Partial", partial_batch: "Partial batch", lease_busy: "Lease busy",
  started: "Start observed", overdue: "Overdue evidence", failed: "Failed",
} as const;
const colors = { median: "#F8769C", p95: "#F8769C", p99: "#F8769C", volume: "#FFDBED", error: "#F8769C", client: "#FFDBED" };

function Stamped({ value, precise = false }: { value: Date | number | null; precise?: boolean }) {
  if (!value) return <span className="text-muted">No observation</span>;
  const timestamp = new Date(value);
  return <time dateTime={timestamp.toISOString()}>{(precise ? preciseDate : dateTime).format(timestamp)} UTC</time>;
}

function ms(value: number | null) {
  return value === null ? "Unavailable" : `${number.format(value)} ms`;
}
function average(latency: Latency) {
  return latency.count ? latency.sum / latency.count : null;
}
function count(value: number, noun: string) {
  return `${number.format(value)} ${noun}${value === 1 ? "" : "s"}`;
}
function plotIntervals(report: PerformanceReport) {
  return report.chart.map(point => ({
    open: point.end - point.start < report.window.resolution,
    label: `${dateTime.format(point.start)} to ${dateTime.format(point.end)} UTC${point.end - point.start < report.window.resolution ? " (open)" : ""}`,
    tick: report.window.period === "7d" ? date.format(point.start) : time.format(point.start),
  }));
}

export function PerformanceControls({ window }: { window: MonitoringWindow }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 id="system-monitoring" className="text-xl font-semibold tracking-tight sm:text-2xl">System monitoring</h2>
        <p className="mt-1 flex flex-wrap gap-x-1 text-xs leading-5 text-muted">
          <Stamped value={window.start} precise /> <span>to</span> <Stamped value={window.end} precise />
        </p>
      </div>
      <nav aria-label="Monitoring period" className="inline-flex rounded-xl border border-border bg-[#FFF9FC] p-1">
        {([["1h", "1H"], ["24h", "24H"], ["7d", "7D"]] as const).map(([period, label]) =>
          <Link key={period} href={`/admin/performance?period=${period}`} prefetch={false}
            aria-label={label === "1H" ? "1 hour" : label === "24H" ? "24 hours" : "7 days"}
            aria-current={window.period === period ? "page" : undefined}
            title={period === "1h" ? "1 hour" : period === "24h" ? "24 hours" : "7 days"}
            className={`grid min-h-11 min-w-14 place-items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold ${focus} ${window.period === period ? "bg-[#FFDBED] text-[#30252D]" : "text-muted hover:bg-pink-soft"}`}>
            {label}
          </Link>)}
      </nav>
    </header>
  );
}

function Kpi({ label, value, children, featured = false, sparkline }: { label: string; value: string; children: ReactNode; featured?: boolean; sparkline: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-xl border border-[#FFDBED] px-3 py-3.5 shadow-none sm:px-5 sm:py-4 ${featured ? "bg-[#FFDBED]" : "bg-[#FFF9FC]"}`}>
      <dt className="text-sm font-semibold">{label}</dt>
      <dd className={`mt-1.5 tracking-tight tabular-nums ${value === "Unavailable" ? "text-base font-semibold text-[#685967] sm:text-lg" : "text-xl font-semibold sm:text-2xl"}`}>{value}</dd>
      <dd className="mt-1 text-xs leading-5 text-muted">{children}</dd>
      <div className="mt-2">{sparkline}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border bg-[#FFFBFD] px-3.5 py-4 text-sm leading-6 text-muted">{children}</p>;
}

function Endpoints({ report }: { report: PerformanceReport }) {
  return (
    <AdminPanel title="Endpoint performance" description="Quiz handlers, ordered by observed request volume. Client errors are tracked separately.">
      {!report.totals.latency.count ? <Empty>{coverageText[report.apiCoverage]}</Empty> :
        <div role="region" tabIndex={0} aria-label="Endpoint performance data" className={`relative overflow-x-auto rounded-lg border border-border ${focus}`}>
          <table className="w-full min-w-[660px] text-left text-xs tabular-nums">
            <caption className="sr-only">Quiz endpoint requests, latency in milliseconds, server errors and last observation</caption>
            <thead className="bg-[#FBF2F6] text-muted"><tr>{columns.map(label =>
              <th key={label} scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{report.endpoints.map(({ route, metrics }) => {
              const size = metrics.latency.count;
              const { p50, p95, p99 } = percentiles(metrics.latency);
              return <tr key={route} className="border-t border-border">
                <th scope="row" className="px-3 py-2.5 font-semibold">{routeLabels[route]}<span className="block pt-0.5 font-normal text-muted">{route}</span></th>
                <td className="px-3">{size ? number.format(size) : "—"}</td>
                {[p50, p95, p99].map((value, index) => <td key={index} className="whitespace-nowrap px-3">{value === null ? <><span aria-hidden>—</span><span className="sr-only">Unavailable</span></> : ms(value)}</td>)}
                <td className="whitespace-nowrap px-3">{size ? `${percentage.format(metrics.serverErrors / size)} (${metrics.serverErrors})` : "—"}</td>
                <td className="whitespace-nowrap px-3"><Stamped value={metrics.lastAt} /></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
    </AdminPanel>
  );
}

export function AdminPerformance({ report }: { report: PerformanceReport }) {
  const { totals, database } = report;
  const { p50, p95, p99 } = percentiles(totals.latency);
  const requests = totals.latency.count;
  const operations = emptyLatency();
  mergeLatency(operations, database.queries);
  mergeLatency(operations, database.writes);
  const intervals = plotIntervals(report);
  const days = report.chart.map(point => new Date(point.start).toISOString());
  const sampleCounts = report.chart.map(point => point.requests.latency.count);
  const dates = report.chart.map(point => point.start);
  const requestTrend = report.chart.map(point => point.requests.latency.count || null);
  const p95Trend = report.chart.map(point => percentiles(point.requests.latency).p95);
  const errorTrend = report.chart.map(point => point.requests.latency.count ? 100 * point.requests.serverErrors / point.requests.latency.count : null);
  const databaseTrend = report.chart.map(point => point.operations.count ? point.operations.sum / point.operations.count : null);
  const trend = [
    { label: "p50", color: colors.median, dash: "1 4", values: report.chart.map(point => percentiles(point.requests.latency).p50) },
    { label: "p95", color: colors.p95, values: report.chart.map(point => percentiles(point.requests.latency).p95) },
    { label: "p99", color: colors.p99, dash: "6 3", values: report.chart.map(point => percentiles(point.requests.latency).p99) },
  ];
  const volume = [
    { label: "Other responses", color: colors.volume, values: report.chart.map(({ requests }) => requests.latency.count ? requests.latency.count - requests.serverErrors - requests.clientErrors : null) },
    { label: "4xx", color: colors.client, values: report.chart.map(({ requests }) => requests.latency.count ? requests.clientErrors : null) },
    { label: "Server errors", color: colors.error, values: report.chart.map(({ requests }) => requests.latency.count ? requests.serverErrors : null) },
  ];
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 min-[1100px]:grid-cols-12">
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-[#FFDBED] px-3.5 py-2.5 text-xs leading-5 text-[#30252D] min-[1100px]:col-span-12">
        <p role={report.apiCoverage === "read-failed" ? "alert" : undefined}><span className="font-semibold">Coverage.</span> {coverageText[report.apiCoverage]}{report.first !== null && <> First bucket <Stamped value={report.first} />.</>}</p>
        <p><span className="font-semibold">Last collected.</span> <Stamped value={report.lastCollected} precise /></p>
      </div>

      <dl aria-label={`Key indicators for the last ${report.window.period}`} className="grid min-w-0 grid-cols-2 gap-3 min-[1100px]:col-span-12 min-[1100px]:grid-cols-4 [&>div]:min-h-[8.5rem]">
        <Kpi label="Requests" value={number.format(requests)} sparkline={<AdminSparkline name="Observed requests" values={requestTrend} timestamps={dates.map(value => new Date(value).toISOString())} unit="count" />}>{count(requests, "observed request")}</Kpi>
        <Kpi label="p95 Latency" value={ms(p95)} featured sparkline={<AdminSparkline name="Handler latency p95" values={p95Trend} timestamps={dates.map(value => new Date(value).toISOString())} unit="milliseconds" />}>{requests ? `${count(requests, "request")} observed. ${requests < 20 ? "At least 20 samples required." : "Handler duration."}` : coverageText[report.apiCoverage]}</Kpi>
        <Kpi label="Server error rate" value={requests ? percentage.format(totals.serverErrors / requests) : "Unavailable"} sparkline={<AdminSparkline name="Server error rate" values={errorTrend} timestamps={dates.map(value => new Date(value).toISOString())} unit="percent" />}>
          {requests ? `${totals.serverErrors} of ${requests} recorded requests. Includes thrown failures.` : "Requires observed quiz API requests."}
        </Kpi>
        <Kpi label="Database average" value={ms(average(operations))} sparkline={<AdminSparkline name="Database average duration" values={databaseTrend} timestamps={dates.map(value => new Date(value).toISOString())} unit="milliseconds" />}>{operations.count ? count(operations.count, "selected database operation") : "No timed query or write observations."}</Kpi>
      </dl>

      <div className={split}>
        <AdminPanel className="min-[1100px]:col-span-8" title="API Response Latency" description={`Observed p50, p95 and p99 in ${report.window.resolution / 60_000}-minute UTC intervals. The current interval may still be filling.`}>
          {requests > 0 ? <>
            <AnalyticsChart title="API latency" days={days} intervals={intervals} kind="lines" series={trend} unit="ms" sampleCounts={sampleCounts}
              empty="No interval has enough observations for a percentile." />
          </> : <Empty>{coverageText[report.apiCoverage]}</Empty>}
        </AdminPanel>
        <AdminPanel className="min-[1100px]:col-span-4" title="Service Status" description="Latest observed signals; recent thresholds use 30 minutes.">
          <ul className="-my-2 divide-y divide-border">{report.status.map(item => { const Icon = stateIcon[item.state]; return <li key={item.component} className="py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1"><h4 className="text-sm font-semibold">{item.component}</h4><span className="inline-flex items-center gap-1.5 text-xs font-semibold"><Icon size={14} aria-hidden="true" />{item.state}</span></div>
            <p className="mt-0.5 text-xs leading-5 text-muted">{item.reason} {item.at && <Stamped value={item.at} />}</p>
          </li>;})}</ul>
        </AdminPanel>
      </div>

      <div className={split}>
        <AdminPanel className="min-[1100px]:col-span-8" title="Request Volume" description={requests ? `${count(requests, "request")} observed; client and server errors remain separate.` : "Observed response outcomes."}>
          {requests > 0 ? <>
            <AnalyticsChart title="Request volume" days={days} intervals={intervals} kind="bars" series={volume} sampleCounts={sampleCounts} empty={coverageText[report.apiCoverage]} />
          </> : <Empty>{coverageText[report.apiCoverage]}</Empty>}
        </AdminPanel>
        <AdminPanel className="min-[1100px]:col-span-4" title="Latency Distribution" description={`${count(totals.latency.count, "handler sample")} in the selected window; histogram bucket boundaries.`}>
          {totals.latency.count ? <AnalyticsChart title="Observed latency distribution" days={totals.latency.bins.map((_, index) => `bucket-${index}`)} categories={totals.latency.bins.map((_, index) => index < latencyBounds.length ? `≤ ${number.format(latencyBounds[index])} ms` : `> ${number.format(latencyBounds.at(-1)!)} ms`)} categoryName="duration bucket" kind="bars" stacked={false} unit="requests" empty="No latency samples." series={[{ label: "Observed handlers", color: colors.p95, values: totals.latency.bins }]} /> : <Empty>{coverageText[report.apiCoverage]}</Empty>}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 border-t border-border pt-2 text-xs">{([["p50", p50, 5], ["p95", p95, 20], ["p99", p99, 100]] as const).map(([label, value, minimum]) => <div key={label} className="flex justify-between gap-1 py-1"><dt>{label}</dt><dd className="tabular-nums">{value === null ? requests < minimum ? `min ${minimum}` : "Unavailable" : ms(value)}</dd></div>)}</dl>
        </AdminPanel>
      </div>

      <div className="min-[1100px]:col-span-12"><Endpoints report={report} /></div>

      <div className={split}>
        <AdminPanel className="min-[1100px]:col-span-7" title="Database Performance" description="Selected MongoDB operation timings; not an independent health check.">
          <dl className="divide-y divide-border">
            {([["Queries", database.queries], ["Writes", database.writes], ["Connection acquisition", database.connections]] as const).map(([label, latency]) =>
              <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                <dt className="font-semibold">{label}</dt><dd className="text-xs leading-5 text-muted tabular-nums">{latency.count ? `${count(latency.count, "sample")} · ${ms(average(latency))} avg · p95 ${ms(percentiles(latency).p95)}` : "No observations"}</dd>
              </div>)}
          </dl>
          {report.databaseAt > 0 && <p className="mt-2 text-xs text-muted">Last timed request <Stamped value={report.databaseAt} />.</p>}
          {operations.count > 0 && <AnalyticsChart title="MongoDB operation duration by type" days={days} intervals={intervals} kind="lines" unit="ms"
            series={[{ label: "Queries", color: colors.p95, values: report.chart.map(point => average(point.queries)) },
              { label: "Writes", color: colors.median, dash: "6 3", values: report.chart.map(point => average(point.writes)) },
              { label: "Connection acquisition", color: colors.p99, dash: "1 4", values: report.chart.map(point => average(point.connections)) }]}
            sampleCounts={report.chart.map(point => point.operations.count)} empty="No operation samples in this period." />}
        </AdminPanel>
        <AdminPanel className="min-[1100px]:col-span-5" title="Reminder Jobs" description="Scheduled execution coverage and recent evidence.">
          <p className="text-xs leading-5 text-muted">{report.expected === null ? "Expected slot coverage is unknown." :
            `${report.completedDue} completed across ${report.expected} due slots since the first observed slot. ${report.missing} without dispatch evidence.`}</p>
          {report.expected !== null && report.expected > 0 && <div className="mt-2 flex items-center gap-2.5">
            <div role="progressbar" aria-label="Reminder due-slot evidence coverage" aria-valuemin={0} aria-valuemax={report.expected}
              aria-valuenow={Math.min(report.completedDue, report.expected)} aria-valuetext={`${report.completedDue} completed of ${report.expected} due slots`}
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#FFDBED]">
              <div className="h-full rounded-full bg-[#F8769C]" style={{ width: `${Math.min(100, report.completedDue / report.expected * 100)}%` }} />
            </div>
            <span className="text-xs tabular-nums">{number.format(report.completedDue)}/{number.format(report.expected)}</span>
          </div>}
          {report.jobs.length === 0 ? <div className="mt-3"><Empty>{report.jobCoverage === "empty" ? "Reminder execution data is not yet available for this period." : coverageText[report.jobCoverage]}</Empty></div> : <>
            <p className="mt-2 text-xs text-muted">Latest {report.jobs.length} of {report.jobCount} recorded executions. {coverageText[report.jobCoverage]}</p>
            <ol className="mt-2 divide-y divide-border border-t border-border">
              {report.jobs.map(({ run, state }) => <li key={run._id} className="py-2.5">
                <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs font-semibold">
                  <span><Stamped value={run.startedAt} /></span>
                  <span className="font-semibold text-[#30252D]">{jobLabels[state]}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {run.scheduledAt ? <>Slot <Stamped value={run.scheduledAt} /></> : "Private execution"}
                  {run.finishedAt && <> · {number.format((+run.finishedAt - +run.startedAt) / 1000)} s</>}
                  {run.completion && "summary" in run.completion && <> · {run.completion.summary.examined} examined · {run.completion.summary.errors} errors<br />
                    {run.completion.summary.created} created · {run.completion.summary.existing} existing · {run.completion.summary.suppressed} suppressed
                    {run.completion.summary.hasMore && " · Work remaining"}</>}
                </p>
              </li>)}
            </ol>
          </>}
        </AdminPanel>
      </div>

      <div className="min-[1100px]:col-span-12"><AdminPanel title="Recent Incidents" description="Evidence from recorded quiz requests and reminder executions in this reporting window.">
        {report.incidents.length ? <ol className="divide-y divide-border">
          {report.incidents.map(item => <li key={`${item.type}-${item.first}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
            <div><p className="text-sm font-semibold">{item.type} <span className="ml-1 text-xs font-semibold text-[#30252D]">{item.severity}</span></p>
              <p className="mt-0.5 text-xs leading-5 text-muted">{item.component} · {item.evidence}</p></div>
            <p className="text-xs leading-5 text-muted"><Stamped value={item.first} />{item.last !== item.first && <> to <Stamped value={item.last} /></>}</p>
          </li>)}
        </ol> : <Empty><span className="font-semibold text-foreground">No verified incidents in the monitored sources.</span> Evidence can be incomplete, and external availability is unavailable.</Empty>}
      </AdminPanel></div>
    </div>
  );
}

export function PerformanceSkeleton({ controls = false }: { controls?: boolean }) {
  return <SkeletonRegion label="Loading system monitoring" className="grid min-w-0 gap-4 min-[1100px]:grid-cols-12">
    {controls && <SkeletonBlock className="h-16 rounded-xl min-[1100px]:col-span-12" />}
    <SkeletonBlock className="h-14 rounded-lg min-[1100px]:col-span-12" />
    <div className="grid grid-cols-2 gap-3 min-[1100px]:col-span-12 min-[1100px]:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-36 rounded-xl border border-border" />)}</div>
    <div className="grid min-w-0 grid-cols-1 gap-4 min-[1100px]:col-span-12 min-[1100px]:grid-cols-12"><SkeletonBlock className="h-64 rounded-2xl min-[1100px]:col-span-8" /><SkeletonBlock className="h-64 rounded-2xl min-[1100px]:col-span-4" /></div>
    <div className="grid min-w-0 grid-cols-1 gap-4 min-[1100px]:col-span-12 min-[1100px]:grid-cols-12"><SkeletonBlock className="h-60 rounded-2xl min-[1100px]:col-span-8" /><SkeletonBlock className="h-60 rounded-2xl min-[1100px]:col-span-4" /></div>
    <SkeletonBlock className="h-64 rounded-2xl min-[1100px]:col-span-12" />
    <div className="grid min-w-0 grid-cols-1 gap-4 min-[1100px]:col-span-12 min-[1100px]:grid-cols-12"><SkeletonBlock className="h-72 rounded-2xl min-[1100px]:col-span-7" /><SkeletonBlock className="h-72 rounded-2xl min-[1100px]:col-span-5" /></div>
    <SkeletonBlock className="h-48 rounded-2xl min-[1100px]:col-span-12" />
  </SkeletonRegion>;
}
