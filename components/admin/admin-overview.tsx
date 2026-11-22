import { Activity, Clock3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SkeletonBlock, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";
import type { OverviewReport } from "@/lib/admin/overview";
import { OverviewChart } from "./overview-chart";

const numbers = new Intl.NumberFormat("en");
const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const timestamp = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const kpiGrid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";
const panelGrid = "grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]";

function Metric({ label, value, definition, snapshot, snapshotLabel }: {
  label: string; value: number | null; definition: string; snapshot?: Date; snapshotLabel?: string;
}) {
  return (
    <Card padding="sm" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] content-start items-baseline gap-x-2">
      <h3 className="text-sm font-semibold">{label}</h3>
      <p className={`col-span-2 col-start-1 row-start-2 mt-2 font-semibold tabular-nums ${value === null ? "text-sm text-muted" : "text-3xl leading-none tracking-tight text-foreground"}`}>
        {value === null ? "Unavailable" : numbers.format(value)}
      </p>
      {snapshot && value !== null && <p className="col-start-2 row-start-1 text-right text-xs text-muted">
        Snapshot <time dateTime={snapshot.toISOString()}>{snapshotLabel}</time> UTC
      </p>}
      <p className="col-span-2 mt-2 text-xs leading-5 text-muted">{definition}</p>
    </Card>
  );
}

const denialLabels: Record<string, string> = {
  "login-denied": "Administrator sign-in denied",
  "mfa-denied": "Administrator MFA challenge denied",
  "access-denied": "Administrator access denied",
  "recovery-denied": "Administrator recovery attempt denied",
};

