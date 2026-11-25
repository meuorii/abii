import type { ReactNode } from "react";
import { CircleAlert, Inbox, Megaphone } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";

type Availability =
  | { kind: "loading" }
  | { kind: "empty" | "unavailable" | "error"; message: string; action?: ReactNode };

export function AdminFeedback({ state }: { state: Availability }) {
  if (state.kind === "loading") {
    return <SkeletonRegion label="Loading data" className="space-y-3 py-4"><SkeletonBlock className="h-4 w-2/3 rounded" /><SkeletonBlock className="h-4 w-1/2 rounded" /></SkeletonRegion>;
  }
  return (
    <div className="space-y-2 text-sm leading-6 text-muted" role={state.kind === "error" ? "alert" : undefined}>
      <p>{state.message}</p>
      {state.action}
    </div>
  );
}

type Metric =
  | { kind: "ready"; value: string | number; comparison?: string; status?: string }
  | Availability;

export function MetricCard({ label, metric, expanded = false }: { label: string; metric: Metric; expanded?: boolean }) {
  return (
    <Card padding={expanded ? "md" : "sm"} className="min-w-0">
      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
      {metric.kind === "ready" ? (
        <div className="mt-2 space-y-1">
          <p className={expanded ? "text-3xl font-semibold tabular-nums" : "text-2xl font-semibold tabular-nums"}>{metric.value}</p>
          {metric.comparison && <p className="text-sm text-muted">{metric.comparison}</p>}
          {metric.status && <p className="text-sm text-[#665C65]">{metric.status}</p>}
        </div>
      ) : <div className="mt-2"><AdminFeedback state={metric} /></div>}
    </Card>
  );
}

export function AdminPanel({ title, description, actions, children, className = "", stretch = false, bodyClassName = "", footer }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string;
  stretch?: boolean; bodyClassName?: string; footer?: ReactNode;
}) {
  return (
    <Card padding="none" data-admin-panel="true" data-admin-stretch={stretch || undefined} className={`admin-panel min-w-0 overflow-hidden rounded-2xl ${stretch ? "flex h-full flex-col" : ""} ${className}`}>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[#FFDBED] px-4 py-3 sm:px-5">
        <div><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</div>
        {actions}
      </div>
      <div className={`px-4 py-3.5 sm:px-5 sm:py-4 ${stretch ? "flex min-h-0 flex-1 flex-col" : ""} ${bodyClassName}`}>{children}</div>
      {footer && <div className="mt-auto shrink-0 border-t border-[#FFDBED] px-4 py-3 sm:px-5">{footer}</div>}
    </Card>
  );
}

export function AdminEmptyState({ title, description, icon = "inbox", action, size = "panel" }: {
  title: string; description?: string; icon?: "inbox" | "alert" | "megaphone"; action?: ReactNode; size?: "visualization" | "panel" | "compact";
}) {
  const Icon = icon === "alert" ? CircleAlert : icon === "megaphone" ? Megaphone : Inbox;
  const height = size === "visualization" ? "min-h-[220px] sm:min-h-[240px]" : size === "compact" ? "min-h-[96px]" : "min-h-[160px]";
  return <div className={`grid ${height} flex-1 place-content-center justify-items-center gap-2 rounded-xl bg-[#FFF9FC] px-5 py-6 text-center`}>
    <Icon aria-hidden="true" className="text-[#F8769C]" size={22} />
    <h3 className="text-sm font-semibold text-[#30252D]">{title}</h3>
    {description && <p className="max-w-prose text-sm leading-6 text-[#66565F]">{description}</p>}
    {action}
  </div>;
}

export function ChartPanel({ title, description, actions, content }: {
  title: string; description?: string; actions?: ReactNode;
  content: { kind: "ready"; chart: ReactNode } | Availability;
}) {
  return (
    <AdminPanel title={title} description={description} actions={actions} stretch bodyClassName="flex-1">
      <div className="grid min-h-[220px] flex-1 content-center rounded-xl bg-[#FFF9FC] px-4 py-3 sm:min-h-[240px]">
        {content.kind === "ready" ? content.chart : <AdminFeedback state={content} />}
      </div>
    </AdminPanel>
  );
}

type FilterOption = { value: string; label: string };
export function AdminFilters({ action, resetHref, search, selections = [] }: {
  action: string; resetHref?: string; search?: { label: string; value?: string };
  selections?: { name: string; label: string; value?: string; options: readonly FilterOption[] }[];
}) {
  const field = "min-h-11 max-w-full rounded-lg border border-[#E7D8DF] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#AF3860]";
  return (
    <form action={action} method="get" aria-label="Filter results" className="flex flex-wrap items-end gap-3">
      {search && <label className="grid min-w-0 gap-1 text-sm font-medium">{search.label}<input className={field} type="search" name="q" defaultValue={search.value} /></label>}
      {selections.map(selection => <label key={selection.name} className="grid min-w-0 gap-1 text-sm font-medium">{selection.label}
        <select className={field} name={selection.name} defaultValue={selection.value}>{selection.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      </label>)}
      <Button type="submit" variant="secondary">Apply filters</Button>
      {resetHref && <a href={resetHref} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[#91314E] underline focus-visible:outline-2">Reset filters</a>}
    </form>
  );
}

type Column<Row> = { key: string; heading: string; align?: "start" | "end"; cell: (row: Row) => ReactNode };

export function AdminTable<Row>({ title, columns, rowKey, content, rowActions, pagination }: {
  title: string; columns: readonly Column<Row>[]; rowKey: (row: Row) => string;
  content: { kind: "ready"; rows: readonly Row[] } | Availability;
  rowActions?: (row: Row) => ReactNode; pagination?: ReactNode;
}) {
  return (
    <AdminPanel title={title}>
      <div role="region" aria-label={title} tabIndex={0} className="max-w-full overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-[#AF3860]">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-[#FFF9FC]"><tr>
              {columns.map(column => <th key={column.key} scope="col" className={column.align === "end" ? "px-3 py-2 text-end" : "px-3 py-2 text-start"}>{column.heading}</th>)}
              {rowActions && <th scope="col" className="px-3 py-2 text-end">Actions</th>}
            </tr></thead>
            <tbody>{content.kind === "ready" && content.rows.length ? content.rows.map(row => <tr key={rowKey(row)} className="border-b border-[#FFDBED]">
                {columns.map(column => <td key={column.key} className={column.align === "end" ? "px-3 py-2 text-end" : "px-3 py-2"}>{column.cell(row)}</td>)}
                {rowActions && <td className="px-3 py-2 text-end">{rowActions(row)}</td>}
              </tr>) : <tr><td colSpan={columns.length + (rowActions ? 1 : 0)} className="h-40 px-3 text-center">
                {content.kind === "ready" ? <AdminEmptyState size="compact" title="No results" description="No records match this view." /> : <AdminFeedback state={content} />}
              </td></tr>}</tbody>
          </table>
      </div>
      {content.kind === "ready" && content.rows.length > 0 && pagination && <div className="mt-4">{pagination}</div>}
    </AdminPanel>
  );
}
