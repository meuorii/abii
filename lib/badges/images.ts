import type { BadgeId, BadgeImagePaths, BadgeRarity } from "./types";

const badgeFileNames: Readonly<Record<BadgeId, string>> = {
  "hello-abii": "hello-abi",
  "card-creator": "card-creator",
  "quiz-rookie": "quiz-rookie",
  "little-explorer": "little-explorer",
  "getting-into-rhythm": "getting-into-rhythm",
  "weekly-wonder": "weekly-wonder",
  "dedicated-otter": "dedicated-otter",
  "study-superstar": "study-superstar",
  "sharp-mind": "sharp-mind",
  "perfect-pearl": "perfect-pearl",
  "recall-detective": "recall-detective",
  "enumeration-expert": "enumeration-expert",
  "finish-line": "finish-line",
  "growing-knowledge": "growing-knowledge",
  "halfway-genius": "halfway-genius",
  "memory-pro": "memory-pro",
  "mastermind-abii": "mastermind-abii",
  "ultimate-scholar": "ultimate-scholar",
};

export const BADGE_IMAGES: Readonly<Record<BadgeId, BadgeImagePaths>> = Object.freeze(
  Object.fromEntries(Object.entries(badgeFileNames).map(([id, file]) => [id, Object.freeze({ unlocked: `/badges/unlocked/${file}-unlocked.png`, locked: `/badges/locked/${file}-locked.png` })])) as Record<BadgeId, BadgeImagePaths>,
);

export const RARITY_DEFINITIONS = Object.freeze({
  common: Object.freeze({ id: "common", label: "Common", medalImage: "/rarity-badges/common.png", accessibleDescription: "Common rarity medal", order: 1 }),
  uncommon: Object.freeze({ id: "uncommon", label: "Uncommon", medalImage: "/rarity-badges/uncommon.png", accessibleDescription: "Uncommon rarity medal", order: 2 }),
  rare: Object.freeze({ id: "rare", label: "Rare", medalImage: "/rarity-badges/rare.png", accessibleDescription: "Rare rarity medal", order: 3 }),
  legendary: Object.freeze({ id: "legendary", label: "Legendary", medalImage: "/rarity-badges/legendary.png", accessibleDescription: "Legendary rarity medal", order: 4 }),
} satisfies Readonly<Record<BadgeRarity, { id: BadgeRarity; label: string; medalImage: `/rarity-badges/${BadgeRarity}.png`; accessibleDescription: string; order: number }>>);

export function getBadgeImagePath(id: BadgeId, unlocked: boolean): string {
  return BADGE_IMAGES[id][unlocked ? "unlocked" : "locked"];
}
