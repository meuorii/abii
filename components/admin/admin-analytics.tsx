import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AdminEmptyState } from "@/components/admin/admin-ui";
import { AnalyticsChart } from "./analytics-chart";
import { AdminDonut, AdminSparkline, type SparklineUnit } from "./admin-echart";
import { AdminRetentionTable } from "./admin-retention-table";
import {
  type AnalyticsReport, type Comparison, type Fraction, type MetricResult, type ReviewTotals, type Trend,
  countChange, quizModes, rate, retentionHorizon,
} from "@/lib/admin/analytics-contract";
import { dayMs, reportingPeriods, type ReportingWindow } from "@/lib/admin/reporting";

const number = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", hour12: false });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B3054]";
const berry = "#F8769C";
const navy = "#F8769C";
const teal = "#F8769C";
const muted = "#FFDBED";
const percent = (value: number | null) => value === null ? "—" : `${decimal.format(value)}%`;
const periodRange = (window: ReportingWindow) => dayFormat.formatRange(window.start, new Date(+window.end - dayMs));
const unwrap = <T,>(result: MetricResult<T>) => result.status === "unavailable" ? null : result.value;

function signed(value: number, unit: string) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${decimal.format(rounded || 0)}${unit}`;
}

function countComparison(value: Comparison<number>) {
  const change = countChange(value);
  return change === null ? (value.current === 0 ? "Prior period also 0" : "Prior period 0") : `${signed(change, "%")} from prior ${number.format(value.previous)}`;
}

function rateComparison(value: Comparison<Fraction>) {
  const current = rate(value.current);
  const previous = rate(value.previous);
  if (current === null) return "No eligible data";
  if (previous === null) return "No prior rate";
  return `${signed(current - previous, " pp")} from prior ${percent(previous)}`;
}

function Metric({ label, value, comparison, featured = false, sparkline, unit = "count" }: { label: string; value: string | null; comparison: string; featured?: boolean; sparkline?: { day: string; count: number | null }[] | null; unit?: SparklineUnit }) {
  return <div className={`min-h-[136px] min-w-0 rounded-xl border border-[#FFDBED] p-3.5 shadow-none sm:px-5 sm:py-4 ${featured ? "bg-[#FFDBED]" : "bg-white"}`}>
    <dt className="text-xs font-semibold text-[#574650] sm:text-sm">{label}</dt>
    <dd>
      <p className="mt-1 text-[1.7rem] leading-none font-bold tracking-[-0.03em] tabular-nums sm:text-[2rem]">{value ?? <span aria-label="Unavailable">—</span>}</p>
      <div className="mt-2 flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2"><p className="min-w-0 max-w-full break-words text-xs leading-5 text-muted">{comparison}</p>{sparkline?.length ? <div className="w-20 shrink-0"><AdminSparkline name={`${label} daily trend`} timestamps={sparkline.map(point => point.day)} values={sparkline.map(point => point.count)} unit={unit} /></div> : null}</div>
    </dd>
  </div>;
}

function Panel({ id, title, description, alignChart = false, className = "", children }: {
  id: string; title: string; description: string; alignChart?: boolean; className?: string; children: ReactNode;
}) {
  return <Card padding="none" className={`flex min-h-0 min-w-0 flex-col p-4 shadow-none sm:p-5 ${className}`}>
    <section aria-labelledby={id} className="flex min-h-0 flex-1 flex-col">
      <h3 id={id} className="text-lg font-bold tracking-tight">{title}</h3>
      <p className={`mt-0.5 max-w-[68ch] text-sm leading-5 text-muted ${alignChart ? "min-[980px]:min-h-10" : ""}`}>{description}</p>
      {children}
    </section>
  </Card>;
}

function Unavailable({ result }: { result: MetricResult<unknown> }) {
  if (result.status !== "unavailable") return null;
  return <div className="mt-4 flex min-h-[220px] flex-1 flex-col sm:min-h-[240px]"><AdminEmptyState icon="alert" title="Data unavailable" description={result.reason} size="visualization" /></div>;
}

function TrendBody({ title, label, trend, kind, color, empty }: {
  title: string; label: string; trend: Trend; kind: "area" | "bars"; color: string; empty: string;
}) {
  return <>
    <div className="mt-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <strong className="text-2xl leading-tight font-bold tabular-nums">{number.format(trend.current)}</strong>
      <p className="text-xs font-medium text-muted">{countComparison(trend)}</p>
    </div>
    <AnalyticsChart title={title} days={trend.daily.map(point => point.day)} kind={kind}
      series={[{ label, color, values: trend.daily.map(point => point.count) }]} empty={empty} />
  </>;
}

