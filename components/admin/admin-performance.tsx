import Link from "next/link";
import type { ReactNode } from "react";
import { AnalyticsChart } from "@/components/admin/analytics-chart";
import { AdminPanel } from "@/components/admin/admin-ui";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import type { PerformanceReport } from "@/lib/admin/performance";
import { emptyLatency, mergeLatency, percentiles, routeLabels, type HealthState, type Latency, type MonitoringWindow } from "@/lib/performance/monitoring";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const preciseDate = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const date = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", timeZone: "UTC" });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#993557]";
const split = "grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]";
const columns = ["Endpoint", "Requests", "p50", "p95", "p99", "Server errors", "Last seen"];
const coverageText = {
  observed: "Recorded observations. Delivery gaps are possible.",
  empty: "No telemetry collected for this period.",
  disabled: "Telemetry collection is disabled.",
  "read-failed": "Monitoring storage could not be read.",
  limited: "The read limit was reached. Only the newest complete sets of stored fragments are included.",
};
const stateStyle: Record<HealthState, string> = {
  Healthy: "text-[#32654E] before:bg-[#52866D]",
  Degraded: "text-[#86511E] before:bg-[#A96C33]",
  Unavailable: "text-[#685967] before:bg-[#8C7888]",
  Unknown: "text-[#685967] before:border before:border-[#8C7888]",
  Stale: "text-[#86511E] before:border before:border-[#A96C33]",
};
const jobLabels = {
  completed: "Completed", partial: "Partial", partial_batch: "Partial batch", lease_busy: "Lease busy",
  started: "Start observed", overdue: "Overdue evidence", failed: "Failed",
} as const;
const colors = { median: "#51748A", p95: "#A83963", p99: "#695087", volume: "#D9ADC0", error: "#A83963", client: "#917B9D" };

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
      <nav aria-label="Monitoring period" className="inline-flex rounded-xl border border-border bg-white p-1">
        {([["1h", "1 hour"], ["24h", "24 hours"], ["7d", "7 days"]] as const).map(([period, label]) =>
          <Link key={period} href={`/admin/performance?period=${period}`} prefetch={false}
            aria-current={window.period === period ? "page" : undefined}
            className={`grid min-h-11 min-w-14 place-items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold ${focus} ${window.period === period ? "bg-[#F9E4ED] text-[#83314F]" : "text-muted hover:bg-pink-soft"}`}>
            {label}
          </Link>)}
      </nav>
    </header>
  );
}

