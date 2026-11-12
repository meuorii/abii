"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LandingBrand } from "./landing-brand";
import { PageEntry } from "@/components/motion/page-entry";

const desktopLink = "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold text-muted transition-[background-color,color] duration-150 ease-out hover:bg-pink-soft hover:text-pink-active focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active";
const drawerLink = "flex min-h-12 items-center rounded-xl px-4 text-[1rem] font-semibold text-foreground transition-[background-color,color] duration-150 ease-out hover:bg-pink-soft hover:text-pink-active focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active";
const button = "inline-flex min-h-11 items-center justify-center rounded-full bg-pink-primary px-5 py-2.5 text-sm font-semibold text-foreground transition-[transform,background-color] duration-150 ease-out hover:-translate-y-px hover:bg-pink-accent active:scale-[.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active motion-reduce:transform-none";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/features", label: "Features" },
  { href: "/blogs", label: "Blogs" },
  { href: "/support", label: "Support" },
] as const;

export function LandingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef(true);

  const closeDrawer = (restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  };

  const openDrawer = () => {
    restoreFocusRef.current = true;
    setPresent(true);
    requestAnimationFrame(() => setOpen(true));
  };

  useEffect(() => {
    setPortalReady(true);
    const updateScrollState = () => setScrolled((current) => {
      const next = window.scrollY > 12;
      return current === next ? current : next;
    });
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    closeDrawer(false);
    // Deliberately react to path changes so a drawer cannot remain open after navigation.
  }, [pathname]);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    const timer = window.setTimeout(() => setPresent(false), 240);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = () => {
      if (desktop.matches) closeDrawer(false);
    };
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const triggerNode = triggerRef.current;
    const previousOverflow = body.style.overflow;
    const hiddenRegions = [...document.querySelectorAll<HTMLElement>("main, footer")].map((region) => ({
      region,
      previous: region.getAttribute("aria-hidden"),
    }));
    body.style.overflow = "hidden";
    hiddenRegions.forEach(({ region }) => region.setAttribute("aria-hidden", "true"));
    requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      hiddenRegions.forEach(({ region, previous }) => {
        if (previous === null) region.removeAttribute("aria-hidden");
        else region.setAttribute("aria-hidden", previous);
      });
      if (restoreFocusRef.current) requestAnimationFrame(() => triggerNode?.focus());
    };
  }, [open]);

  const activeClass = (href: string, variant: "desktop" | "drawer") => {
    const isActive = pathname === href;
    if (variant === "desktop") return `${desktopLink} ${isActive ? "bg-pink-card text-pink-active" : ""}`;
    return `${drawerLink} ${isActive ? "bg-pink-card text-pink-active" : ""}`;
  };

  const drawer = present && portalReady ? createPortal(
    <div className={`fixed inset-0 z-[90] lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <button type="button" tabIndex={open ? 0 : -1} aria-label="Close navigation menu" className={`absolute inset-0 bg-foreground/20 transition-opacity duration-200 ease-out motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`} onClick={() => closeDrawer()} />
      <aside ref={drawerRef} id="landing-mobile-menu" role="dialog" aria-modal="true" aria-label="Site navigation" inert={!open} className={`absolute inset-y-0 right-0 flex w-[min(86vw,22.5rem)] flex-col overflow-y-auto rounded-l-[1.75rem] border-l border-border/80 bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-[-16px_0_45px_rgb(47_41_48_/_14%)] transition-transform duration-250 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <LandingBrand size="compact" />
          <button ref={closeRef} type="button" className="grid size-11 place-items-center rounded-xl border border-border bg-white text-foreground transition-colors hover:bg-pink-soft focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active" aria-label="Close navigation menu" onClick={() => closeDrawer()}><X aria-hidden="true" /></button>
        </div>
        <nav className="mt-6 grid gap-1" aria-label="Mobile navigation">
          {navigation.map((item) => <Link key={item.href} href={item.href} className={activeClass(item.href, "drawer")} aria-current={pathname === item.href ? "page" : undefined} onClick={() => closeDrawer(false)}>{item.label}</Link>)}
        </nav>
        <div className="mt-auto border-t border-border pt-5">
          <Link href="/login" className={`${drawerLink} mb-2`} onClick={() => closeDrawer(false)}>Login</Link>
          <Link href="/register" className={`${button} w-full`} onClick={() => closeDrawer(false)}>Get Started</Link>
          <p className="mt-5 max-w-[22ch] text-sm leading-relaxed text-muted">Learn a little. Remember a lot.</p>
        </div>
      </aside>
    </div>,
    document.body,
  ) : null;

  return <>
    <header className="fixed inset-x-0 top-0 z-[60] px-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[max(1rem,env(safe-area-inset-top))]">
      <PageEntry distance={-14} duration={0.62} className={`mx-auto grid min-h-[3.75rem] max-w-[1200px] grid-cols-[1fr_auto] items-center gap-4 rounded-[1.15rem] border px-4 backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-200 ease-out sm:min-h-[4.25rem] sm:px-5 lg:grid-cols-[auto_1fr_auto] ${scrolled ? "border-border bg-white/98 shadow-[0_10px_30px_rgb(47_41_48_/_11%)]" : "border-border/80 bg-white/90 shadow-[0_7px_24px_rgb(47_41_48_/_7%)]"}`}>
        <LandingBrand size="compact" />
        <nav className="hidden items-center justify-center gap-1 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => <Link key={item.href} href={item.href} className={activeClass(item.href, "desktop")} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <div className="hidden items-center justify-end gap-1 lg:flex"><Link href="/login" className={desktopLink}>Login</Link><Link href="/register" className={button}>Get Started</Link></div>
        <button ref={triggerRef} type="button" className="grid size-11 place-items-center rounded-xl border border-border bg-white text-foreground transition-colors hover:bg-pink-soft focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active lg:hidden" aria-label="Open navigation menu" aria-expanded={open} aria-controls="landing-mobile-menu" onClick={openDrawer}><Menu aria-hidden="true" /></button>
      </PageEntry>
    </header>
    {drawer}
  </>;
}
