"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/subjects", label: "Subjects", icon: "▤" },
  { href: "/favorites", label: "Favorites", icon: "♡" },
  { href: "/progress", label: "Progress", icon: "↗" },
  { href: "/profile", label: "Profile", icon: "◉" },
];

type AppShellProps = {
  children: React.ReactNode;
  pageTitle: string;
  pageDescription?: string;
  userName?: string;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  pageTitle,
  pageDescription,
  userName,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[#FFF7F9] text-[#2F2930]">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#E8E2E5] bg-white lg:flex">
        <Link
          href="/dashboard"
          className="flex h-[84px] items-center gap-3 border-b border-[#F0E8EC] px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E9577D]"
          aria-label="Abii dashboard"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF7F9] text-2xl text-[#E9577D]">♡</span>
          <span className="text-2xl font-extrabold tracking-[-0.07em]">
            abii<span className="text-[#FF6F96]">.</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9A8C94]">Workspace</p>
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] ${
                  active
                    ? "bg-[#FFE8EF] text-[#B83F68]"
                    : "text-[#756B72] hover:bg-[#FFF7F9] hover:text-[#2F2930]"
                }`}
              >
                <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center text-lg">{item.icon}</span>
                <span>{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#E9577D]" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#F0E8EC] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#FFF7F9] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFE8EF] text-sm font-bold text-[#B83F68]">
              {userName?.trim().charAt(0).toUpperCase() || "A"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName || "Abii learner"}</p>
              <p className="text-xs text-[#8C7F87]">Your study space</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex min-h-[72px] shrink-0 items-center justify-between border-b border-[#E8E2E5] bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden" aria-label="Abii dashboard">
              <span className="text-xl text-[#E9577D]">♡</span>
              <span className="text-xl font-extrabold tracking-[-0.07em]">abii<span className="text-[#FF6F96]">.</span></span>
            </Link>
            <div className="hidden min-w-0 lg:block">
              <h1 className="truncate text-lg font-bold">{pageTitle}</h1>
              {pageDescription && <p className="mt-0.5 truncate text-xs text-[#8C7F87]">{pageDescription}</p>}
            </div>
            <div className="min-w-0 lg:hidden">
              <h1 className="truncate text-base font-bold">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-[#756B72] sm:block">A little progress adds up.</span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8E2E5] text-[#756B72] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] lg:hidden"
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span aria-hidden="true" className="text-xl">{mobileMenuOpen ? "×" : "☰"}</span>
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <nav aria-label="Mobile navigation" className="border-b border-[#E8E2E5] bg-white px-3 py-3 lg:hidden">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {navigation.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] ${
                      active ? "bg-[#FFE8EF] text-[#B83F68]" : "text-[#756B72] hover:bg-[#FFF7F9]"
                    }`}
                  >
                    <span aria-hidden="true">{item.icon}</span>{item.label}
                  </Link>
                );
              })}
              <div className="col-span-2 sm:col-span-3">
                <LogoutButton />
              </div>
            </div>
          </nav>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <nav aria-label="Quick navigation" className="grid shrink-0 grid-cols-5 border-t border-[#E8E2E5] bg-white px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 lg:hidden">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E9577D] ${
                  active ? "text-[#C94B76]" : "text-[#8C7F87] hover:bg-[#FFF7F9]"
                }`}
              >
                <span aria-hidden="true" className="text-xl leading-6">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
