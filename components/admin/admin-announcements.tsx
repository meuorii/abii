import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { AdminEmptyState, AdminPanel } from "@/components/admin/admin-ui";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import { AnnouncementDeliveryActions, AnnouncementEditor } from "@/components/admin/announcement-editor";
import { announcementDestinations, announcementLabels, type AnnouncementState, type AnnouncementView } from "@/lib/admin/announcement-contract";
import type { AnnouncementDirectory, AnnouncementQuery } from "@/lib/admin/announcements";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F8769C]";
const primary = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#F8769C] px-3.5 text-sm font-semibold text-[#30252D] hover:bg-[#FFDBED] ${focus}`;
const link = `inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[#30252D] hover:bg-[#FFDBED] ${focus}`;
const field = `min-h-11 min-w-0 rounded-xl border border-[#FFDBED] bg-[#FFF9FC] px-3 text-base sm:text-sm ${focus}`;
const statuses: Record<AnnouncementState, string> = {
  draft: "text-[#66565F] before:border before:border-[#66565F]",
  canceled: "text-[#66565F] before:border before:border-[#66565F]",
  scheduled: "text-[#30252D] before:bg-[#FFDBED]",
  queued: "text-[#30252D] before:border before:border-[#F8769C]",
  publishing: "text-[#30252D] before:bg-[#F8769C]",
  delivered: "text-[#30252D] before:bg-[#F8769C]",
  incomplete: "text-[#30252D] before:border before:border-[#F8769C]",
  failed: "text-[#30252D] before:border before:border-[#F8769C]",
};
const tabs = [["all", "All"], ["draft", "Drafts"], ["scheduled", "Scheduled"], ["published", "Published"], ["issues", "Delivery issues"], ["canceled", "Canceled"]] as const;
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const numbers = new Intl.NumberFormat("en");

export function announcementHref(query: AnnouncementQuery, changes: Partial<AnnouncementQuery> = {}, hash = "") {
  const combined = { ...query, ...changes };
  const params = new URLSearchParams(Object.entries(combined).filter(([key, value]) =>
    value && !(key === "sort" && value === "updated") && !(key === "status" && value === "all")));
  const encoded = params.toString();
  return `/admin/announcements${encoded ? `?${encoded}` : ""}${hash}`;
}

