import Link from "next/link";
import { Activity, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button, buttonClassNames } from "@/components/ui/button";
import { AdminEmptyState, AdminPanel } from "@/components/admin/admin-ui";
import { AnalyticsChart } from "@/components/admin/analytics-chart";
import { SecurityEvidenceTable } from "@/components/admin/security-evidence-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import type { SecurityQuery, SecurityReport } from "@/lib/admin/security";
import { auditLabels, eventLabels } from "@/lib/admin/security-contract";
import { adminChartColors as chart } from "@/components/admin/chart-colors";
import { AdminSessionSecurity, SessionSecuritySkeleton } from "@/components/admin/admin-session-security";

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const ticks = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const count = new Intl.NumberFormat("en");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F8769C]";
const split = "grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]";
const inputStyle = `mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-[#FFFFFF] px-2.5 text-base sm:text-sm ${focus}`;
const periods = [["24h", "24 hours", "24H"], ["7d", "7 days", "7D"], ["30d", "30 days", "30D"]] as const;
const auditLink = buttonClassNames({ variant: "ghost", className: "px-2 text-xs underline underline-offset-4" });

function href(query: SecurityQuery, changes: Record<string, string | undefined> = {}, fragment = "") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ period: query.period, category: query.category === "all" ? "" : query.category,
    kind: query.kind, outcome: query.outcome, actor: query.actor, from: query.from, to: query.to, q: query.q, ...changes })) {
    if (value) params.set(key, value);
  }
  return `/admin/security?${params}${fragment}`;
}

function Stamp({ time }: { time: number }) {
  return <time dateTime={new Date(time).toISOString()}>{dateTime.format(time)} UTC</time>;
}

export function SecurityControls({ query }: { query: SecurityQuery }) {
  const { period, from } = query;
  return <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
    <h2 id="security-overview" className="text-xl font-semibold tracking-tight sm:text-2xl">Security Overview</h2>
    <nav aria-label="Security reporting period" className="inline-flex rounded-xl border border-border bg-white p-1">
      {periods.map(([key, label, display]) => <Link key={key} href={href(query, { period: key, from: "", to: "" })} prefetch={false}
        aria-current={!from && period === key ? "page" : undefined}
        aria-label={label} className={`grid min-h-11 place-items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold ${focus} ${!from && period === key ? "bg-[#FFE8EF] text-primary" : "text-muted hover:bg-[#FFF1F5]"}`}>{display}</Link>)}
    </nav>
  </header>;
}