const accuracy = (totals: ReviewTotals): Fraction => ({ counted: totals.correct, eligible: totals.correct + totals.wrong });

export function AnalyticsControls({ window, previous }: { window: ReportingWindow; previous: ReportingWindow }) {
  return <header className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 id="platform-insights" className="text-xl font-bold tracking-tight">Platform insights</h2>
      <p className="mt-1 text-sm leading-5 text-muted"><span className="font-semibold text-foreground">{periodRange(window)} UTC</span></p>
      <p className="text-xs leading-5 text-muted">Compared with {periodRange(previous)} UTC</p>
    </div>
    <nav aria-label="Reporting period" className="inline-flex max-w-full rounded-xl border border-border bg-[#FFF9FC] p-1">
      {reportingPeriods.map(days => <Link key={days} href={`/admin/analytics?period=${days}`} prefetch={false} scroll={false}
        aria-label={`${days} days`} aria-current={days === window.days ? "page" : undefined} className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold sm:px-4 sm:text-sm ${focus} ${days === window.days
          ? "bg-[#FFDBED] text-[#30252D]" : "text-muted hover:bg-white hover:text-foreground"}`}>{days}D</Link>)}
    </nav>
  </header>;
}

export function AdminAnalytics({ report }: { report: AnalyticsReport }) {
  const growth = unwrap(report.growth);
  const active = unwrap(report.active);
  const activation = unwrap(report.activation);
  const retention = unwrap(report.retention);
  const reviews = unwrap(report.reviews);
  const quizzes = unwrap(report.quizzes);
  const subjects = unwrap(report.subjects);
  const flashcards = unwrap(report.flashcards);
  const reviewCounts = reviews && { current: reviews.current.attempts, previous: reviews.previous.attempts };
  const tracks = [{ key: "correct", label: "Correct", color: teal }, { key: "wrong", label: "Incorrect", color: berry },
    ...(reviews?.current.ungraded ? [{ key: "ungraded", label: "Unknown outcome", color: muted } as const] : [])] as const;
  const verification = activation && rate(activation.current);
  const quizTotal = quizzes ? Object.values(quizzes.modes).reduce((sum, count) => sum + count, 0) : 0;
  const cohorts = retention?.cohorts.filter(cohort => cohort.size > 0) ?? [];
  const hasUnavailable = [report.growth, report.active, report.activation, report.retention, report.reviews,
    report.quizzes, report.subjects, report.flashcards].some(metric => metric.status === "unavailable");

  return <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 min-[1100px]:grid-cols-12">
    <div className="min-w-0 min-[1100px]:col-span-12">
      <dl className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
        <Metric label="New users" value={growth && number.format(growth.current)} comparison={growth ? countComparison(growth) : "Unavailable"} featured sparkline={growth?.daily ?? null} />
        <Metric label="Active learners" value={active && number.format(active.current)} comparison={active ? countComparison(active) : "Unavailable"} sparkline={active?.daily ?? null} />
        <Metric label="Review attempts" value={reviewCounts && number.format(reviewCounts.current)} comparison={reviewCounts ? countComparison(reviewCounts) : "Unavailable"} sparkline={reviews?.daily.map(({ day, attempts }) => ({ day, count: attempts })) ?? null} />
        <Metric label="Review accuracy" value={reviews ? percent(rate(accuracy(reviews.current))) : null} comparison={reviews ? rateComparison({ current: accuracy(reviews.current), previous: accuracy(reviews.previous) }) : "Unavailable"} sparkline={reviews?.daily.map(point => ({ day: point.day, count: point.correct + point.wrong ? point.correct / (point.correct + point.wrong) * 100 : null })) ?? null} unit="percent" />
      </dl>
      {hasUnavailable && <p role="status" className="mt-3 rounded-lg bg-pink-soft px-3 py-2 text-sm text-[#694453]">
        Some metrics could not be loaded. <a className="rounded font-semibold underline underline-offset-2" href={`/admin/analytics?period=${report.window.days}`}>Reload report</a>
      </p>}
    </div>

    <section aria-labelledby="analytics-growth-section" className="order-1 grid min-w-0 gap-3 min-[1100px]:col-span-8">
      <h2 id="analytics-growth-section" className="sr-only">Growth & Engagement</h2>
      <Panel id="analytics-growth" title="Growth & Engagement" description="Daily registrations and distinct active learners. The two series are not additive.">
        {growth && active ? <>
          <AnalyticsChart title="Growth and engagement" days={growth.daily.map(point => point.day)} kind="lines" empty="No learner activity or retained registrations in this period." series={[
            { label: "Active learners", color: berry, area: true, values: active.daily.map(point => point.count) },
            { label: "New users", color: berry, dash: "6 4", values: growth.daily.map(point => point.count) },
          ]} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span>{number.format(growth.current)} registrations · {countComparison(growth)}</span><span>{number.format(active.current)} period distinct active learners · {countComparison(active)}</span></div>
        </> : <>{!growth && <Unavailable result={report.growth} />}{!active && <Unavailable result={report.active} />}</>}
      </Panel>
    </section>

    <section aria-labelledby="analytics-lifecycle" className="contents">
      <h2 id="analytics-lifecycle" className="sr-only">Account lifecycle</h2>
      <div className="contents">
        <Panel id="analytics-activation" title="Email Activation" description="Verified within 24 hours of signup." className="order-2 min-[1100px]:col-span-4">
          {activation ? <div className="mt-4">
            <p className="text-3xl leading-none font-bold tabular-nums">{percent(verification)}</p>
            <p className="mt-1.5 text-xs text-muted">{rateComparison(activation)}</p>
            {verification !== null ? <div className="mt-3 flex items-center gap-3"><div className="relative"><AdminDonut value={activation.current.counted} total={activation.current.eligible} label={`${percent(verification)} verified email within 24 hours; ${activation.current.counted} of ${activation.current.eligible} eligible registrations`} /><span aria-hidden="true" className="pointer-events-none absolute inset-0 grid size-32 place-items-center text-sm font-bold tabular-nums">{percent(verification)}</span></div><p className="text-xs text-muted">{number.format(activation.current.counted)} of {number.format(activation.current.eligible)} eligible signups<br />activated within 24 hours</p></div> : <p className="mt-3 text-sm text-muted">No signups had 24 hours to verify.</p>}
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div><dt className="text-xs text-muted">Verified in 24 hours</dt><dd className="mt-1 font-bold tabular-nums">{number.format(activation.current.counted)}</dd></div>
              <div><dt className="text-xs text-muted">Eligible signups</dt><dd className="mt-1 font-bold tabular-nums">{number.format(activation.current.eligible)}</dd></div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-muted">Verification measures email confirmation. First-study activation needs separate instrumentation.</p>
          </div> : <Unavailable result={report.activation} />}
        </Panel>
        <Panel id="analytics-retention" title="Learning Retention" description="Cohort analysis · exact-day learning returns, measured by UTC date." className="order-5 min-[1100px]:col-span-12">
          {retention ? <>
            <dl className="mt-3.5 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-[#FFF9FC]">
              {retentionHorizon.map(horizon => <div key={horizon} className="min-w-0 px-2 py-2.5 sm:px-3">
                <dt className="text-xs font-semibold text-muted">Day {horizon}</dt>
                <dd><p className="mt-1 text-lg font-bold tabular-nums">{percent(rate(retention.current[horizon]))}</p>
                  <p className="mt-1 text-xs leading-4 text-muted">{rateComparison({ current: retention.current[horizon], previous: retention.previous[horizon] })}</p>
                </dd>
              </div>)}
            </dl>
            {cohorts.length ? <AdminRetentionTable key={`${report.window.days}-${report.window.start.toISOString()}`} cohorts={cohorts}
              cohortDateLabels={cohorts.map(cohort => shortDate.formatRange(new Date(cohort.start), new Date(cohort.end)))} /> : <p className="mt-3 text-sm text-muted">No signup cohorts in this period.</p>}
            <p className="mt-3 text-xs leading-5 text-muted">Cells show returns / eligible signups. A dash marks a return day that had yet to end. Overall rates pool mature observations. Erased or unrecorded activity is absent.</p>
          </> : <Unavailable result={report.retention} />}
        </Panel>
      </div>
    </section>

    <section aria-labelledby="analytics-behavior" className="contents">
      <h2 id="analytics-behavior" className="sr-only">Learning behavior</h2>
      <div className="contents">
        <Panel id="analytics-review" title="Review Activity" description="Recorded review outcomes by day." className="order-3 min-[1100px]:col-span-8">
          {reviews && reviewCounts ? <>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong className="text-2xl font-bold tabular-nums">{number.format(reviews.current.attempts)}</strong>
              <p className="text-xs text-muted">{countComparison(reviewCounts)}</p>
            </div>
            <p className="mt-1 text-xs text-muted"><strong className="text-foreground">{percent(rate(accuracy(reviews.current)))} accuracy</strong>
              {" · "}{rateComparison({ current: accuracy(reviews.current), previous: accuracy(reviews.previous) })}</p>
            <AnalyticsChart title="Review activity" days={reviews.daily.map(point => point.day)} kind="bars" stacked empty="No reviews were recorded in this period."
              series={tracks.map(track => ({ label: track.label, color: track.color, values: reviews.daily.map(point => point[track.key]) }))} />
          </> : <Unavailable result={report.reviews} />}
        </Panel>
        <Panel id="analytics-quizzes" title="Quiz Preferences" description="Available completed-session sample." className="order-4 min-[1100px]:col-span-4">
          {quizzes ? <>
            <div className="mt-3 rounded-lg bg-[#FFF9FC] px-3 py-2 text-xs leading-5 text-[#66565F]">
              <p className="font-bold">Partial coverage</p>
              <p>{report.quizzes.status === "partial" && report.quizzes.coverage}</p>
            </div>
            {quizzes.first && quizzes.last && <p className="mt-3 text-xs leading-5 text-muted">Observed {timeFormat.format(new Date(quizzes.first))}
              {quizzes.first !== quizzes.last && ` to ${timeFormat.format(new Date(quizzes.last))}`} UTC</p>}
            {quizTotal ? <><p className="mt-3 text-xs text-muted">{number.format(quizTotal)} sessions with known mode</p><AnalyticsChart title="Quiz preferences" days={quizModes.map(mode => mode.id)} categories={quizModes.map(mode => mode.label)} horizontal stacked={false} kind="bars" unit="sessions" empty="No completed sessions with a known mode survived in this period." series={[{ label: "Completed sessions", color: berry, values: quizModes.map(mode => quizzes.modes[mode.id]) }]} /><dl className="grid grid-cols-2 gap-x-4 border-t border-border pt-2 text-xs">{quizModes.map(mode => <div key={mode.id} className="flex justify-between gap-1 py-1"><dt>{mode.label}</dt><dd className="tabular-nums">{number.format(quizzes.modes[mode.id])} · {percent(rate({ counted: quizzes.modes[mode.id], eligible: quizTotal }))}</dd></div>)}</dl></> : <p className="mt-3 text-sm text-muted">No completed sessions with a known mode survived in this period.</p>}
            {quizzes.unknown > 0 && <p className="mt-3 text-xs text-muted">{number.format(quizzes.unknown)} with unknown mode, excluded from shares.</p>}
          </> : <Unavailable result={report.quizzes} />}
        </Panel>
      </div>
    </section>

    <section aria-label="Content creation" className="contents">
      <h2 className="sr-only">Content creation</h2>
      <Panel id="analytics-subjects" title="Subjects Created" description="Retained subject records created per UTC day; deleted records are absent." className="order-6 min-[1100px]:col-span-6">
        {subjects ? <TrendBody title="Subjects created" label="Subjects" trend={subjects} kind="bars" color={navy} empty="No surviving subjects were created in this period." /> : <Unavailable result={report.subjects} />}
      </Panel>
      <Panel id="analytics-flashcards" title="Flashcards Created" description="Retained flashcard records created per UTC day; deleted records are absent." className="order-7 min-[1100px]:col-span-6">
        {flashcards ? <TrendBody title="Flashcards created" label="Flashcards" trend={flashcards} kind="bars" color={berry} empty="No surviving flashcards were created in this period." /> : <Unavailable result={report.flashcards} />}
      </Panel>
    </section>

    <footer className="order-8 space-y-1 border-t border-border pt-3 text-xs leading-5 text-muted min-[1100px]:col-span-12">
      <p>Reports use complete UTC days and exclude the administrator and marked demo accounts. Historical totals reflect records still held by Abii.</p>
      <p>Read at {timeFormat.format(new Date(report.measuredAt))} UTC</p>
    </footer>
  </div>;
}
