import type { ReactNode } from "react";

/**
 * Keeps a stable route-content boundary without animating the entire page.
 * Individual heroes and viewport reveals own their entrances, avoiding a
 * duplicate page fade and allowing below-the-fold content to wait for scroll.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