function Indicator({ label, value, children, icon: Icon }: { label: string; value: number | null; children: ReactNode; icon: typeof Activity }) {
  return <div className={`min-h-[136px] min-w-0 rounded-xl border border-border px-3 py-3.5 sm:px-5 sm:py-4 ${label === "Security Alerts" ? "bg-[#FFE8EF]" : "bg-white"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><dt className="min-w-0 break-words text-sm font-semibold">{label}</dt><Icon aria-hidden="true" size={16} className="shrink-0 text-foreground" /></div>
    <dd className={`mt-1.5 font-semibold tracking-tight tabular-nums ${value === null ? "text-base text-muted" : "text-2xl"}`}>{value === null ? "Unavailable" : count.format(value)}</dd>
    <dd className="mt-1 text-xs leading-5 text-muted">{children}</dd>
  </div>;
}

function Feedback({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return <p role={alert ? "alert" : undefined} className={`rounded-lg border border-dashed px-3.5 py-3.5 text-sm leading-6 ${alert ? "border-error/30 bg-error-bg text-error-text" : "border-border bg-surface text-muted"}`}>{children}</p>;
}

export function SecurityError({ message }: { message: string }) {
  return <div className="grid gap-2">
    <Feedback alert>{message}</Feedback>
    <Link href="/admin/security" className={auditLink}>Open the default view</Link>
    <AdminSessionSecurity />
  </div>;
}

function EvidenceFilters({ query }: { query: SecurityQuery }) {
  return <form action="/admin/security#audit-history" method="get" aria-label="Filter security evidence"
    className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
    <input type="hidden" name="period" value={query.period} />
    <label className="col-span-2 min-w-0 text-xs font-semibold">Search event or correlation ID
      <input type="search" name="q" maxLength={110} defaultValue={query.q} placeholder="Exact ID" className={inputStyle} />
    </label>
    <label className="min-w-0 text-xs font-semibold">Evidence type<select name="category" defaultValue={query.category} className={inputStyle}>
      <option value="all">All types</option><option value="authentication">Authentication</option><option value="rate">Rate limiting</option><option value="audit">Admin audit</option>
    </select></label>
    <details open={query.kind || query.outcome || query.actor ? true : undefined} className="col-span-full min-w-0">
    <summary className={`min-h-11 cursor-pointer rounded py-3 text-xs font-semibold text-foreground ${focus}`}>Filters</summary>
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
    <label className="min-w-0 text-xs font-semibold">Event<select name="kind" defaultValue={query.kind} className={inputStyle}>
      <option value="">All events</option>
      <optgroup label="Administrator audit">{Object.entries(auditLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</optgroup>
      <optgroup label="Security observations">{Object.entries(eventLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</optgroup>
    </select></label>
    <label className="min-w-0 text-xs font-semibold">Outcome<select name="outcome" defaultValue={query.outcome} className={inputStyle}>
      <option value="">Any result</option><option value="success">Success</option><option value="failure">Failed</option><option value="denied">Denied</option>
      <option value="rate-limited">Rate limited</option><option value="committed">Committed</option>
    </select></label>
    <label className="min-w-0 text-xs font-semibold">Actor<select name="actor" defaultValue={query.actor} className={inputStyle}>
      <option value="">All actors</option><option value="admin">Administrator</option><option value="learner">Learner</option><option value="unknown">Unverified</option>
    </select></label>
    </div></details>
    <details open={query.from ? true : undefined} className="col-span-full min-w-0">
      <summary className={`min-h-11 cursor-pointer rounded py-3 text-xs font-semibold text-foreground ${focus}`}>Custom UTC dates</summary>
      <div className="grid min-w-0 gap-3 min-[390px]:grid-cols-2 sm:max-w-lg">
        <label className="min-w-0 text-xs font-semibold">From (UTC)<input type="date" name="from" defaultValue={query.from} className={inputStyle} /></label>
        <label className="min-w-0 text-xs font-semibold">Through (UTC)<input type="date" name="to" defaultValue={query.to} className={inputStyle} /></label>
      </div>
    </details>
    <div className="col-span-full flex flex-wrap items-center gap-3 border-b border-border pb-3">
      <Button type="submit">Apply filters</Button>
      <Link href={`/admin/security?period=${query.period}#audit-history`} prefetch={false} className={auditLink}>Clear filters</Link>
    </div>
  </form>;
}

export function AdminSecurity({ report, collecting }: { report: SecurityReport; collecting: boolean }) {
  const { query, summary } = report;
  const trend = [
    { label: "Successful sign-ins", color: chart.primary, values: summary.chart.map(bin => bin.success > 0 ? bin.success : null) },
    { label: "Password / MFA failures", color: chart.secondary, dash: "6 4", values: summary.chart.map(bin => bin.failure > 0 ? bin.failure : null) },
    { label: "Rate limiting", color: chart.tertiary, dash: "1 4", values: summary.chart.map(bin => bin.rate > 0 ? bin.rate : null) },
  ];
  return <div className="grid min-w-0 gap-4">
    <div className="relative grid gap-1 rounded-lg border border-border bg-[#FFE8EF] px-3.5 py-2.5 text-xs leading-5 text-muted">
      <div className="flex flex-wrap justify-between gap-x-4">
        <p className="flex flex-wrap gap-x-1"><Stamp time={query.start} /> <span>to</span> <Stamp time={query.end} /></p>
        <p><strong>Last recorded</strong> {summary.last ? <Stamp time={summary.last} /> : "No usable evidence"}</p>
      </div>
      <p>{summary.first ? <>Counted observations in this window begin <Stamp time={summary.first} />. Collection gaps are possible.</> :
        collecting ? "This window has no counted diagnostic evidence." : "Forward diagnostic collection is disabled."}
        {summary.legacy > 0 && <> {count.format(summary.legacy)} historical representative {summary.legacy === 1 ? "record is" : "records are"} excluded from attempt totals.</>}
        {summary.limited && " The reporting limit was reached. Counts cover the newest scanned records."}
      </p>
      {(!report.auditAvailable || !report.eventsAvailable) && <p role="alert" className="font-semibold text-error-text">Some evidence sources could not be read.</p>}
    </div>

    <dl aria-label="Security indicators for the displayed UTC window" className="grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-4">
      <Indicator icon={KeyRound} label="Failed Logins" value={summary.failedLogins}>Recorded password rejections. MFA failures appear in activity.</Indicator>
      <Indicator icon={Activity} label="Rate-limited Requests" value={summary.rateLimited}>Observed limiter rejections in the selected window.</Indicator>
      <Indicator icon={ShieldAlert} label="Security Alerts" value={summary.first ? summary.alertCount : null}>Threshold breaches backed by count-bearing evidence.</Indicator>
      <Indicator icon={ShieldCheck} label="Admin Actions" value={report.auditAvailable ? summary.actions : null}>Committed privileged changes in the selected window.</Indicator>
    </dl>

    <AdminSessionSecurity />

    <div className={split}>
      <AdminPanel title="Authentication Activity" description="Recorded sign-ins, failed challenges and limiter rejections. Gaps indicate intervals with no usable observations." className="admin-evidence-panel" stretch bodyClassName="flex-1">
        <AnalyticsChart title="Authentication activity" days={summary.chart.map(bin => new Date(bin.from).toISOString())}
          intervals={summary.chart.map(bin => ({ label: `${dateTime.format(bin.from)} to ${dateTime.format(bin.to)} UTC`,
            tick: query.end - query.start <= 86_400_000 ? clock.format(bin.from) : ticks.format(bin.from) }))}
          kind="bars" stacked={false} series={trend} empty="No chartable authentication observations in this period." />
      </AdminPanel>
      <AdminPanel title="Security Alerts" description="Verified threshold breaches in completed five-minute intervals." className="admin-evidence-panel" stretch bodyClassName="flex-1">
        {summary.alerts.length ? <ul className="-my-2 divide-y divide-border">
          {summary.alerts.map(alert => <li key={`${alert.kind}-${alert.first}`} className="py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2"><p className="text-sm font-semibold">{alert.title}</p><span className="text-xs font-semibold text-foreground">{alert.severity}</span></div>
            <p className="mt-1 text-xs leading-5 text-muted">{count.format(alert.count)} observed. Rule requires {alert.rule}.</p>
            <p className="text-xs leading-5 text-muted">Window <Stamp time={alert.first} /> to <Stamp time={alert.end} />.<br />Last observed <Stamp time={alert.last} />.</p>
            <Link href={href(query, alert.title === "Sustained password failures" ? { kind: "", category: "authentication", outcome: "failure", actor: "", q: "" } :
              { kind: alert.kind, category: "all", outcome: "", actor: alert.kind === "access-denied" ? "admin" : "", q: "" }, "#audit-history")}
              prefetch={false} className={auditLink}>Inspect evidence</Link>
          </li>)}
        </ul> : <AdminEmptyState icon={summary.first ? "inbox" : "alert"} title={summary.first ? "No verified alerts" : "Alert evaluation unavailable"}
          description={summary.first ? "No verified alert conditions met the displayed thresholds." : "Counted evidence is required to evaluate alerts."} size="visualization" />}
      </AdminPanel>
    </div>

    <AdminPanel title="Recent Administrative Actions" description="Committed privileged changes from the administrator audit trail." className="admin-evidence-panel"
      actions={<Link href={href(query, {}, "#audit-history")} prefetch={false} className={auditLink}>View audit history</Link>}>
      {summary.recentActions.length ? <ul className="-my-2 divide-y divide-border">
        {summary.recentActions.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
          <div className="min-w-0"><p className="text-sm font-semibold">{row.label}</p>
            <p className="mt-0.5 break-words text-xs text-muted">Administrator{row.target ? ` → ${row.target.kind} ${row.target.id}` : ""}</p></div>
          <span className="text-xs text-muted"><Stamp time={row.at} /></span>
        </li>)}
      </ul> : <Feedback alert={!report.auditAvailable}>{report.auditAvailable ? "No committed privileged changes in this period." : "Administrator audit evidence could not be read."}</Feedback>}
    </AdminPanel>

    <section id="audit-history" aria-label="Security & Audit Explorer" className="min-w-0 scroll-mt-3">
      <AdminPanel title="Security & Audit Explorer" description="Newest first. Select an event to inspect its recorded evidence." className="admin-evidence-panel">
        <div className="grid min-w-0 gap-3">
          <EvidenceFilters query={query} />
          {report.explorerPartial && <Feedback alert>{report.explorerAvailable ? "Only one evidence source could be read. Pagination is paused." : "Security and audit history could not be read. Reload to try again."}</Feedback>}
          {report.rows.length > 0 && <p className="text-xs text-muted sm:hidden">Swipe to see actor, target and outcome columns.</p>}
          {report.rows.length ? <SecurityEvidenceTable rows={report.rows} /> : report.explorerAvailable && <Feedback>
            {report.next ? "No matches in this part of the retained history. Continue to check older evidence." : "No matching security or audit events."}
          </Feedback>}
          {(query.token || report.next) && <AdminPagination label="Audit pagination" result={`Showing ${count.format(report.rows.length)} evidence records`}>
            {query.token && <Link href={href(query, {}, "#audit-history")} prefetch={false} className={auditLink}>First page</Link>}
            {report.next && <Link href={href(query, { cursor: report.next }, "#audit-history")} prefetch={false} className={auditLink}>Older evidence</Link>}
          </AdminPagination>}
        </div>
      </AdminPanel>
    </section>
  </div>;
}

export function SecuritySkeleton({ controls = false }: { controls?: boolean }) {
  return <SkeletonRegion label="Loading security evidence" className="grid min-w-0 gap-4">
    {controls && <SkeletonBlock className="h-12 rounded-lg" />}
    <SkeletonBlock className="h-12 rounded-lg" />
    <div className="grid grid-cols-2 gap-1 xl:grid-cols-4">{[0, 1, 2, 3].map(index => <SkeletonBlock key={index} className="h-28 rounded-xl" />)}</div>
    <SessionSecuritySkeleton />
    <div className={split}><SkeletonBlock className="h-56 rounded-2xl" /><SkeletonBlock className="h-32 rounded-2xl" /></div>
    <SkeletonBlock className="h-32 rounded-2xl" />
    <SkeletonBlock className="h-64 rounded-2xl" />
  </SkeletonRegion>;
}