function Stamp({ value }: { value: string }) {
  return <time dateTime={value}>{dateTime.format(new Date(value))} UTC</time>;
}
function Status({ state }: { state: AnnouncementState }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold before:size-1.5 before:shrink-0 before:rounded-full ${statuses[state]}`}>{announcementLabels[state]}</span>;
}
function Empty({ children, alert }: { children: React.ReactNode; alert?: boolean }) {
  return <p role={alert ? "alert" : undefined} className="rounded-lg border border-dashed border-border bg-[#FFF9FC] px-3.5 py-4 text-sm leading-6 text-muted">{children}</p>;
}

function Directory({ query, data }: { query: AnnouncementQuery; data: AnnouncementDirectory }) {
  return <AdminPanel title="Announcement Library" description="Browse and manage your announcements." className="admin-evidence-panel" stretch bodyClassName="flex-1">
    <div className="grid min-h-0 flex-1 content-start gap-3">
      <nav aria-label="Announcement status" className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {tabs.map(([status, label]) => <Link key={status} href={announcementHref(query, { status, page: "", id: "" }, "#announcement-list")}
          prefetch={false} aria-current={query.status === status ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-lg px-2.5 text-xs font-semibold ${focus} ${query.status === status ? "bg-[#FFDBED] text-[#30252D]" : "text-muted hover:bg-pink-soft"}`}>{label}</Link>)}
      </nav>
      <form aria-label="Filter announcements" method="get" action="/admin/announcements#announcement-list"
        className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        {query.status !== "all" && <input type="hidden" name="status" value={query.status} />}
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold">Title or announcement ID
          <input type="search" name="q" maxLength={120} defaultValue={query.q} placeholder="Title prefix or exact ID" className={field} />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold">Sort by
          <select name="sort" defaultValue={query.sort} className={field}><option value="updated">Last updated</option><option value="created">Newest created</option></select>
        </label>
        <button type="submit" className={`min-h-11 self-end rounded-xl border border-border bg-white px-3 text-sm font-semibold hover:bg-pink-soft ${focus}`}>Apply</button>
      </form>
      {!data.rows.length && <div className="grid min-h-[144px] place-items-center"><AdminEmptyState size="compact" title={query.q || query.status !== "all" ? "No matching announcements" : "No announcements yet"}
        description={query.q || query.status !== "all" ? "No announcements match these filters." : "Create a draft to get started."} /></div>}
      {(query.q || query.status !== "all") && <Link href="/admin/announcements#announcement-list" className={`${link} justify-self-start`}>Clear filters</Link>}
      {data.rows.length > 0 && <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {data.rows.map(row => {
          const date = row.committedAt ?? row.scheduledAt ?? row.updatedAt;
          const caption = row.committedAt ? "Committed" : row.scheduledAt && row.state !== "canceled" ? "Scheduled" : "Updated";
          return <li key={row.id}>
            <Link href={announcementHref(query, { id: row.id }, "#announcement-details")} prefetch={false}
              aria-current={query.id === row.id ? "true" : undefined}
              className={`grid min-w-0 gap-2 px-3.5 py-3.5 hover:bg-[#FFF9FC] sm:grid-cols-[minmax(0,1.5fr)_minmax(7rem,0.75fr)_minmax(8rem,0.85fr)] sm:items-center ${focus} focus-visible:outline-offset-[-2px] ${query.id === row.id ? "bg-[#FFDBED]" : "bg-white"}`}>
              <div className="min-w-0"><p className="break-words text-sm font-semibold">{row.title}</p>
                <p className="mt-0.5 line-clamp-1 break-words text-xs text-muted">{row.message}</p></div>
              <Status state={row.state} />
              <p className="text-xs leading-5 text-muted"><span className="font-medium">{caption}</span><br className="hidden sm:block" /> <Stamp value={date} /></p>
            </Link>
          </li>;
        })}
      </ul>}
      {(data.next || query.page) && <AdminPagination label="Announcement pages" result={`Showing ${data.rows.length} announcements`}>
        {query.page && <Link href={announcementHref(query, { page: "", id: "" }, "#announcement-list")} prefetch={false} className={link}>First page</Link>}
        {data.next && <Link href={announcementHref(query, { page: data.next, id: "" }, "#announcement-list")} prefetch={false} className={link}>Next page</Link>}
      </AdminPagination>}
    </div>
  </AdminPanel>;
}

