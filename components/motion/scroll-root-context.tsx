"use client";

import { createContext, useContext, type ReactNode, type RefObject } from "react";

type ScrollRoot = RefObject<HTMLElement | null> | null;
const ScrollRootContext = createContext<ScrollRoot>(null);

export function ScrollRootProvider({ rootRef, children }: { rootRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  return <ScrollRootContext.Provider value={rootRef}>{children}</ScrollRootContext.Provider>;
}

export function useScrollRoot() {
  return useContext(ScrollRootContext);
}
