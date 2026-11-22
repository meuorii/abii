import Link from "next/link";
import type { ReactNode } from "react";
import { AdminPanel } from "@/components/admin/admin-ui";
import { AnalyticsChart } from "@/components/admin/analytics-chart";
import { SecurityEvidenceTable } from "@/components/admin/security-evidence-table";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import type { SecurityQuery, SecurityReport } from "@/lib/admin/security";
import { auditLabels, eventLabels } from "@/lib/admin/security-contract";

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const ticks = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const count = new Intl.NumberFormat("en");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#993557]";
const split = "grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]";
const inputStyle = `mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-2.5 text-base sm:text-sm ${focus}`;
const periods = [["24h", "24 hours"], ["7d", "7 days"], ["30d", "30 days"]] as const;
const auditLink = `inline-flex min-h-11 items-center rounded text-xs font-semibold text-[#863652] underline-offset-4 hover:underline ${focus}`;

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
    <h2 id="security-overview" className="text-xl font-semibold tracking-tight sm:text-2xl">Security overview</h2>
    <nav aria-label="Security reporting period" className="inline-flex rounded-xl border border-border bg-white p-1">
      {periods.map(([key, label]) => <Link key={key} href={href(query, { period: key, from: "", to: "" })} prefetch={false}
        aria-current={!from && period === key ? "page" : undefined}
        className={`grid min-h-11 place-items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold ${focus} ${!from && period === key ? "bg-[#F9E4ED] text-[#83314F]" : "text-muted hover:bg-pink-soft"}`}>{label}</Link>)}
    </nav>
  </header>;
}

function Indicator({ label, value, children }: { label: string; value: number | null; children: ReactNode }) {
  return <div className="min-w-0 bg-white px-3 py-3.5 sm:px-5 sm:py-4">
    <dt className="text-sm font-semibold">{label}</dt>
    <dd className={`mt-1.5 font-semibold tracking-tight tabular-nums ${value === null ? "text-base text-muted" : "text-2xl"}`}>{value === null ? "Unavailable" : count.format(value)}</dd>
    <dd className="mt-1 text-xs leading-5 text-muted">{children}</dd>
  </div>;
}