function Details({ row, query, enabled }: { row: AnnouncementView; query: AnnouncementQuery; enabled: boolean }) {
  const editable = row.state === "draft" || row.state === "scheduled" || row.state === "canceled";
  return <section id="announcement-details" aria-label="Selected announcement" className="min-w-0 scroll-mt-4">
    <AdminPanel title="Announcement Details" className="admin-evidence-panel" stretch bodyClassName="flex-1" actions={<div className="flex gap-2"><a href={announcementHref(query, {}, "#announcement-details")} aria-label="Refresh announcement details" className={link}>Refresh</a>{editable && <Link href={announcementHref(query, { editor: "edit" })} prefetch={false} className={link}>Edit <ArrowUpRight size={14} aria-hidden="true" className="ml-1" /></Link>}</div>}>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-4">
          <div className="rounded-xl border border-[#FFDBED] bg-[#FFDBED] p-3.5"><div aria-live="polite"><Status state={row.state} /></div><h3 className="mt-1 break-words text-xl font-semibold tracking-tight">{row.title}</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{row.message}</p></div>
          <h4 className="text-sm font-semibold">Publication Information</h4><dl className="grid min-w-0 grid-cols-2 gap-3 text-xs">
            <div><dt className="font-semibold">Audience</dt><dd className="mt-1 text-muted">Verified learners</dd></div>
            <div><dt className="font-semibold">Destination</dt><dd className="mt-1 text-muted">{row.target ? announcementDestinations[row.target] : "Notification Center"}</dd></div>
            <div className="col-span-full"><dt className="font-semibold">Publication ID</dt><dd className="mt-1 break-all text-muted">{row.publicationId}</dd></div>
          </dl>
          <dl className="grid gap-1.5 border-t border-border pt-3 text-xs leading-5 text-muted">
            <div><dt className="inline font-semibold text-foreground">Created</dt>{" "}<dd className="inline"><Stamp value={row.createdAt} /></dd></div>
            {([
              [row.state === "canceled" ? "Canceled schedule" : row.committedAt && row.scheduledAt && row.scheduledAt > row.committedAt ? "Previously scheduled for" : "Scheduled for", row.scheduledAt], ["Publication committed", row.committedAt], ["Last delivery attempt", row.lastAttemptAt], ["Completed", row.completedAt],
            ] as const).map(([label, value]) => value && <div key={label}><dt className="inline font-semibold text-foreground">{label}</dt>{" "}<dd className="inline"><Stamp value={value} /></dd></div>)}
            <div><dt className="inline font-semibold text-foreground">Author</dt>{" "}<dd className="inline">{row.author === "admin:primary" ? "Administrator" : "Unknown"}</dd></div>
          </dl>
        </div>
        <div className="grid min-w-0 content-start gap-3">
          <section aria-label="Delivery Overview" className="rounded-xl border border-[#FFDBED] bg-[#FFF9FC] p-3">
            <h4 className="text-sm font-semibold">Delivery Overview</h4>
            {row.estimate && <p className="mt-1 text-xs leading-5 text-muted">{numbers.format(row.estimate.count)} estimated eligible at <Stamp value={row.estimate.calculatedAt} />.</p>}
            {row.committedAt ? <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              {([
                ["Delivered to inbox", row.delivered], ["Estimated eligible", row.estimate?.count ?? null], ["Previously completed", row.previouslyCompleted], ["Suppressed", row.suppressed],
                [row.state === "delivered" ? "Remaining" : "Remaining estimate", row.remainingEstimate],
              ] as const).map(([label, value]) => <div key={label}><dt className="font-medium text-muted">{label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value === null ? "Unavailable" : numbers.format(value)}</dd></div>)}
            </dl> : <p className="mt-2 text-xs leading-5 text-muted">Delivery has not started.</p>}
            {row.deliveryError && <p role="status" className="mt-3 border-t border-[#FFDBED] pt-2 text-xs leading-5 text-[#30252D]">
              {row.unresolved === null ? "The next batch could not be confirmed." : `${numbers.format(row.unresolved)} recipients in the unresolved batch.`} Retry resumes from the last committed batch.
            </p>}
            {row.committedAt && <p className="mt-3 text-xs leading-5 text-muted">Previously completed is included in Delivered. These totals track inbox creation.</p>}
          </section>
          <AnnouncementDeliveryActions key={row.id} row={row} enabled={enabled} />
          <dl className="grid gap-1.5 border-t border-border pt-3 text-xs leading-5 text-muted">
            <div><dt className="inline font-semibold text-foreground">Latest admin action</dt>{" "}<dd className="inline">{row.lastAction}</dd></div>
            {row.attemptCount > 0 && <div><dt className="inline font-semibold text-foreground">Delivery runs</dt>{" "}<dd className="inline">{row.attemptCount} · {row.retries} manual retries</dd></div>}
          </dl>
        </div>
      </div>
    </AdminPanel>
  </section>;
}

function DetailsEmpty() {
  return <section aria-label="Announcement Details" className="hidden min-w-0 xl:block">
    <AdminPanel title="Announcement Details" stretch bodyClassName="flex-1">
      <div className="flex flex-1 items-center justify-center">
        <AdminEmptyState icon="megaphone" title="No announcement selected" description="Select an announcement from the library to view its publication and delivery details." />
      </div>
    </AdminPanel>
  </section>;
}

