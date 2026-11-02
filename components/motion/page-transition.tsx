"use client";

import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  const entering = lastPathname.current !== pathname;

  useEffect(() => { lastPathname.current = pathname; }, [pathname]);

  return <m.div key={pathname} className="min-w-0" initial={entering ? { opacity: 0, y: 16 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>{children}</m.div>;
}
