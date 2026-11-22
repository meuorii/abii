import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AnalyticsChart } from "./analytics-chart";
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
const berry = "#B44368";
const navy = "#446D83";
const teal = "#458272";
const muted = "#9A7B8B";
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

function Metric({ label, value, comparison }: { label: string; value: string | null; comparison: string }) {
  return <div className="min-w-0 p-3.5 sm:px-5 sm:py-4">
    <dt className="text-xs font-semibold text-[#574650] sm:text-sm">{label}</dt>
    <dd>
      <p className="mt-1 text-[1.7rem] leading-none font-bold tracking-[-0.03em] tabular-nums sm:text-[2rem]">{value ?? <span aria-label="Unavailable">—</span>}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{comparison}</p>
    </dd>
  </div>;
}

function Panel({ id, title, description, alignChart = false, children }: {
  id: string; title: string; description: string; alignChart?: boolean; children: ReactNode;
}) {
  return <Card padding="none" className="min-w-0 p-4 shadow-none sm:p-5">
    <section aria-labelledby={id}>
      <h3 id={id} className="text-lg font-bold tracking-tight">{title}</h3>
      <p className={`mt-0.5 max-w-[68ch] text-sm leading-5 text-muted ${alignChart ? "min-[980px]:min-h-10" : ""}`}>{description}</p>
      {children}
    </section>
  </Card>;
}