export function AdminAnnouncements({ query, data, enabled }: { query: AnnouncementQuery; data: AnnouncementDirectory; enabled: boolean }) {
  const back = announcementHref(query, { editor: "" });
  if (query.editor === "new" || (query.editor === "edit" && data.selected &&
    ["draft", "scheduled", "canceled"].includes(data.selected.state))) {
    return <AnnouncementEditor initial={query.editor === "edit" ? data.selected : null} deliveryEnabled={enabled} back={back} />;
  }
  return <section aria-labelledby="announcement-management" className="grid min-w-0 gap-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="announcement-management" className="text-xl font-semibold tracking-tight sm:text-2xl">Announcement Management</h2><p className="mt-1 text-sm text-muted">Create, schedule and manage platform updates.</p></div>
      <Link href={announcementHref(query, { editor: "new", id: "" })} prefetch={false} className={primary}><Plus size={16} aria-hidden="true" /> New announcement</Link>
    </header>
    {!enabled && <p className="rounded-lg border border-border bg-[#FFDBED] px-3.5 py-2.5 text-sm text-muted">Delivery is disabled for this deployment. Drafts can still be saved.</p>}
    <dl aria-label="Announcement totals" className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
      {([
        ["Drafts", data.counts.drafts, "Saved and editable"],
        ["Scheduled", data.counts.scheduled, "Waiting for publication time"],
        ["Published", data.counts.published, "Committed for publication"],
        ["Delivery issues", data.counts.issues, "Failed or incomplete"],
      ] as const).map(([label, value, description]) => <div key={label} className={`min-h-[136px] min-w-0 rounded-xl border border-[#FFDBED] px-3.5 py-3.5 sm:px-5 ${label === "Published" ? "bg-[#FFDBED]" : "bg-white"}`}>
        <dt className="text-sm font-semibold">{label}</dt>
        <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{numbers.format(value)}</dd>
        <dd className="mt-1 text-xs leading-5 text-muted">{description}</dd>
      </div>)}
    </dl>
    {query.id && !data.selected && <Empty alert>The selected announcement is unavailable.</Empty>}
    {query.editor === "edit" && data.selected && <Empty alert>This announcement is no longer editable.</Empty>}
    <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.27fr)_minmax(0,1fr)]">
      <section id="announcement-list" aria-label="Announcements directory" className="min-w-0 scroll-mt-4">
        <Directory key={`${query.q}-${query.sort}-${query.status}`} data={data} query={query} />
      </section>
      {data.selected ? <Details row={data.selected} query={query} enabled={enabled} /> : <DetailsEmpty />}
    </div>
  </section>;
}

export function AnnouncementsUnavailable({ message }: { message: string }) {
  return <div className="grid gap-3">
    <h2 className="text-xl font-semibold">Announcement management</h2>
    <Empty alert>{message}</Empty>
    <Link href="/admin/announcements" className={`${link} justify-self-start`}>Return to announcements</Link>
  </div>;
}

export function AnnouncementsSkeleton() {
  return <SkeletonRegion label="Loading announcements" className="grid min-w-0 gap-4">
    <SkeletonBlock className="h-10 w-64 max-w-full rounded-lg" />
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{[0, 1, 2, 3].map(index => <SkeletonBlock key={index} className="h-24 rounded-xl" />)}</div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.27fr)_minmax(0,1fr)]"><SkeletonBlock className="h-[520px] rounded-2xl" /><SkeletonBlock className="h-[520px] rounded-2xl" /></div>
  </SkeletonRegion>;
}

export function AnnouncementEditorSkeleton() {
  return <SkeletonRegion label="Loading announcement editor" className="grid min-w-0 gap-4">
    <SkeletonBlock className="h-12 w-72 max-w-full rounded-lg" />
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <SkeletonBlock className="h-[360px] rounded-2xl" />
      <div className="grid min-w-0 gap-4"><SkeletonBlock className="h-40 rounded-2xl" /><SkeletonBlock className="h-48 rounded-2xl" /></div>
    </div>
    <SkeletonBlock className="h-16 rounded-xl" />
  </SkeletonRegion>;
}
