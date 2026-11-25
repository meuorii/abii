"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  WorkspaceBrandMark, WorkspaceSidebarFooter, workspaceBrandSubtitle, workspaceHeader,
  workspaceAccountButton, workspaceAvatar, workspaceAccountName, workspaceChevron, workspaceAccountPanel,
} from "@/components/ui/workspace-chrome";
import { AdminNavigation } from "./admin-navigation";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-active";

export function AdminShell({ name, children }: { name: string; children: ReactNode }) {
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const openDrawer = useRef<HTMLButtonElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const signOutButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() || "A";

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) drawer.current?.close(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    desktop.addEventListener("change", closeOnDesktop);
    window.addEventListener("pageshow", restore);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    signOutButton.current?.focus();
    function dismiss(event: PointerEvent) {
      if (!account.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [menuOpen]);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error();
      window.location.replace("/login");
    } catch {
      setError("Sign-out could not be confirmed. Try again.");
      setBusy(false);
      signOutButton.current?.focus();
    }
  }

  return (
    <div className="admin-shell h-dvh overflow-hidden text-foreground sm:p-3 lg:p-4">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-40 focus:rounded-lg focus:bg-white focus:p-3">Skip to main content</a>
      <div className="admin-shell__frame mx-auto flex h-full max-w-[1600px] overflow-hidden sm:rounded-[20px] sm:border sm:shadow-[0_10px_40px_rgba(65,37,48,0.07)]">
        <aside className="admin-shell__sidebar hidden w-[220px] shrink-0 flex-col overflow-y-auto border-r lg:flex">
          <div className="grid shrink-0 justify-items-start gap-1 px-5 py-7">
            <WorkspaceBrandMark />
            <p className={`min-h-8 ${workspaceBrandSubtitle}`}>Administration</p>
          </div>
          <AdminNavigation pathname={pathname} />
          <WorkspaceSidebarFooter className="shrink-0" />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className={`${workspaceHeader} admin-shell__header`}>
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <button ref={openDrawer} type="button" aria-label="Open admin navigation" aria-expanded={drawerOpen} aria-controls="admin-drawer"
                className={`grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-pink-soft ${focusRing}`}
                onClick={() => { drawer.current?.showModal(); setDrawerOpen(true); }}>
                <Menu size={21} aria-hidden="true" />
              </button>
              <WorkspaceBrandMark />
            </div>

            <div ref={account} className="relative min-w-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}
              onKeyDown={event => { if (event.key === "Escape" && menuOpen) { event.stopPropagation(); setMenuOpen(false); accountButton.current?.focus(); } }}>
              <button ref={accountButton} type="button" aria-label="Account menu" aria-expanded={menuOpen} aria-controls="admin-account"
                onClick={() => setMenuOpen(open => !open)} className={`${workspaceAccountButton} max-sm:min-h-11`}>
                <span aria-hidden="true" className={workspaceAvatar}>{initial}</span>
                <span className={workspaceAccountName}>{name}</span>
                <ChevronDown aria-hidden="true" className={workspaceChevron} />
              </button>
              <div id="admin-account" hidden={!menuOpen} className={workspaceAccountPanel}>
                <div className="border-b border-[#F0E5E9] px-3 py-2">
                  <p className="break-words text-sm font-semibold">{name}</p><p className="text-xs text-[#665C65]">Administrator</p>
                </div>
                <Button ref={signOutButton} variant="ghost" className="mt-1 w-full justify-start" aria-disabled={busy} onClick={() => void signOut()}>
                  <LogOut size={16} aria-hidden="true" /> {busy ? "Signing out…" : "Sign out"}
                </Button>
                {error && <p role="alert" className="px-3 py-2 text-sm text-[#8B273F]">{error}</p>}
              </div>
            </div>
          </header>

          <main id="admin-main" tabIndex={-1} data-authenticated-motion className="admin-shell__workspace min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain outline-offset-[-2px]">
            <div className="mx-auto w-full max-w-[1536px] px-4 py-4 sm:px-6 sm:py-6 lg:pt-5 lg:pb-8">{children}</div>
          </main>
        </div>
      </div>

      <dialog ref={drawer} id="admin-drawer" aria-labelledby="admin-drawer-title"
        onClose={() => { setDrawerOpen(false); if (openDrawer.current?.offsetWidth) openDrawer.current.focus(); }}
        onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-[#30232B]/40">
        <div className="admin-shell__sidebar h-full w-[min(290px,88vw)] overflow-y-auto overscroll-contain border-r pb-4 shadow-xl">
          <div className="flex items-center justify-between gap-2 px-4 py-4">
            <WorkspaceBrandMark />
            <button type="button" aria-label="Close admin navigation" onClick={() => drawer.current?.close()}
              className={`grid size-11 place-items-center rounded-lg hover:bg-[#FFF0F5] ${focusRing}`}><X size={21} aria-hidden="true" /></button>
          </div>
          <h2 id="admin-drawer-title" className="px-5 pb-3 text-sm font-semibold">Administration</h2>
          <AdminNavigation pathname={pathname} onNavigate={() => drawer.current?.close()} />
        </div>
      </dialog>
    </div>
  );
}
