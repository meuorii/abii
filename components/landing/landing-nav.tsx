"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  const close = () => setOpen(false);
  const planned = <span aria-disabled="true" title="This page is planned">Blog <small>Planned</small></span>;
  return <header className="landing-nav-wrap">
    <div className="landing-nav-inner">
      <Link href="/" className="landing-brand" aria-label="Abii home"><span className="font-brand">abii</span><span>.</span></Link>
      <nav className="landing-nav-desktop" aria-label="Main navigation"><a href="#home" aria-current="page">Home</a><a href="#experience">Features</a><a href="#meet-abii">About</a>{planned}<span aria-disabled="true" title="This page is planned">Guides <small>Planned</small></span></nav>
      <div className="landing-nav-actions"><Link className="landing-login" href="/login">Log In</Link><Link className="landing-button landing-button-primary landing-nav-cta" href="/register">Get Started</Link><button ref={trigger} type="button" className="landing-menu-trigger" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="landing-mobile-menu" onClick={() => setOpen((value) => !value)}>{open ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}</button></div>
    </div>
    <nav ref={menu} id="landing-mobile-menu" className="landing-nav-mobile" aria-label="Mobile navigation" hidden={!open}>
      <a href="#home" aria-current="page" onClick={close}>Home</a><a href="#experience" onClick={close}>Features</a><a href="#meet-abii" onClick={close}>About</a><span aria-disabled="true">Blog <small>Planned</small></span><span aria-disabled="true">Guides <small>Planned</small></span><Link href="/login" onClick={close}>Log In</Link><Link href="/register" onClick={() => setOpen(false)} className="landing-mobile-start">Get Started</Link>
    </nav>
  </header>;
}
