import Image from "next/image";
import { ArrowDownRight, ArrowUpRight, Clock3, ShieldAlert } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonBlock, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";
import type { OverviewReport } from "@/lib/admin/overview";
import { OverviewChart, OverviewSparkline } from "./overview-chart";

const numbers = new Intl.NumberFormat("en");
const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const timestamp = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const panelGrid = "grid min-w-0 items-stretch gap-4 min-[1100px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]";

type Trend = OverviewReport["trends"]["registrations"];
function TrendText({ trend, label, zeroLabel = "change" }: { trend: Trend; label: string; zeroLabel?: string }) {
  if (trend.availability === "unavailable" || trend.absoluteChange === null) return <span className="text-xs text-muted">Comparison unavailable</span>;
  const positive = trend.absoluteChange > 0;
  const text = trend.previous === 0
    ? trend.current === 0 ? "No change" : `+${numbers.format(trend.absoluteChange)} ${zeroLabel}`
    : `${positive ? "+" : ""}${trend.percentageChange?.toFixed(1) ?? "0.0"}%`;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
    {positive ? <ArrowUpRight size={14} aria-hidden="true" className="text-[var(--overview-accent-ink)]" /> : trend.absoluteChange < 0 ? <ArrowDownRight size={14} aria-hidden="true" className="text-muted" /> : null}
    <span>{text} <span className="font-normal text-muted">{label}</span></span>
  </span>;
}

function MetricCard({ label, value, definition, trend, series, period, zeroLabel }: {
  label: string; value: number | null; definition: string; trend: Trend; series: OverviewReport["growth"]; period: string; zeroLabel?: string;
}) {
  const chartSeries = series;
  return <Card padding="sm" className="grid min-h-[142px] min-w-0 content-between gap-3 shadow-none sm:p-4">
    <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0">
      <h3 className="text-sm font-semibold leading-5">{label}</h3>
      <p className="mt-2 text-[clamp(1.65rem,3vw,2rem)] font-semibold leading-none tracking-tight tabular-nums">{value === null ? <span className="text-sm font-medium text-muted">Unavailable</span> : numbers.format(value)}</p>
    </div><div className="w-[38%] shrink-0 self-end"><OverviewSparkline series={chartSeries} variant="area" label={`${label} trend for the last ${period} days`} /></div></div>
    <div className="grid gap-1"><TrendText trend={trend} label={trend.comparisonLabel} zeroLabel={zeroLabel} /><p className="text-xs leading-4 text-muted">{definition}</p></div>
  </Card>;
}

const denialLabels: Record<string, string> = {
  "login-denied": "Administrator sign-in denied", "mfa-denied": "Administrator MFA challenge denied",
  "access-denied": "Administrator access denied", "recovery-denied": "Administrator recovery attempt denied",
};

