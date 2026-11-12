"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LandingBrand } from "./landing-brand";
const navLink = "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold text-muted transition-colors hover:bg-pink-soft hover:text-pink-active focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active";
const button = "inline-flex min-h-11 items-center justify-center rounded-full bg-pink-primary px-6 py-2.5 text-sm font-semibold text-foreground transition-[transform,background-color] duration-150 ease-out hover:-translate-y-px hover:bg-pink-accent active:scale-[.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active";
export function LandingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("a")?.focus();
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setOpen(false); };
    const media = window.matchMedia("(min-width: 900px)");
    const resize = () => { if (media.matches) setOpen(false); };
    window.addEventListener("keydown", dismiss); window.addEventListener("pointerdown", outside); media.addEventListener("change", resize);
    return () => { window.removeEventListener("keydown", dismiss); window.removeEventListener("pointerdown", outside); media.removeEventListener("change", resize); };
  }, [open]);
  const close = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setOpen(false);
    const href = event.currentTarget.getAttribute("href");
    if (open && href?.startsWith("#")) {
      requestAnimationFrame(() => {
        const target = document.getElementById(href.slice(1));
        target?.setAttribute("tabindex", "-1");
        target?.focus({ preventScroll: true });
      });
    }
  };
  const links = <><Link className={navLink} href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={close}>Home</Link><Link className={navLink} href="/about" aria-current={pathname === "/about" ? "page" : undefined} onClick={close}>About</Link><Link className={navLink} href="/features" aria-current={pathname === "/features" ? "page" : undefined} onClick={close}>Features</Link><Link className={navLink} href="/blogs" aria-current={pathname === "/blogs" ? "page" : undefined} onClick={close}>Blogs</Link></>;
  return <header ref={header} className="relative z-20 -mb-[76px] mt-3 px-4 sm:-mb-[92px] sm:mt-4 sm:px-6">
    <div className="mx-auto grid min-h-16 max-w-[1200px] grid-cols-[1fr_auto] items-center gap-5 rounded-[1.2rem] border border-border/80 bg-white/95 px-4 shadow-[0_8px_28px_rgb(47_41_48_/_8%)] backdrop-blur-md sm:min-h-[76px] sm:px-6 lg:grid-cols-[1fr_auto_1fr]"><LandingBrand /><nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">{links}</nav><div className="hidden items-center justify-end gap-2 lg:flex"><Link href="/login" className={navLink}>Login</Link><Link href="/register" className={button}>Get Started</Link></div><button ref={trigger} type="button" className="grid size-11 place-items-center rounded-xl border border-border bg-white text-foreground transition-colors active:bg-pink-card focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active lg:hidden" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="landing-mobile-menu" onClick={() => setOpen(!open)}>{open ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}</button></div>
    <nav ref={menu} id="landing-mobile-menu" className="mx-auto mt-2.5 grid max-w-[1200px] gap-1 rounded-[1.25rem] border border-border/80 bg-white/95 p-3.5 shadow-[0_12px_32px_rgb(47_41_48_/_11%)] backdrop-blur-md lg:hidden" aria-label="Mobile navigation" hidden={!open} onBlur={(event) => { if (!header.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>{links}<Link href="/login" className={navLink} onClick={close}>Login</Link><Link href="/register" className={button} onClick={close}>Get Started</Link></nav>
  </header>;
}
