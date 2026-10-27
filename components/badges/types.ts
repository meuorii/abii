import type { BadgeEvaluation } from "@/lib/badges/evaluator";
import type { BadgeDefinition } from "@/lib/badges/types";

export type BadgePageItem = BadgeDefinition & BadgeEvaluation & {
  image: string;
  unlockedAt: string | null;
};

export type BadgePageData = {
  badges: BadgePageItem[];
  reconciledAt?: string;
  cached?: boolean;
};
