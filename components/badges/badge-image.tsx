import Image from "next/image";
import { getBadgeImagePath } from "@/lib/badges/images";
import type { BadgeId } from "@/lib/badges/types";

type BadgeImageProps = {
  badgeId: BadgeId;
  unlocked: boolean;
  alt: string;
  /** CSS sizing such as `h-20 w-20` or `w-full`; artwork remains uncropped. */
  className?: string;
  priority?: boolean;
};

export function BadgeImage({ badgeId, unlocked, alt, className, priority = false }: BadgeImageProps) {
  return <Image src={getBadgeImagePath(badgeId, unlocked)} alt={alt} width={256} height={256} sizes="(max-width: 640px) 40vw, 256px" priority={priority} className={`aspect-square h-full w-full max-w-full object-contain ${className ?? ""}`} />;
}
