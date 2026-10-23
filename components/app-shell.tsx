
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { LayoutDashboard, BookOpen, RotateCcw, ChartNoAxesColumn, Settings, Bell, ChevronDown } from "lucide-react";

const desktopNavigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "My Subjects", icon: BookOpen },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileNavigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/settings", label: "Settings", icon: Settings },
];

type AppShellProps = {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  userName?: string;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label="Abii dashboard"
      className={`flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 ${
        compact ? "gap-2" : "flex-col items-start gap-1"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFE8EF]">
          <Image
            src="/abii-head.png"
            alt="Abii mascot"
            width={40}
            height={40}
            priority
            className="h-full w-full object-contain"
          />
        </span>

        <span className="text-[29px] font-extrabold leading-none tracking-[-0.07em] text-[#E9577D]">
          Abii
        </span>
      </span>

      {!compact && (
        <span className="pl-[48px] text-[10px] leading-4 text-[#8B7C84]">
          Learn a little, remember a lot.
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children, userName }: AppShellProps) {
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileImage, setProfileImage] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/account/profile-picture")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.profileImage) {
          setProfileImage(data.profileImage);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const firstLetter = userName?.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="min-h-dvh overflow-hidden bg-[#FFF7F9] p-0 text-[#2F2930] sm:p-3 lg:p-4">
      <div className="mx-auto flex h-dvh min-h-0 max-w-[1600px] overflow-hidden bg-white sm:h-[calc(100dvh-24px)] sm:rounded-[20px] sm:border sm:border-[#F0E5E9] sm:shadow-[0_10px_40px_rgba(65,37,48,0.07)] lg:h-[calc(100dvh-32px)]">
        <aside className="relative hidden w-[220px] shrink-0 flex-col border-r border-[#F0E8EC] bg-[#FFFCFD] lg:flex">
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
                  className={`flex min-h-[43px] items-center gap-3 rounded-[10px] px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] ${
                    active
                      ? "bg-[#FFE8EF] text-[#E9577D]"
                      : "text-[#6F8293] hover:bg-[#FFF4F7] hover:text-[#2F2930]"
                  }`}
                >
                  <item.icon aria-hidden="true" className="h-5 w-5" />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pointer-events-none relative mt-auto h-[110px] overflow-hidden px-5 pb-5 pt-2">
            <p className="relative z-10 text-[11px] leading-[1.65] text-[#8B9BAA]">
              <span className="mb-1 block text-base leading-none text-[#FF9FBA]">
                ♥
              </span>
              Small steps,
              <br />
              big progress!
            </p>

            <div className="absolute -bottom-8 -left-5 h-20 w-40 rounded-[50%] bg-[#FFF0F5]" />
            <div className="absolute -bottom-10 left-16 h-20 w-28 rounded-[50%] bg-[#FFF0F5]" />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="relative z-20 flex h-[76px] shrink-0 items-center justify-between border-b border-[#F4EDF0] bg-white px-4 sm:px-6 lg:justify-end lg:px-8">
            <div className="lg:hidden">
              <Brand compact />
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-[21px] text-[#708397] transition-colors hover:bg-[#FFF4F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"
              >
                <Bell aria-hidden="true" className="h-5 w-5" />
                <span className="absolute right-[7px] top-[6px] h-[6px] w-[6px] rounded-full bg-[#FF6F96] ring-2 ring-white" />
              </button>

              <span
                className="hidden h-7 w-px bg-[#E8E2E5] sm:block"
                aria-hidden="true"
              />

              <div className="relative">
                <button
                  type="button"
                  aria-label="Open account menu"
                  aria-expanded={profileMenuOpen}
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="flex min-h-10 items-center gap-2.5 rounded-full px-1.5 py-1 text-left transition-colors hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFE0E9] text-sm font-semibold text-[#D94E7B]">
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

                  <span className="hidden max-w-[150px] truncate text-xs font-medium text-[#657B8E] sm:block">
                    {userName || "Abii learner"}
                  </span>

                  <ChevronDown aria-hidden="true" className="hidden h-4 w-4 text-[#8292A0] sm:block" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#E8E2E5] bg-white p-2 shadow-lg">
                    <Link
                      href="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-[#756B72] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"
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
            aria-label="Dashboard content"
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white pb-20 lg:pb-0"
          >
            {children}
          </main>

          <nav
            aria-label="Mobile bottom navigation"
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#E8E2E5] bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),4px)] pt-1 backdrop-blur lg:hidden"
          >
            {mobileNavigation.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E9577D] ${
                    active
                      ? "text-[#E9577D]"
                      : "text-[#7F91A1] hover:bg-[#FFF7F9]"
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
  );
}
