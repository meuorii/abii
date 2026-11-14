import type { Key, ReactNode } from "react";
import { resolveCollectionSkeletonState } from "@/components/ui/collection-loading-state";
import { SkeletonBlock } from "@/components/ui/skeleton";

type SkeletonCollectionProps<T> = {
  /** `null` means unknown. An empty array is known-empty and produces no item placeholders. */
  items: readonly T[] | null;
  visibleLimit?: number;
  className: string;
  unknownClassName?: string;
  getKey: (item: T) => Key;
  renderItem: (item: T, index: number) => ReactNode;
};

export function UnknownCollectionPlaceholder({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`min-w-0 space-y-3 px-1 py-3 ${className}`}>
    <SkeletonBlock className="h-3 w-1/3 rounded" />
    <SkeletonBlock className="h-2.5 w-full rounded" />
    <SkeletonBlock className="h-2.5 w-2/3 rounded" />
  </div>;
}

/** Render only already-known items; unknown collections get a compact, non-item-shaped placeholder. */
export function SkeletonCollection<T>({ items, visibleLimit, className, unknownClassName = "", getKey, renderItem }: SkeletonCollectionProps<T>) {
  const state = resolveCollectionSkeletonState(items, visibleLimit);
  if (state.kind === "empty") return null;
  if (state.kind === "unknown") return <UnknownCollectionPlaceholder className={unknownClassName} />;

  return <div className={className}>{state.items.map((item, index) => <div aria-hidden="true" data-skeleton-item key={getKey(item)}>{renderItem(item, index)}</div>)}</div>;
}