export function AdminOverview({ report }: { report: OverviewReport }) {
  const { window, readAt, growth, reviews, completedQuizzes, totalUsers, totalFlashcards, recent, attention, attentionFailed, trends } = report;
  const when = timestamp.format(readAt);
  const lastDate = new Date(+window.end - 1);
  const newAccounts = trends.registrations.current;
  const error = [totalUsers, totalFlashcards, growth, reviews, completedQuizzes, recent].includes(null) || attentionFailed;
  return <div className="grid min-w-0 gap-4 sm:gap-5">
    <section aria-labelledby="platform-overview" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0"><h2 id="platform-overview" className="text-xl font-bold tracking-tight sm:text-2xl">Platform Overview</h2>
          <p className="mt-1 text-sm text-muted"><time dateTime={window.start.toISOString()}>{date.format(window.start)}</time> – <time dateTime={lastDate.toISOString()}>{date.format(lastDate)}</time> · UTC</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted"><Clock3 size={14} aria-hidden="true" />Last updated <time dateTime={readAt.toISOString()}>{when}</time> UTC</p>
        </div>
        <form action="/admin" method="get" className="flex min-w-0 flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-semibold">Reporting period
            <select name="period" defaultValue={String(window.days)} className="min-h-11 max-w-full rounded-lg border border-border bg-white px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--overview-accent-ink)]">
              {[7, 30, 90].map(days => <option key={days} value={days}>Last {days} complete days</option>)}
            </select>
          </label><Button type="submit">Apply</Button>
        </form>
      </div>
      {error && <p role="status" className="rounded-lg border border-border bg-[var(--overview-pink)] px-4 py-3 text-sm text-muted">Some report sections could not be loaded. <a className="font-semibold text-[var(--overview-accent-ink)] underline underline-offset-2" href={`/admin?period=${window.days}`}>Reload report</a></p>}
    </section>

    <section aria-label="Platform metrics" className="grid min-w-0 gap-3 min-[1100px]:grid-cols-12">
      <Card padding="md" data-overview-feature className="grid min-h-[280px] min-w-0 content-between gap-5 border-transparent bg-[var(--overview-pink)] shadow-none sm:min-h-[300px] min-[1100px]:col-span-5 min-[1100px]:row-span-2">
        <div className="grid gap-3"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold">Total Users</h3><span className="text-xs text-muted">Current snapshot</span></div>
          <p className="text-[clamp(2.5rem,5vw,3.25rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums">{totalUsers === null ? <span className="text-base font-medium text-muted">Unavailable</span> : numbers.format(totalUsers)}</p>
          <p className="text-sm text-muted">Registered learner accounts</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium">Registration activity</span><TrendText trend={trends.registrations} label={`vs previous ${window.days} days`} zeroLabel="new" /></div>
        </div>
        <OverviewSparkline series={growth} variant="area" label={`Daily retained learner registrations over the last ${window.days} complete days`} />
          <a href="/admin/users" className="w-fit text-sm font-semibold text-[var(--overview-accent-ink)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--overview-accent-ink)]">View users</a>
      </Card>
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[450px]:grid-cols-2 min-[1100px]:col-span-7">
        <MetricCard label="Active Learners" value={reviews?.active ?? null} definition="Distinct learners with a recorded review." trend={trends.activeLearners} series={reviews?.activeSeries ?? null} period={String(window.days)} />
        <MetricCard label="New Users" value={newAccounts} definition="Retained registrations in this period." trend={trends.registrations} series={growth} period={String(window.days)} zeroLabel="new" />
        <MetricCard label="Total Flashcards" value={totalFlashcards} definition="Stored inventory, including enumeration. Sparkline: retained cards created." trend={trends.totalFlashcards} series={trends.totalFlashcards.series} period={String(window.days)} />
        <MetricCard label="Completed Quizzes" value={completedQuizzes} definition="Verified minimum; older evidence may be missing." trend={trends.completedQuizzes} series={trends.completedQuizzes.series} period={String(window.days)} />
      </div>
    </section>

    <div className={panelGrid}>
      <OverviewChart key={`growth-${window.start.toISOString()}`} id="user-growth" title="User Growth" description="New retained learner registrations." series={growth} variant="area" unit="registrations" empty="No retained accounts were created in this period." />
      <OverviewChart key={`activity-${window.start.toISOString()}`} id="learning-activity" title="Learning Activity" description="Recorded flashcard reviews across the platform." series={reviews?.series ?? null} variant="bars" unit="reviews" empty="No flashcard reviews were recorded in this period." />
    </div>

    <div className={panelGrid}>
      <Card padding="sm" className="min-w-0 sm:p-5">
        <div className="flex items-baseline justify-between gap-3"><CardTitle>Recent Users</CardTitle><a href="/admin/users" className="min-h-11 content-center text-sm font-semibold text-[var(--overview-accent-ink)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--overview-accent-ink)]">View all</a></div>
        <CardDescription>The latest learner accounts on Abii.</CardDescription>
        {recent?.length ? <ul className="mt-2 divide-y divide-border">{recent.map(row => <li key={row.id} className="flex min-w-0 items-center gap-3 py-2.5">
          <span aria-hidden="true" className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--overview-pink)] text-sm font-semibold text-primary">
            {row.profileImage ? <Image src={row.profileImage} alt="" fill sizes="36px" unoptimized className="object-cover" /> : Array.from((row.name || "").trim())[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.name || "Unnamed learner"}</p><time className="text-xs text-muted" dateTime={row.createdAt}>{date.format(new Date(row.createdAt))} UTC</time></div>
          <span className={`shrink-0 text-xs font-medium ${row.status === "Suspended" ? "text-error-text" : "text-muted"}`}>{row.status}</span>
        </li>)}</ul> : <p className="mt-4 text-sm text-muted">{recent ? "There are no dated learner accounts to display." : "Recent users could not be loaded."}</p>}
      </Card>

      <Card padding="sm" className="min-w-0 sm:p-5">
        <CardTitle>Needs Attention</CardTitle><CardDescription>Operational coverage and recent access signals.</CardDescription>
        <ul className="mt-3 divide-y divide-border">
          <li className="flex gap-3 py-3"><ShieldAlert size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" /><div className="min-w-0">
            <p className="text-sm font-semibold">{attentionFailed ? "Security activity unavailable" : attention ? "Recent access event" : "No recorded access event in this period"}</p>
            {attention && <p className="mt-1 text-xs leading-5 text-muted">{denialLabels[attention.kind] ?? "Administrator access event"} · <time dateTime={attention.occurredAt}>{timestamp.format(new Date(attention.occurredAt))} UTC</time>. This does not confirm an incident.</p>}
            <a href="/admin/security" className="mt-1 inline-block text-xs font-semibold text-[var(--overview-accent-ink)] underline-offset-2 hover:underline">Security activity</a>
          </div></li>
          <li className="flex gap-3 py-3"><span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-muted" /><div><p className="text-sm font-semibold">Monitoring unavailable</p><a href="/admin/performance" className="mt-1 inline-block text-xs font-semibold text-[var(--overview-accent-ink)] underline-offset-2 hover:underline">System performance</a></div></li>
          <li className="flex gap-3 py-3"><span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-muted" /><div><p className="text-sm font-semibold">Support status unavailable</p><a href="/admin/support" className="mt-1 inline-block text-xs font-semibold text-[var(--overview-accent-ink)] underline-offset-2 hover:underline">Support workspace</a></div></li>
        </ul>
      </Card>
    </div>
  </div>;
}

