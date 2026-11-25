import type { ReactNode } from "react";
import { MascotDisplay } from "./mascot-display";

export function EmptyState({
  title = "Nothing here yet",
  message = "Add your first item and it will show up here.",
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <MascotDisplay mood="empty" />
      <h2 className="mt-5 text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export function LoadingState({ message = "Getting things ready…" }: { message?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 rounded-2xl bg-surface-hover px-5 py-6 text-sm font-medium text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-secondary-surface border-t-primary" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorMessage({
  title = "Something went wrong",
  message = "Please try again in a moment.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div role="alert" className="rounded-2xl border border-error/30 bg-error-bg px-4 py-4">
      <p className="font-bold text-error-text">{title}</p>
      <p className="mt-1 text-sm leading-6 text-error-text">{message}</p>
    </div>
  );
}
