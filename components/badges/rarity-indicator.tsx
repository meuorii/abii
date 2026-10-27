import Image from "next/image";
import { RARITY_DEFINITIONS } from "@/lib/badges/images";
import type { BadgeRarity } from "@/lib/badges/types";

export function RarityIndicator({ rarity, size = "sm", className = "" }: { rarity: BadgeRarity; size?: "sm" | "md" | "lg"; className?: string }) {
  const definition = RARITY_DEFINITIONS[rarity];
  const dimensions = size === "lg" ? 36 : size === "md" ? 30 : 23;
  const textSize = size === "lg" ? "text-sm" : "text-xs";
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <Image src={definition.medalImage} width={dimensions} height={dimensions} alt="" aria-hidden="true" sizes={`${dimensions}px`} className="shrink-0 object-contain" />
      <span className={`${textSize} font-semibold text-[#756B72]`}>{definition.label}</span>
    </span>
  );
}
