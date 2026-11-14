export type CollectionSkeletonState<T> =
  | { kind: "unknown" }
  | { kind: "empty" }
  | { kind: "known"; items: readonly T[] };

/** Classifies only data already held by the caller; it never fetches or infers a count. */
export function resolveCollectionSkeletonState<T>(items: readonly T[] | null, visibleLimit?: number): CollectionSkeletonState<T> {
  if (items === null) return { kind: "unknown" };
  if (items.length === 0) return { kind: "empty" };
  const limit = visibleLimit === undefined ? items.length : Math.max(0, Math.floor(visibleLimit));
  return { kind: "known", items: items.slice(0, limit) };
}

/** Use a skeleton only before a collection has loaded and while no error is available. */
export function getCollectionLoadingPresentation(hasLoadedSuccessfully: boolean, hasError: boolean) {
  return hasLoadedSuccessfully || hasError ? "content" as const : "initial-skeleton" as const;
}

export function isCollectionScopeLoaded(loadedScope: string | null, currentScope: string) {
  return loadedScope === currentScope;
}

