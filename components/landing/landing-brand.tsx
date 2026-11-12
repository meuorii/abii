import Image from "next/image";
import Link from "next/link";

type LandingBrandProps = {
  size?: "compact" | "footer";
};

export function LandingBrand({ size = "footer" }: LandingBrandProps) {
  const compact = size === "compact";
  return <Link href="/" className={`inline-flex items-center text-pink-primary ${compact ? "gap-2" : "gap-2.5"}`} aria-label="Abii home">
    <Image src="/abii-head.png" alt="" width={1402} height={1122} sizes={compact ? "40px" : "48px"} className={`h-auto ${compact ? "w-8 sm:w-10" : "w-10 sm:w-12"}`} />
    <span className={`font-brand leading-none ${compact ? "text-[1.75rem] sm:text-[2rem]" : "text-[2.125rem] sm:text-[2.375rem]"}`}>Abii</span>
  </Link>;
}