export function AdminOverview({ report }: { report: OverviewReport }) {
  const { window, readAt, growth, reviews, completedQuizzes, totalUsers, totalFlashcards, recent, attention, attentionFailed } = report;
  const when = timestamp.format(readAt);
  const lastDate = new Date(+window.end - 1);
  const newAccounts = growth?.reduce((total, point) => total + point.count, 0) ?? null;
  const error = [totalUsers, totalFlashcards, growth, reviews, completedQuizzes, recent].includes(null) || attentionFailed;
  const attentionTitle = attentionFailed ? "Security activity could not be loaded" : attention
    ? attention.kind === "recovery-denied" ? "Review recent recovery activity" : "Partial monitoring coverage"
    : "Monitoring unavailable";

  return (
    <div className="grid min-w-0 gap-6">
      <section aria-labelledby="platform-overview" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="platform-overview" className="text-xl font-bold tracking-tight sm:text-2xl">Platform Overview</h2>
            <p className="mt-1 text-sm text-muted">
              <time dateTime={window.start.toISOString()}>{date.format(window.start)}</time>
              {" – "}
              <time dateTime={lastDate.toISOString()}>{date.format(lastDate)}</time> · UTC
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted"><Clock3 size={14} aria-hidden="true" />
              Last updated <time dateTime={readAt.toISOString()}>{when}</time> UTC
            </p>
          </div>
          <form action="/admin" method="get" className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold">
              Reporting period
              <select name="period" defaultValue={String(window.days)} className="min-h-11 rounded-lg border border-border bg-white px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#9B3054]">
                {[7, 30, 90].map(days => <option key={days} value={days}>Last {days} complete days</option>)}
              </select>
            </label>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
        </div>

        {error && <p role="status" className="rounded-xl border border-border bg-pink-soft px-4 py-3 text-sm text-muted">
          Some reporting could not be loaded. <a className="font-semibold text-[#9B3054] underline underline-offset-2" href={`/admin?period=${window.days}`}>Reload report</a>
        </p>}

        <div className={kpiGrid}>
          <Metric label="Total Users" value={totalUsers} definition="Current learner accounts of all statuses." snapshot={readAt} snapshotLabel={when} />
          <Metric label="Active Learners" value={reviews?.active ?? null} definition="Distinct learners with a recorded review in this period." />
          <Metric label="New Users" value={newAccounts} definition="Retained learner accounts created in this period." />
          <Metric label="Total Flashcards" value={totalFlashcards} definition="Stored cards, including enumeration cards." snapshot={readAt} snapshotLabel={when} />
          <Metric label="Completed Quizzes" value={completedQuizzes} definition="Verified minimum in this period. Older or erased evidence may be missing." />
          <Card padding="sm" className="min-w-0 bg-[#FFFCFD]">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Activity size={15} aria-hidden="true" className="text-muted" />System Health</h3>
            <p className="mt-2 text-sm font-semibold">Monitoring unavailable</p>
            <p className="mt-2 text-xs leading-5 text-muted">Service-health instrumentation is planned for the performance phase.</p>
          </Card>
        </div>
      </section>

      <div className={panelGrid}>
        <OverviewChart key={`growth-${window.start.toISOString()}`} id="user-growth" title="User Growth" description="New learner accounts over time."
          series={growth} variant="area" unit="registrations" empty="No retained accounts were created in this period." />
        <OverviewChart key={`activity-${window.start.toISOString()}`} id="learning-activity" title="Learning Activity" description="Recorded flashcard reviews across the platform."
          series={reviews?.series ?? null} variant="bars" unit="reviews" empty="No flashcard reviews were recorded in this period." />
      </div>

      <div className={panelGrid}>
        <Card padding="sm" className="min-w-0 sm:p-5">
          <CardTitle>Recent Users</CardTitle>
          <CardDescription>The latest learner accounts created on Abii.</CardDescription>
          {recent?.length ? <ul className="mt-3 divide-y divide-border">
            {recent.map(row => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pink-card text-sm font-semibold text-[#9B3054]">{Array.from((row.name || "").trim())[0]?.toUpperCase() ?? "?"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold [overflow-wrap:anywhere]">{row.name || "Unnamed learner"}</p>
                  <time className="text-xs text-muted" dateTime={row.createdAt}>{date.format(new Date(row.createdAt))} UTC</time>
                </div>
                <span className={`text-xs font-medium ${row.status === "Suspended" ? "text-[#8B273F]" : "text-muted"}`}>{row.status}</span>
              </li>
            ))}
          </ul> : <p className="mt-4 text-sm text-muted">{recent ? "There are no dated learner accounts to display." : "Recent users could not be loaded."}</p>}
        </Card>

        <Card padding="sm" className="min-w-0 sm:p-5">
          <CardTitle>Needs Attention</CardTitle>
          <CardDescription>Operational coverage and recent access signals.</CardDescription>
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="flex items-start gap-2 text-sm font-semibold">
              <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />{attentionTitle}
            </h3>
            {attention && <p className="mt-2 text-sm text-muted">
              {denialLabels[attention.kind]} · <time dateTime={attention.occurredAt}>{timestamp.format(new Date(attention.occurredAt))} UTC</time>.
              {" "}{attention.kind === "recovery-denied" ? "If this was unexpected, verify whether an authorized operator initiated it." : "This is an access event. Incident status is unknown."}
            </p>}
            <p className="mt-2 text-sm leading-6 text-muted">Service-health checks and open support-ticket status are unavailable.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <SkeletonRegion label="Loading platform report" className="grid min-w-0 gap-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="grid gap-2"><SkeletonBlock className="h-7 w-44 rounded" /><SkeletonBlock className="h-4 w-52 rounded" /></div>
        <SkeletonBlock className="h-11 w-48 rounded-lg" />
      </div>
      <div className={kpiGrid}>{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} className="space-y-2">
        <SkeletonBlock className="h-4 w-24 rounded" /><SkeletonBlock className="h-7 w-14 rounded" /><SkeletonBlock className="h-4 w-4/5 rounded" />
      </SkeletonCard>)}</div>
      {[0, 1].map(row => <div key={row} className={panelGrid}>
        {[0, 1].map(col => <SkeletonCard key={col} className="space-y-3">
          <SkeletonBlock className="h-5 w-28 rounded" /><SkeletonBlock className={`${row === 0 ? "h-44" : "h-24"} rounded-xl`} />
        </SkeletonCard>)}
      </div>)}
    </SkeletonRegion>
  );
}