function Unavailable({ result }: { result: MetricResult<unknown> }) {
  if (result.status !== "unavailable") return null;
  return <p className="mt-4 rounded-lg bg-pink-soft px-3.5 py-3 text-sm leading-5 text-[#694453]">{result.reason}</p>;
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

function RetentionCell({ value }: { value: Fraction }) {
  const measured = rate(value);
  const tone = measured === null ? "bg-[#FAF8F9] text-muted" : measured >= 66 ? "bg-[#F3CDDB] text-[#66384A]" :
    measured >= 33 ? "bg-[#FAE3EC] text-[#66384A]" : measured > 0 ? "bg-[#FFF1F6] text-[#66384A]" : "bg-[#FAF8F9] text-[#574650]";
  return <div className={`rounded-md px-1 py-1.5 leading-4 tabular-nums [overflow-wrap:anywhere] sm:px-2 ${tone}`}>
    {measured === null ? <span className="text-xs" aria-label="Return day has yet to end">—</span> : <>
      <span className="block font-bold">{percent(measured)}</span>
      <span className="block text-[11px]">{number.format(value.counted)}/{number.format(value.eligible)}</span>
    </>}
  </div>;
}

const accuracy = (totals: ReviewTotals): Fraction => ({ counted: totals.correct, eligible: totals.correct + totals.wrong });

export function AnalyticsControls({ window, previous }: { window: ReportingWindow; previous: ReportingWindow }) {
  return <header className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 id="platform-insights" className="text-xl font-bold tracking-tight">Platform insights</h2>
      <p className="mt-1 text-sm leading-5 text-muted"><span className="font-semibold text-foreground">{periodRange(window)} UTC</span></p>
      <p className="text-xs leading-5 text-muted">Compared with {periodRange(previous)} UTC</p>
    </div>
    <nav aria-label="Reporting period" className="inline-flex max-w-full rounded-xl border border-border bg-[#FBF8FA] p-1">
      {reportingPeriods.map(days => <Link key={days} href={`/admin/analytics?period=${days}`} prefetch={false} scroll={false}
        aria-current={days === window.days ? "page" : undefined} className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold sm:px-4 sm:text-sm ${focus} ${days === window.days
          ? "bg-[#FFE6EF] text-[#853750]" : "text-muted hover:bg-white hover:text-foreground"}`}>{days} days</Link>)}
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

  return <div className="grid min-w-0 gap-6 sm:gap-7">
    <div>
      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-white [&>div:nth-child(even)]:border-l [&>div:nth-child(n+3)]:border-t [&>div]:border-border lg:grid-cols-4 lg:[&>div:nth-child(3)]:border-l lg:[&>div:nth-child(n+3)]:border-t-0">
        <Metric label="New users" value={growth && number.format(growth.current)} comparison={growth ? countComparison(growth) : "Unavailable"} />
        <Metric label="Active learners" value={active && number.format(active.current)} comparison={active ? countComparison(active) : "Unavailable"} />
        <Metric label="24-hour verification" value={activation && percent(verification)} comparison={activation ? rateComparison(activation) : "Unavailable"} />
        <Metric label="Review attempts" value={reviewCounts && number.format(reviewCounts.current)} comparison={reviewCounts ? countComparison(reviewCounts) : "Unavailable"} />
      </dl>
      {hasUnavailable && <p role="status" className="mt-3 rounded-lg bg-pink-soft px-3 py-2 text-sm text-[#694453]">
        Some metrics could not be loaded. <a className="rounded font-semibold underline underline-offset-2" href={`/admin/analytics?period=${report.window.days}`}>Reload report</a>
      </p>}
    </div>

    <section aria-labelledby="analytics-growth" className="grid min-w-0 gap-3">
      <h2 id="analytics-growth" className="text-base font-bold tracking-tight">Growth and engagement</h2>
      <div className="grid min-w-0 gap-3 min-[980px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel id="analytics-signups" title="User growth" alignChart description="Daily registrations among accounts still on Abii. Deleted registrations are absent.">
          {growth ? <TrendBody title="User growth" label="Registrations" trend={growth} kind="area" color={berry} empty="No retained accounts were created in this period." /> : <Unavailable result={report.growth} />}
        </Panel>
        <Panel id="analytics-active" title="Active learners" alignChart description="Distinct reviewers per day and across the full period.">
          {active ? <TrendBody title="Active learners" label="Learners" trend={active} kind="bars" color={navy} empty="No learners recorded a review in this period." /> : <Unavailable result={report.active} />}
        </Panel>
      </div>
    </section>

    <section aria-labelledby="analytics-lifecycle" className="grid min-w-0 gap-3">
      <h2 id="analytics-lifecycle" className="text-base font-bold tracking-tight">Account lifecycle</h2>
      <div className="grid min-w-0 gap-3 min-[980px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel id="analytics-activation" title="Account activation" description="Email verification within 24 hours of signup. Both periods include only registrations that had the full 24 hours by period end.">
          {activation ? <div className="mt-4">
            <p className="text-3xl leading-none font-bold tabular-nums">{percent(verification)}</p>
            <p className="mt-1.5 text-xs text-muted">{rateComparison(activation)}</p>
            {verification !== null ? <div aria-hidden="true" className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#F4EAF0]">
              <div className="h-full rounded-full bg-[#B44368]" style={{ width: `${verification}%` }} />
            </div> : <p className="mt-3 text-sm text-muted">No signups had 24 hours to verify.</p>}
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div><dt className="text-xs text-muted">Verified in 24 hours</dt><dd className="mt-1 font-bold tabular-nums">{number.format(activation.current.counted)}</dd></div>
              <div><dt className="text-xs text-muted">Eligible signups</dt><dd className="mt-1 font-bold tabular-nums">{number.format(activation.current.eligible)}</dd></div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-muted">Verification measures email confirmation. First-study activation needs separate instrumentation.</p>
          </div> : <Unavailable result={report.activation} />}
        </Panel>
        <Panel id="analytics-retention" title="Learning retention" description="A learner returns when they record a review on day 1, 7, or 30 after signup, by UTC date.">
          {retention ? <>
            <dl className="mt-3.5 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-[#FFFAFC]">
              {retentionHorizon.map(horizon => <div key={horizon} className="min-w-0 px-2 py-2.5 sm:px-3">
                <dt className="text-xs font-semibold text-muted">Day {horizon}</dt>
                <dd><p className="mt-1 text-lg font-bold tabular-nums">{percent(rate(retention.current[horizon]))}</p>
                  <p className="mt-1 text-xs leading-4 text-muted">{rateComparison({ current: retention.current[horizon], previous: retention.previous[horizon] })}</p>
                </dd>
              </div>)}
            </dl>
            {cohorts.length ? <div role="region" aria-label="Retention cohort matrix" tabIndex={0} className={`mt-3 max-h-72 overflow-auto rounded-lg border border-border ${focus}`}>
              <table className="w-full min-w-[300px] text-left text-xs max-sm:table-fixed">
                <caption className="sr-only">Weekly signup cohorts with returned and eligible counts for days 1, 7 and 30</caption>
                <thead className="sticky top-0 bg-white text-muted"><tr>
                  <th scope="col" className="px-2 py-2 max-sm:w-[27%]">Signup dates</th><th scope="col" className="px-1.5 py-2 max-sm:w-[18%]">Signups</th>
                  {retentionHorizon.map(horizon => <th key={horizon} scope="col" className="px-2 py-2">D{horizon}</th>)}
                </tr></thead>
                <tbody>{cohorts.map(cohort => <tr key={cohort.start} className="border-t border-border">
                  <th scope="row" className="px-2 py-1.5 font-semibold sm:whitespace-nowrap">{shortDate.formatRange(new Date(cohort.start), new Date(cohort.end))}</th>
                  <td className="px-1.5 py-1.5 tabular-nums">{number.format(cohort.size)}</td>
                  {retentionHorizon.map(horizon => <td key={horizon} className="px-1 py-1.5"><RetentionCell value={cohort.rates[horizon]} /></td>)}
                </tr>)}</tbody>
              </table>
            </div> : <p className="mt-3 text-sm text-muted">No signup cohorts in this period.</p>}
            <p className="mt-3 text-xs leading-5 text-muted">Cells show returns / eligible signups. A dash marks a return day that had yet to end. Overall rates pool mature observations. Erased or unrecorded activity is absent.</p>
          </> : <Unavailable result={report.retention} />}
        </Panel>
      </div>
    </section>

    <section aria-labelledby="analytics-behavior" className="grid min-w-0 gap-3">
      <h2 id="analytics-behavior" className="text-base font-bold tracking-tight">Learning behavior</h2>
      <div className="grid min-w-0 gap-3 min-[980px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel id="analytics-review" title="Review activity" description="Recorded flashcard review attempts by day. Accuracy uses attempts with a known outcome.">
          {reviews && reviewCounts ? <>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong className="text-2xl font-bold tabular-nums">{number.format(reviews.current.attempts)}</strong>
              <p className="text-xs text-muted">{countComparison(reviewCounts)}</p>
            </div>
            <p className="mt-1 text-xs text-muted"><strong className="text-foreground">{percent(rate(accuracy(reviews.current)))} accuracy</strong>
              {" · "}{rateComparison({ current: accuracy(reviews.current), previous: accuracy(reviews.previous) })}</p>
            <ul aria-label="Review outcomes" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {tracks.map(track => <li key={track.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: track.color }} />
                {track.label} <strong className="text-foreground tabular-nums">{number.format(reviews.current[track.key])}</strong>
              </li>)}
            </ul>
            <AnalyticsChart title="Review activity" days={reviews.daily.map(point => point.day)} kind="bars" empty="No reviews were recorded in this period."
              series={tracks.map(track => ({ label: track.label, color: track.color, values: reviews.daily.map(point => point[track.key]) }))} />
          </> : <Unavailable result={report.reviews} />}
        </Panel>
        <Panel id="analytics-quizzes" title="Quiz modes" description="Mode selected when starting a completed quiz session.">
          {quizzes ? <>
            <div className="mt-3 rounded-lg bg-[#FFF2F7] px-3 py-2 text-xs leading-5 text-[#66384A]">
              <p className="font-bold">Partial coverage</p>
              <p>{report.quizzes.status === "partial" && report.quizzes.coverage}</p>
            </div>
            {quizzes.first && quizzes.last && <p className="mt-3 text-xs leading-5 text-muted">Observed {timeFormat.format(new Date(quizzes.first))}
              {quizzes.first !== quizzes.last && ` to ${timeFormat.format(new Date(quizzes.last))}`} UTC</p>}
            {quizTotal ? <ul aria-label="Distribution among sessions with a known mode" className="mt-3 space-y-3">
              {quizModes.map(mode => {
                const count = quizzes.modes[mode.id];
                const share = rate({ counted: count, eligible: quizTotal }) ?? 0;
                return <li key={mode.id}>
                  <div className="flex justify-between gap-2 text-sm"><span className="font-medium">{mode.label}</span>
                    <span className="text-muted tabular-nums">{number.format(count)} <span className="ml-1 font-semibold text-foreground">{percent(share)}</span></span></div>
                  <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F4EAF0]"><div className="h-full rounded-full bg-[#B44368]" style={{ width: `${share}%` }} /></div>
                </li>;
              })}
            </ul> : <p className="mt-3 text-sm text-muted">No completed sessions with a known mode survived in this period.</p>}
            {quizzes.unknown > 0 && <p className="mt-3 text-xs text-muted">{number.format(quizzes.unknown)} with unknown mode, excluded from shares.</p>}
          </> : <Unavailable result={report.quizzes} />}
        </Panel>
      </div>
    </section>

    <section aria-labelledby="analytics-content" className="grid min-w-0 gap-3">
      <h2 id="analytics-content" className="text-base font-bold tracking-tight">Content creation</h2>
      <Panel id="analytics-creation" title="Subjects and flashcards" description="Daily creations among surviving materials. Deleted items are absent. Each enumeration flashcard counts as one card. Charts use separate vertical scales.">
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 md:gap-6">
          <section className="min-w-0" aria-labelledby="analytics-subjects">
            <h4 id="analytics-subjects" className="font-semibold">Subjects created</h4>
            {subjects ? <TrendBody title="Subjects created" label="Subjects" trend={subjects} kind="bars" color={navy} empty="No surviving subjects were created in this period." /> : <Unavailable result={report.subjects} />}
          </section>
          <section className="min-w-0 border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6" aria-labelledby="analytics-flashcards">
            <h4 id="analytics-flashcards" className="font-semibold">Flashcards created</h4>
            {flashcards ? <TrendBody title="Flashcards created" label="Flashcards" trend={flashcards} kind="bars" color={berry} empty="No surviving flashcards were created in this period." /> : <Unavailable result={report.flashcards} />}
          </section>
        </div>
      </Panel>
    </section>

    <footer className="space-y-1 border-t border-border pt-3 text-xs leading-5 text-muted">
      <p>Reports use complete UTC days and exclude the administrator and marked demo accounts. Historical totals reflect records still held by Abii.</p>
      <p>Read at {timeFormat.format(new Date(report.measuredAt))} UTC</p>
    </footer>
  </div>;
}
