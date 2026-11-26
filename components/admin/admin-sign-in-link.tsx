"use client";

import { usePathname } from "next/navigation";

export function AdminSignInLink({ className, children }: { className: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return <a href={`/login?next=${encodeURIComponent(pathname)}`} className={className}>{children}</a>;
}
