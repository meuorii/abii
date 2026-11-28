
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageTransition } from "@/components/motion/page-transition";
import { ScrollRootProvider } from "@/components/motion/scroll-root-context";
import { LayoutDashboard, BookOpen, RotateCcw, ChartNoAxesColumn, Settings, ChevronDown, Award } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationProvider } from "@/components/notifications/notification-context";
import {
  WorkspaceBrandMark, WorkspaceSidebarFooter, workspaceBrandSubtitle, workspaceHeader,
  workspaceAccountButton, workspaceAvatar, workspaceAccountName, workspaceChevron, workspaceAccountPanel,
  workspaceNavLink, workspaceNavActive, workspaceNavInactive,
} from "@/components/ui/workspace-chrome";

const desktopNavigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "My Subjects", icon: BookOpen },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/badges", label: "Badges", icon: Award },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileNavigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/badges", label: "Badges", icon: Award },
  { href: "/settings", label: "Settings", icon: Settings },
];

type AppShellProps = {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  userId: string;
  userName: string;
  profileImage: string;
  studyTimezone: string;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label="Abii dashboard"
      className={`flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2 ${
        compact ? "gap-2" : "flex-col items-start gap-1"
      }`}
    >
      <WorkspaceBrandMark alt="Abii mascot" />

      {!compact && (
        <span className={workspaceBrandSubtitle}>
          Learn a little, remember a lot.
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children, userId, userName: initialUserName, profileImage: initialProfileImage, studyTimezone }: AppShellProps) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [userName, setUserName] = useState(initialUserName);
  const [profileImage, setProfileImage] = useState(initialProfileImage);

  useEffect(() => {
    const syncProfileImage = (event: Event) => {
      const image = (event as CustomEvent<{ profileImage?: string }>).detail?.profileImage;
      if (typeof image === "string") setProfileImage(image);
    };
    const syncProfileName = (event: Event) => {
      const name = (event as CustomEvent<{ name?: string }>).detail?.name;
      if (typeof name === "string" && name.trim()) setUserName(name.trim());
    };
    window.addEventListener("abii-profile-image-updated", syncProfileImage);
    window.addEventListener("abii-profile-name-updated", syncProfileName);
    return () => {
      window.removeEventListener("abii-profile-image-updated", syncProfileImage);
      window.removeEventListener("abii-profile-name-updated", syncProfileName);
    };
  }, [userId]);

  useEffect(() => {
    setProfileMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [profileMenuOpen]);
  useEffect(() => {
    const close = () => setProfileMenuOpen(false);
    window.addEventListener("abii:close-profile-menu", close);
    return () => window.removeEventListener("abii:close-profile-menu", close);
  }, []);

  const firstLetter = userName?.trim().charAt(0).toUpperCase() || "A";

  return (
    <NotificationProvider userId={userId} studyTimezone={studyTimezone}>
    <div className="learner-theme relative min-h-dvh overflow-hidden bg-dashboard-frame p-0 text-foreground sm:p-3 lg:p-4">
      <a
        href="#authenticated-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary focus:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-hover focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex h-dvh min-h-0 max-w-[1600px] overflow-hidden bg-background sm:h-[calc(100dvh-24px)] sm:rounded-[20px] sm:border sm:border-border sm:shadow-[0_10px_40px_rgba(65,37,48,0.07)] lg:h-[calc(100dvh-32px)]">
        <aside className="relative hidden w-[220px] shrink-0 flex-col border-r border-border bg-background lg:flex">
          <div className="px-5 pb-7 pt-7">
            <Brand />
          </div>

          <nav
            aria-label="Main navigation"
            className="flex-1 space-y-1 px-3"
          >
            {desktopNavigation.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${workspaceNavLink} ${active ? workspaceNavActive : workspaceNavInactive}`}
                >
                  <item.icon aria-hidden="true" className="h-5 w-5" />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <WorkspaceSidebarFooter />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className={workspaceHeader}>
            <div className="lg:hidden">
              <Brand compact />
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <NotificationBell />

              <span
                className="hidden h-7 w-px bg-border sm:block"
                aria-hidden="true"
              />

              <div className="relative">
                <button
                  type="button"
                  aria-label="Open account menu"
                  aria-expanded={profileMenuOpen}
                  onClick={() => { window.dispatchEvent(new Event("abii:close-notification-popover")); setProfileMenuOpen((open) => !open); }}
                  className={workspaceAccountButton}
                >
                  <span className={workspaceAvatar}>
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      firstLetter
                    )}
                  </span>

                  <span className={workspaceAccountName}>
                    {userName || "Abii learner"}
                  </span>

                  <ChevronDown aria-hidden="true" className={workspaceChevron} />
                </button>

                {profileMenuOpen && (
                  <div className={workspaceAccountPanel}>
                    <Link
                      href="/profile"
                      aria-current={pathname === "/profile" ? "page" : undefined}
                      onClick={() => setProfileMenuOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${pathname === "/profile" ? "bg-secondary-surface font-semibold text-primary" : "text-muted hover:bg-background"}`}
                    >
                      Profile
                    </Link>

                    <div className="px-1 pt-1">
                      <LogoutButton />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main
            ref={mainRef}
            id="authenticated-main"
            tabIndex={-1}
            data-authenticated-motion
            aria-label="Application content"
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background pb-20 lg:pb-0"
          >
            <ScrollRootProvider rootRef={mainRef}>
              <PageTransition>{children}</PageTransition>
            </ScrollRootProvider>
          </main>

          <nav
            aria-label="Mobile bottom navigation"
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-background/95 px-1 pb-[max(env(safe-area-inset-bottom),4px)] pt-1 backdrop-blur lg:hidden"
          >
            {mobileNavigation.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-hover ${
                    active
                      ? "bg-secondary-surface text-primary [&>svg]:text-primary"
                      : "text-muted hover:bg-background hover:text-primary"
                  }`}
                >
                  <item.icon aria-hidden="true" className="h-5 w-5" />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
    </NotificationProvider>
  );
}
