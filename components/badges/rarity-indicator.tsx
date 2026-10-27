import Image from "next/image";
import { RARITY_DEFINITIONS } from "@/lib/badges/images";
import type { BadgeRarity } from "@/lib/badges/types";

export function RarityIndicator({ rarity, size = "sm", className = "" }: { rarity: BadgeRarity; size?: "sm" | "md" | "lg"; className?: string }) {
  const definition = RARITY_DEFINITIONS[rarity];
  const dimensions = size === "lg" ? 28 : size === "md" ? 18 : 16;
  const textSize = size === "lg" ? "text-[13px]" : size === "md" ? "text-[11px]" : "text-[10px] sm:text-[11px]";
  const imageSize = size === "lg" ? "h-7 w-7" : size === "md" ? "h-[18px] w-[18px]" : "h-4 w-4 sm:h-[18px] sm:w-[18px]";
  return (
    <span className={`inline-flex min-w-0 shrink-0 flex-nowrap items-center gap-1 whitespace-nowrap ${className}`}>
      <Image src={definition.medalImage} width={dimensions} height={dimensions} alt="" aria-hidden="true" sizes={`${dimensions}px`} className={`${imageSize} shrink-0 object-contain`} />
      <span className={`${textSize} shrink-0 whitespace-nowrap font-semibold leading-4 text-[#756B72]`}>{definition.label}</span>
    </span>
  );
}
