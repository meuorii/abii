import Image from "next/image";
import Link from "next/link";
export function LandingBrand() {
  return <Link href="/" className="inline-flex items-center gap-2.5 text-pink-primary" aria-label="Abii home"><Image src="/abii-head.png" alt="" width={1402} height={1122} sizes="52px" className="h-auto w-11 sm:w-[52px]" /><span className="font-brand text-[2.25rem] leading-none sm:text-[2.625rem]">Abii</span></Link>;
}