function Kpi({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-white px-3 py-3.5 sm:px-5 sm:py-4">
      <dt className="text-sm font-semibold">{label}</dt>
      <dd className={`mt-1.5 tracking-tight tabular-nums ${value === "Unavailable" ? "text-base font-semibold text-[#685967] sm:text-lg" : "text-xl font-semibold sm:text-2xl"}`}>{value}</dd>
      <dd className="mt-1 text-xs leading-5 text-muted">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border bg-[#FFFBFD] px-3.5 py-4 text-sm leading-6 text-muted">{children}</p>;
}

function Legend({ items }: { items: { label: string; color: string; dash?: string }[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">{items.map(item =>
    <li key={item.label} className="inline-flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-2" style={{ borderColor: item.color, borderTopStyle: item.dash?.startsWith("1 ") ? "dotted" : item.dash ? "dashed" : "solid" }} />{item.label}</li>)}</ul>;
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
  const { totals, database, availability } = report;
  const { p50, p95, p99 } = percentiles(totals.latency);
  const requests = totals.latency.count;
  const operations = emptyLatency();
  mergeLatency(operations, database.queries);
  mergeLatency(operations, database.writes);
  const intervals = plotIntervals(report);
  const days = report.chart.map(point => new Date(point.start).toISOString());
  const sampleCounts = report.chart.map(point => point.requests.latency.count);
  const trend = [
    { label: "p50", color: colors.median, values: report.chart.map(point => percentiles(point.requests.latency).p50) },
    { label: "p95", color: colors.p95, dash: "5 3", values: report.chart.map(point => percentiles(point.requests.latency).p95) },
    { label: "p99", color: colors.p99, dash: "1 4", values: report.chart.map(point => percentiles(point.requests.latency).p99) },
  ];
  const volume = [
    { label: "Other responses", color: colors.volume, values: report.chart.map(({ requests }) => requests.latency.count ? requests.latency.count - requests.serverErrors - requests.clientErrors : null) },
    { label: "4xx", color: colors.client, values: report.chart.map(({ requests }) => requests.latency.count ? requests.clientErrors : null) },
    { label: "Server errors", color: colors.error, values: report.chart.map(({ requests }) => requests.latency.count ? requests.serverErrors : null) },
  ];
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-[#FCF1F6] px-3.5 py-2.5 text-xs leading-5 text-[#5E4E5A]">
        <p role={report.apiCoverage === "read-failed" ? "alert" : undefined}><span className="font-semibold">Coverage.</span> {coverageText[report.apiCoverage]}{report.first !== null && <> First bucket <Stamped value={report.first} />.</>}</p>
        <p><span className="font-semibold">Last collected.</span> <Stamped value={report.lastCollected} precise /></p>
      </div>

      <dl aria-label={`Key indicators for the last ${report.window.period}`} className="grid min-w-0 gap-px overflow-hidden rounded-2xl border border-border bg-border grid-cols-2 xl:grid-cols-4">
        <Kpi label="Availability" value="Unavailable">{availability.reason}</Kpi>
        <Kpi label="API latency · p95" value={ms(p95)}>{requests ? `${count(requests, "request")} in the selected period. ${requests < 20 ? "At least 20 samples required." : "Server handler duration."}` : coverageText[report.apiCoverage]}</Kpi>
        <Kpi label="Server error rate" value={requests ? percentage.format(totals.serverErrors / requests) : "Unavailable"}>
          {requests ? `${totals.serverErrors} of ${requests} recorded requests. Includes thrown failures.` : "Requires observed quiz API requests."}
        </Kpi>
        <Kpi label="MongoDB latency · average" value={ms(average(operations))}>{operations.count ? count(operations.count, "selected database operation") : "No timed query or write observations."}</Kpi>
      </dl>

      <div className={split}>
        <AdminPanel title="API latency trend" description={`Quiz request percentiles in ${report.window.resolution / 60_000}-minute UTC intervals. The current interval may still be filling.`}>
          {requests > 0 ? <>
            <Legend items={trend} />
            <AnalyticsChart title="API latency" days={days} intervals={intervals} kind="lines" series={trend} unit="ms" sampleCounts={sampleCounts}
              empty="No interval has enough observations for a percentile." />
          </> : <Empty>{coverageText[report.apiCoverage]}</Empty>}
        </AdminPanel>
        <AdminPanel title="Latency distribution" description="All recorded quiz handlers in the selected window.">
          <dl className="grid divide-y divide-border text-sm">
            {([["Average", average(totals.latency), 1], ["p50", p50, 5], ["p95", p95, 20], ["p99", p99, 100]] as const).map(([label, value, minimum]) =>
              <div key={label} className="flex items-center justify-between gap-2 py-2.5">
                <dt className="font-semibold">{label}</dt><dd className="text-right tabular-nums">{value !== null ? ms(value) : <span className="text-xs text-muted">{requests < minimum ? `Requires ${count(minimum, "sample")}` : "Above histogram range"}</span>}</dd>
              </div>)}
          </dl>
          <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted">Percentiles show bucket upper bounds up to 60 seconds. Handler timing ends when the response is generated.</p>
        </AdminPanel>
      </div>

      <div className={split}>
        <AdminPanel title="Request volume and errors" description={requests ? `${count(requests, "request")} recorded. ${count(totals.clientErrors, "client error")} and ${count(totals.serverErrors, "server error")}.` : "Completed quiz handlers and thrown failures."}>
          {requests > 0 ? <>
            <Legend items={volume} />
            <AnalyticsChart title="Request volume" days={days} intervals={intervals} kind="bars" series={volume} sampleCounts={sampleCounts} empty={coverageText[report.apiCoverage]} />
          </> : <Empty>{coverageText[report.apiCoverage]}</Empty>}
        </AdminPanel>
        <AdminPanel title="Service status" description="Latest evidence within the selected period. Recent signals use a 30-minute threshold.">
          <ul className="-my-2 divide-y divide-border">
            {report.status.map(item => <li key={item.component} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <h4 className="text-sm font-semibold">{item.component}</h4>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold before:size-1.5 before:rounded-full ${stateStyle[item.state]}`}>{item.state}</span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-muted">{item.reason} {item.at && <Stamped value={item.at} />}</p>
            </li>)}
          </ul>
        </AdminPanel>
      </div>

      <Endpoints report={report} />

      <div className={split}>
        <AdminPanel title="Database performance" description="Selected MongoDB operations timed by the quiz handlers.">
          <dl className="divide-y divide-border">
            {([["Queries", database.queries], ["Writes", database.writes], ["Connection acquisition", database.connections]] as const).map(([label, latency]) =>
              <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                <dt className="font-semibold">{label}</dt><dd className="text-xs leading-5 text-muted tabular-nums">{latency.count ? `${count(latency.count, "sample")} · ${ms(average(latency))} avg · p95 ${ms(percentiles(latency).p95)}` : "No observations"}</dd>
              </div>)}
          </dl>
          {report.databaseAt > 0 && <p className="mt-2 text-xs text-muted">Last timed request <Stamped value={report.databaseAt} />.</p>}
          {operations.count > 0 && <AnalyticsChart title="MongoDB average operation duration" days={days} intervals={intervals} kind="lines" unit="ms"
            series={[{ label: "Average query and write duration", color: colors.median, values: report.chart.map(point => average(point.operations)) }]}
            sampleCounts={report.chart.map(point => point.operations.count)} empty="No operation samples in this period." />}
        </AdminPanel>
        <AdminPanel title="Reminder jobs" description="Authenticated Vercel schedule and private execution evidence. Scheduled slots use a 20-minute grace period.">
          <p className="text-xs leading-5 text-muted">{report.expected === null ? "Expected slot coverage is unknown." :
            `${report.completedDue} completed across ${report.expected} due slots since the first observed slot. ${report.missing} without dispatch evidence.`}</p>
          {report.jobs.length === 0 ? <div className="mt-3"><Empty>{report.jobCoverage === "empty" ? "Reminder execution data is not yet available for this period." : coverageText[report.jobCoverage]}</Empty></div> : <>
            <p className="mt-2 text-xs text-muted">Latest {report.jobs.length} of {report.jobCount} recorded executions. {coverageText[report.jobCoverage]}</p>
            <ol className="mt-2 divide-y divide-border border-t border-border">
              {report.jobs.map(({ run, state }) => <li key={run._id} className="py-2.5">
                <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs font-semibold">
                  <span><Stamped value={run.startedAt} /></span>
                  <span className={state === "failed" ? "text-[#9C304E]" : state === "completed" ? "text-[#32654E]" : state === "partial" || state === "overdue" || state === "partial_batch" ? "text-[#86511E]" : "text-muted"}>{jobLabels[state]}</span>
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

      <AdminPanel title="Recent incidents" description="Evidence from recorded quiz requests and reminder executions in this reporting window.">
        {report.incidents.length ? <ol className="divide-y divide-border">
          {report.incidents.map(item => <li key={`${item.type}-${item.first}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
            <div><p className="text-sm font-semibold">{item.type} <span className={`ml-1 text-xs ${item.severity === "High" ? "text-[#9C304E]" : "text-[#86511E]"}`}>{item.severity}</span></p>
              <p className="mt-0.5 text-xs leading-5 text-muted">{item.component} · {item.evidence}</p></div>
            <p className="text-xs leading-5 text-muted"><Stamped value={item.first} />{item.last !== item.first && <> to <Stamped value={item.last} /></>}</p>
          </li>)}
        </ol> : <Empty><span className="font-semibold text-foreground">No verified incidents in the monitored sources.</span> Evidence can be incomplete, and external availability is unavailable.</Empty>}
      </AdminPanel>
    </div>
  );
}

export function PerformanceSkeleton({ controls = false }: { controls?: boolean }) {
  return <SkeletonRegion label="Loading system monitoring" className="grid min-w-0 gap-4">
    {controls && <SkeletonBlock className="h-16 rounded-xl" />}
    <SkeletonBlock className="h-10 rounded-lg" />
    <div className="grid gap-1 grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-32 rounded-xl" />)}</div>
    {[0, 1, 2, 3, 4].map((index) => index === 2 || index === 4 ? <SkeletonBlock key={index} className="h-36 rounded-2xl" /> :
      <div key={index} className={split}><SkeletonBlock className="h-52 rounded-2xl" /><SkeletonBlock className="h-48 rounded-2xl" /></div>)}
  </SkeletonRegion>;
}