export function OverviewSkeleton() {
  return <SkeletonRegion label="Loading platform report" className="grid min-w-0 gap-4 sm:gap-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div className="grid gap-2"><SkeletonBlock className="h-7 w-44 rounded" /><SkeletonBlock className="h-4 w-52 rounded" /><SkeletonBlock className="h-3 w-40 rounded" /></div><SkeletonBlock className="h-11 w-52 rounded-lg" /></div>
    <div className="grid min-w-0 gap-3 min-[1100px]:grid-cols-12">
      <SkeletonCard className="min-h-[280px] space-y-4 min-[1100px]:col-span-5 min-[1100px]:row-span-2"><SkeletonBlock className="h-4 w-24 rounded" /><SkeletonBlock className="h-12 w-40 rounded" /><SkeletonBlock className="h-16 rounded" /></SkeletonCard>
      <div className="grid gap-3 min-[450px]:grid-cols-2 min-[1100px]:col-span-7">{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} className="min-h-[142px] space-y-3"><SkeletonBlock className="h-4 w-28 rounded" /><SkeletonBlock className="h-8 w-20 rounded" /><SkeletonBlock className="h-8 rounded" /></SkeletonCard>)}</div>
    </div>
    <div className={panelGrid}>{[0, 1].map(i => <SkeletonCard key={i} className="space-y-3"><SkeletonBlock className="h-5 w-32 rounded" /><SkeletonBlock className="h-60 rounded" /></SkeletonCard>)}</div>
    <div className={panelGrid}>{[0, 1].map(i => <SkeletonCard key={i} className="space-y-3"><SkeletonBlock className="h-5 w-32 rounded" /><SkeletonBlock className="h-40 rounded" /></SkeletonCard>)}</div>
  </SkeletonRegion>;
}
