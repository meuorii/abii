import Image from "next/image";
import type { ReactNode } from "react";

type ResponsiveHeroProps = {
  image: string;
  titleId: string;
  /** Art direction for the compact illustration region. */
  mobileImageClassName?: string;
  /** Art direction for the wide, full-bleed illustration. */
  desktopImageClassName?: string;
  children: ReactNode;
};

/**
 * Keeps copy and flattened artwork in one visual section at every viewport.
 * Compact screens reserve a deliberately framed lower art region; wide screens
 * return to the original full-bleed illustration composition.
 */
export function ResponsiveHero({
  image,
  titleId,
  mobileImageClassName = "object-[68%_center]",
  desktopImageClassName = "md:object-center",
  children,
}: ResponsiveHeroProps) {
  return <section aria-labelledby={titleId} className="relative isolate overflow-hidden bg-pink-soft md:min-h-[clamp(40rem,56.3vw,60rem)]">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[clamp(18rem,76vw,25rem)] md:inset-0 md:h-auto">
      <Image
        src={image}
        alt=""
        fill
        priority
        quality={95}
        sizes="100vw"
        className={`object-cover ${mobileImageClassName} ${desktopImageClassName}`}
      />
    </div>
    <div className="mx-auto flex min-h-[clamp(43rem,154vw,51rem)] w-[min(1120px,calc(100%-2.5rem))] flex-col justify-start pb-[clamp(20rem,82vw,27rem)] pt-28 sm:w-[min(1120px,calc(100%-3rem))] sm:pb-[clamp(21rem,78vw,28rem)] sm:pt-32 md:min-h-[clamp(40rem,56.3vw,60rem)] md:justify-center md:py-28">
      {children}
    </div>
  </section>;
}
