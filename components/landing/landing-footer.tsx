import Link from "next/link";
import { LandingBrand } from "./landing-brand";
import styles from "./landing-page.module.css";

function Planned({ children }: { children: React.ReactNode }) {
  return <span className={styles.planned} aria-disabled="true">{children}<small>Planned</small></span>;
}

export function LandingFooter() {
  return <footer className={styles.footer}><div className={styles.container}><div className={styles.footerTop}><div className={styles.footerBrand}><LandingBrand /><p>Learn a little. Remember a lot.</p></div><nav aria-label="Explore"><h2>Explore</h2><Link href="/">Home</Link><Link href="/about">About</Link><Link href="/features">Features</Link><Planned>Blogs</Planned></nav><nav aria-label="Support"><h2>Support</h2><Planned>Help Center</Planned><Planned>FAQs</Planned><Planned>Contact Us</Planned></nav></div><div className={styles.footerBottom}><small>© 2026 Abii. All rights reserved.</small><div><Planned>Privacy Policy</Planned><Planned>Terms of Service</Planned></div></div></div></footer>;
}
