import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type StudyStatistic = { label: string; value: number | string; detail?: string; icon?: LucideIcon; progress?: number; supplementary?: ReactNode; headerAction?: ReactNode };

export function StudyStatistics({ items, columns = 4, label = "Study statistics", variant = "default" }: { items: StudyStatistic[]; columns?: 2 | 3 | 4; label?: string; variant?: "default" | "topic-detail" }) {
  const topicDetail = variant === "topic-detail";
  const columnClass = columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3 max-[380px]:grid-cols-2" : "grid-cols-2 sm:grid-cols-4";
  const tabletClass = columns === 4 ? "" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return <section aria-label={label} data-testid="study-statistics" className={`grid ${topicDetail ? "grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" : `${columnClass} ${tabletClass} gap-3 sm:gap-4`}`}>
    {items.map(({ label: title, value, detail, icon: Icon, progress, supplementary, headerAction }) => <article key={title} className={topicDetail ? "h-full min-w-0 rounded-2xl border border-border bg-surface p-3 sm:p-4" : `h-full min-w-0 rounded-2xl border border-border bg-surface p-3 sm:p-4 ${supplementary ? "flex flex-col items-stretch gap-2" : "flex min-h-[88px] items-center gap-3 sm:min-h-28"}`}>
      {topicDetail ? <div className="flex h-full min-w-0 flex-col">
        <div className="flex min-h-8 min-w-0 items-center justify-between gap-2"><p className="min-w-0 break-words text-xs font-medium leading-4 text-muted">{title}</p>{headerAction ?? (Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />)}</div>
        <p className="mt-2 break-words text-2xl font-bold leading-7 text-foreground lg:text-[28px] lg:leading-9">{value}</p>
        {detail && <p className="mt-1 break-words text-xs text-muted">{detail}</p>}
        {progress !== undefined && <div role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progress))} className="mt-2 h-2 overflow-hidden rounded-full bg-secondary-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}
        {supplementary}
      </div> : <>
        {Icon && <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-surface text-primary"><Icon className="h-5 w-5" /></span>}
        <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted">{title}</p><p className="mt-1 break-words text-xl font-bold leading-tight text-foreground sm:text-2xl">{value}</p>{progress !== undefined && <div role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progress))} className="mt-2 h-2 overflow-hidden rounded-full bg-secondary-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}{detail && <p className="mt-1 text-xs text-muted">{detail}</p>}{supplementary}</div>
      </>}
    </article>)}
  </section>;
}
