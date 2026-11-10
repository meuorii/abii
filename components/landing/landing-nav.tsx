"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { LandingBrand } from "./landing-brand";
import styles from "./landing-page.module.css";
export function LandingNav() {
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
  const links = <><Link href="/" aria-current="page" onClick={close}>Home</Link><a href="#why-abii" onClick={close}>About</a><a href="#features" onClick={close}>Features</a><span className={styles.planned} aria-disabled="true" title="Blogs is planned">Blogs <small>Planned</small></span></>;
  return <header ref={header} className={styles.nav}>
    <div className={`${styles.container} ${styles.navInner}`}><LandingBrand /><nav className={styles.desktopNav} aria-label="Main navigation">{links}</nav><div className={styles.navActions}><Link href="/login">Login</Link><Link href="/register" className={styles.button}>Get Started</Link></div><button ref={trigger} type="button" className={styles.menuTrigger} aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="landing-mobile-menu" onClick={() => setOpen(!open)}>{open ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}</button></div>
    <nav ref={menu} id="landing-mobile-menu" className={`${styles.container} ${styles.mobileNav}`} aria-label="Mobile navigation" hidden={!open} onBlur={(event) => { if (!header.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>{links}<Link href="/login" onClick={close}>Login</Link><Link href="/register" className={styles.button} onClick={close}>Get Started</Link></nav>
  </header>;
}
