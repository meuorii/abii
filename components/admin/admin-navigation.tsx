"use client";

import { Activity, ChartNoAxesColumnIncreasing, Headset, LayoutDashboard, Megaphone, Settings, Shield, Users } from "lucide-react";
import { workspaceNavActive, workspaceNavInactive, workspaceNavLink } from "@/components/ui/workspace-chrome";

export const adminNavigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: ChartNoAxesColumnIncreasing },
  { href: "/admin/performance", label: "Performance", icon: Activity },
  { href: "/admin/security", label: "Security", icon: Shield },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/support", label: "Support", icon: Headset },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminNavigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin navigation" className="shrink-0 space-y-1 px-3">
      {adminNavigation.map(({ href, label, icon: Icon }) => (
        // Document navigation checks authorization on every visit and avoids an RSC prefetch cache.
        <a key={href} href={href} onClick={onNavigate} aria-current={pathname === href ? "page" : undefined}
          className={`${workspaceNavLink} ${pathname === href ? workspaceNavActive : workspaceNavInactive} max-lg:min-h-11`}>
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          {label}
        </a>
      ))}
    </nav>
  );
}
