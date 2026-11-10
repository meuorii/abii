import Image from "next/image";
import Link from "next/link";
import styles from "./landing-page.module.css";
export function LandingBrand() {
  return <Link href="/" className={styles.brand} aria-label="Abii home"><Image src="/abii-head.png" alt="" width={1402} height={1122} sizes="52px" /><span className="font-brand">Abii</span></Link>;
}
