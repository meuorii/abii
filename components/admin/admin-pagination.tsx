import type { ReactNode } from "react";

export function AdminPagination({ label, result, children }: { label: string; result: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
    <p aria-live="polite" className="text-muted tabular-nums">{result}</p>
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">{children}</nav>
  </div>;
}
