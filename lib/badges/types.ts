export const BADGE_CATEGORIES = ["getting-started", "study-consistency", "quiz-performance", "mastery"] as const;
export type BadgeCategory = (typeof BADGE_CATEGORIES)[number];

export const BADGE_RARITIES = ["common", "uncommon", "rare", "legendary"] as const;
export type BadgeRarity = (typeof BADGE_RARITIES)[number];

export const BADGE_IDS = [
  "hello-abii", "card-creator", "quiz-rookie", "little-explorer",
  "getting-into-rhythm", "weekly-wonder", "dedicated-otter", "study-superstar",
  "sharp-mind", "perfect-pearl", "recall-detective", "enumeration-expert", "finish-line",
  "growing-knowledge", "halfway-genius", "memory-pro", "mastermind-abii", "ultimate-scholar",
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

/** Semantic data source for future evaluation; this phase defines it but does not calculate it. */
export type BadgeProgressMetric =
  | "current-subject-count"
  | "current-flashcard-count"
  | "current-subjects-with-flashcards"
  | "consecutive-study-days"
  | "distinct-quiz-completion-days"
  | "completed-quiz-count"
  | "qualifying-quiz-score"
  | "qualifying-correct-quiz-answers"
  | "fully-correct-enumeration-answers"
  | "resumed-quiz-completions"
  | "current-subject-mastery"
  | "subjects-reaching-mastery-milestone";

export type BadgeRequirement = {
  metric: BadgeProgressMetric;
  target: number;
  /** Score threshold, when the metric evaluates quiz performance. */
  minimumScorePercent?: number;
  /** Minimum original question count, excluding generated/duplicate questions. */
  minimumOriginalQuestions?: number;
  /** Mastery milestones are historical events and should persist once reached. */
  persistentMilestone?: boolean;
};

export type BadgeImagePaths = Readonly<{ unlocked: `/badges/unlocked/${string}.png`; locked: `/badges/locked/${string}.png` }>;

export type BadgeDefinition = Readonly<{
  id: BadgeId;
  name: string;
  description: string;
  instructions: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  requirement: BadgeRequirement;
  images: BadgeImagePaths;
  order: number;
}>;

export type RarityDefinition = Readonly<{
  id: BadgeRarity;
  label: string;
  medalImage: `/rarity-badges/${BadgeRarity}.png`;
  accessibleDescription: string;
  order: number;
}>;