function Feedback({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return <p role={alert ? "alert" : undefined} className="rounded-lg border border-dashed border-border bg-[#FFFBFD] px-3.5 py-3.5 text-sm leading-6 text-muted">{children}</p>;
}

export function SecurityError({ message }: { message: string }) {
  return <div className="grid gap-2">
    <Feedback alert>{message}</Feedback>
    <Link href="/admin/security" className={auditLink}>Open the default view</Link>
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
    <details open={query.from ? true : undefined} className="col-span-full min-w-0">
      <summary className={`min-h-11 cursor-pointer rounded py-3 text-xs font-semibold text-[#863652] ${focus}`}>Custom UTC dates</summary>
      <div className="grid min-w-0 gap-3 min-[390px]:grid-cols-2 sm:max-w-lg">
        <label className="min-w-0 text-xs font-semibold">From (UTC)<input type="date" name="from" defaultValue={query.from} className={inputStyle} /></label>
        <label className="min-w-0 text-xs font-semibold">Through (UTC)<input type="date" name="to" defaultValue={query.to} className={inputStyle} /></label>
      </div>
    </details>
    <div className="col-span-full flex flex-wrap items-center gap-3 border-b border-border pb-3">
      <button type="submit" className={`min-h-11 rounded-lg bg-[#F8E2EC] px-4 text-sm font-semibold text-[#83314F] hover:bg-[#F4D5E3] ${focus}`}>Apply filters</button>
      <Link href={`/admin/security?period=${query.period}#audit-history`} prefetch={false} className={auditLink}>Clear filters</Link>
    </div>
  </form>;
}

export function AdminSecurity({ report, collecting }: { report: SecurityReport; collecting: boolean }) {
  const { query, summary } = report;
  const trend = [
    { label: "Successful sign-ins", color: "#7A9AA9", values: summary.chart.map(bin => bin.success > 0 ? bin.success : null) },
    { label: "Password and MFA failures", color: "#A73F65", values: summary.chart.map(bin => bin.failure > 0 ? bin.failure : null) },
    { label: "Rate limiter rejections", color: "#8E769E", values: summary.chart.map(bin => bin.rate > 0 ? bin.rate : null) },
  ];
  return <div className="grid min-w-0 gap-4">
    <div className="relative grid gap-1 rounded-lg border border-border bg-[#FCF3F7] px-3.5 py-2.5 text-xs leading-5 text-[#5E4E5A]">
      <div className="flex flex-wrap justify-between gap-x-4">
        <p className="flex flex-wrap gap-x-1"><Stamp time={query.start} /> <span>to</span> <Stamp time={query.end} /></p>
        <p><strong>Last recorded</strong> {summary.last ? <Stamp time={summary.last} /> : "No usable evidence"}</p>
      </div>
      <p>{summary.first ? <>Counted observations in this window begin <Stamp time={summary.first} />. Collection gaps are possible.</> :
        collecting ? "This window has no counted diagnostic evidence." : "Forward diagnostic collection is disabled."}
        {summary.legacy > 0 && <> {count.format(summary.legacy)} historical representative {summary.legacy === 1 ? "record is" : "records are"} excluded from attempt totals.</>}
        {summary.limited && " The reporting limit was reached. Counts cover the newest scanned records."}
      </p>
      {(!report.auditAvailable || !report.eventsAvailable) && <p role="alert" className="font-semibold">Some evidence sources could not be read.</p>}
    </div>

    <dl aria-label="Security indicators for the displayed UTC window" className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border xl:grid-cols-4">
      <Indicator label="Failed logins" value={summary.failedLogins}>Recorded password rejections. MFA failures appear in activity.</Indicator>
      <Indicator label="Rate-limited requests" value={summary.rateLimited}>Observed limiter rejections in the selected window.</Indicator>
      <Indicator label="Security alerts" value={summary.first ? summary.alertCount : null}>Threshold breaches backed by count-bearing evidence.</Indicator>
      <Indicator label="Administrative actions" value={report.auditAvailable ? summary.actions : null}>Committed privileged changes in the selected window.</Indicator>
    </dl>

    <div className={split}>
      <AdminPanel title="Authentication activity" description="Recorded sign-ins, failed challenges and limiter rejections. Gaps indicate intervals with no usable observations.">
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">{trend.map(item =>
          <li key={item.label} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-sm" style={{ background: item.color }} />{item.label}</li>)}</ul>
        <AnalyticsChart title="Authentication activity" days={summary.chart.map(bin => new Date(bin.from).toISOString())}
          intervals={summary.chart.map(bin => ({ label: `${dateTime.format(bin.from)} to ${dateTime.format(bin.to)} UTC`,
            tick: query.end - query.start <= 86_400_000 ? clock.format(bin.from) : ticks.format(bin.from) }))}
          kind="bars" series={trend} empty="No chartable authentication observations in this period." />
      </AdminPanel>
      <AdminPanel title="Security alerts" description="Verified threshold breaches in completed five-minute intervals.">
        {summary.alerts.length ? <ul className="-my-2 divide-y divide-border">
          {summary.alerts.map(alert => <li key={`${alert.kind}-${alert.first}`} className="py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2"><p className="text-sm font-semibold">{alert.title}</p><span className="text-xs font-semibold text-[#815020]">{alert.severity}</span></div>
            <p className="mt-1 text-xs leading-5 text-muted">{count.format(alert.count)} observed. Rule requires {alert.rule}.</p>
            <p className="text-xs leading-5 text-muted">Window <Stamp time={alert.first} /> to <Stamp time={alert.end} />.<br />Last observed <Stamp time={alert.last} />.</p>
            <Link href={href(query, alert.title === "Sustained password failures" ? { kind: "", category: "authentication", outcome: "failure", actor: "", q: "" } :
              { kind: alert.kind, category: "all", outcome: "", actor: alert.kind === "access-denied" ? "admin" : "", q: "" }, "#audit-history")}
              prefetch={false} className={auditLink}>Inspect evidence</Link>
          </li>)}
        </ul> : <Feedback>{summary.first ? "No verified alert conditions met the displayed thresholds." : "Counted evidence is required to evaluate alerts."}</Feedback>}
      </AdminPanel>
    </div>

    <AdminPanel title="Recent administrative actions" description="Committed privileged changes from the administrator audit trail.">
      {summary.recentActions.length ? <ul className="-my-2 divide-y divide-border">
        {summary.recentActions.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
          <div className="min-w-0"><p className="text-sm font-semibold">{row.label}</p>
            <p className="mt-0.5 break-words text-xs text-muted">Administrator{row.target ? ` → ${row.target.kind} ${row.target.id}` : ""}</p></div>
          <span className="text-xs text-muted"><Stamp time={row.at} /></span>
        </li>)}
      </ul> : <Feedback alert={!report.auditAvailable}>{report.auditAvailable ? "No committed privileged changes in this period." : "Administrator audit evidence could not be read."}</Feedback>}
    </AdminPanel>

    <section id="audit-history" aria-label="Security and audit explorer" className="min-w-0 scroll-mt-3">
      <AdminPanel title="Security & audit explorer" description="Newest first. Select an event to inspect its recorded evidence.">
        <div className="grid min-w-0 gap-3">
          <EvidenceFilters query={query} />
          {report.explorerPartial && <Feedback alert>{report.explorerAvailable ? "Only one evidence source could be read. Pagination is paused." : "Security and audit history could not be read. Reload to try again."}</Feedback>}
          {report.rows.length > 0 && <p className="text-xs text-muted sm:hidden">Swipe to see actor, target and outcome columns.</p>}
          {report.rows.length ? <SecurityEvidenceTable rows={report.rows} /> : report.explorerAvailable && <Feedback>
            {report.next ? "No matches in this part of the retained history. Continue to check older evidence." : "No matching security or audit events."}
          </Feedback>}
          {(query.token || report.next) && <nav aria-label="Audit pagination" className="flex flex-wrap justify-end gap-4 border-t border-border">
            {query.token && <Link href={href(query, {}, "#audit-history")} prefetch={false} className={auditLink}>First page</Link>}
            {report.next && <Link href={href(query, { cursor: report.next }, "#audit-history")} prefetch={false} className={auditLink}>Older evidence</Link>}
          </nav>}
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
    <div className={split}><SkeletonBlock className="h-56 rounded-2xl" /><SkeletonBlock className="h-32 rounded-2xl" /></div>
    <SkeletonBlock className="h-32 rounded-2xl" />
    <SkeletonBlock className="h-64 rounded-2xl" />
  </SkeletonRegion>;
}
