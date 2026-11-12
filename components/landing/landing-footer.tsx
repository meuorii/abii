import Link from "next/link";
import { LandingBrand } from "./landing-brand";

function Planned({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex min-h-9 items-center text-[15px] leading-relaxed text-muted" aria-disabled="true">{children}</span>;
}

const footerLink = "inline-flex min-h-10 items-center text-[15px] text-muted transition-colors duration-150 hover:text-pink-active focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-pink-active";

export function LandingFooter() {
  return <footer className="border-t border-pink/40 bg-pink-soft px-5 py-14 sm:px-6 sm:py-16">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-11 md:grid-cols-[minmax(0,1.45fr)_minmax(8rem,.55fr)_minmax(9rem,.65fr)] md:gap-x-12 lg:gap-x-20">
        <div className="max-w-[25rem]"><LandingBrand size="footer" /><p className="mt-4 text-[clamp(1rem,1.5vw,1.125rem)] font-medium leading-relaxed tracking-[-.015em] text-foreground">Learn a little. Remember a lot.</p><p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">A friendly place to organize your learning and make every study session count.</p></div>
        <nav className="grid content-start gap-1" aria-label="Explore"><h2 className="mb-2 text-[15px] font-semibold tracking-[-.01em] text-foreground">Explore</h2><Link className={footerLink} href="/">Home</Link><Link className={footerLink} href="/about">About</Link><Link className={footerLink} href="/features">Features</Link><Link className={footerLink} href="/blogs">Blogs</Link></nav>
        <section className="grid content-start gap-1" aria-labelledby="footer-support"><h2 id="footer-support" className="mb-2 text-[15px] font-semibold tracking-[-.01em] text-foreground">Support</h2><p className="mb-1 text-xs leading-relaxed text-muted">Helpful resources, thoughtfully in progress.</p><Planned>Help Center</Planned><Planned>FAQs</Planned><Planned>Contact Us</Planned></section>
      </div>
      <div className="mt-12 flex flex-col gap-4 border-t border-border/80 pt-6 text-xs leading-relaxed text-muted sm:mt-14 sm:flex-row sm:items-center sm:justify-between"><small>© 2026 Abii. All rights reserved.</small><div className="flex flex-wrap gap-x-5 gap-y-2"><Planned>Privacy Policy</Planned><Planned>Terms of Service</Planned></div></div>
    </div>
  </footer>;
}
