import { BADGE_IMAGES, RARITY_DEFINITIONS } from "./images";
import type { BadgeCategory, BadgeDefinition, BadgeId, BadgeRarity } from "./types";

type BadgeInput = Omit<BadgeDefinition, "images">;
const define = (badge: BadgeInput): BadgeDefinition => Object.freeze({ ...badge, requirement: Object.freeze(badge.requirement), images: BADGE_IMAGES[badge.id] });

export const BADGE_CATALOG = Object.freeze([
  define({ id: "hello-abii", name: "Hello, Abii!", description: "Your learning journey begins with a subject of your own.", instructions: "Create your first subject.", category: "getting-started", rarity: "common", requirement: { metric: "current-subject-count", target: 1 }, order: 1 }),
  define({ id: "card-creator", name: "Card Creator", description: "Build your study collection one flashcard at a time.", instructions: "Create 10 flashcards.", category: "getting-started", rarity: "common", requirement: { metric: "current-flashcard-count", target: 10 }, order: 2 }),
  define({ id: "quiz-rookie", name: "Quiz Rookie", description: "Take your first quiz and put your recall to work.", instructions: "Complete one quiz.", category: "getting-started", rarity: "common", requirement: { metric: "completed-quiz-count", target: 1 }, order: 3 }),
  define({ id: "little-explorer", name: "Little Explorer", description: "Explore your curiosity across different subjects.", instructions: "Create flashcards in 3 different subjects.", category: "getting-started", rarity: "common", requirement: { metric: "current-subjects-with-flashcards", target: 3 }, order: 4 }),
  define({ id: "getting-into-rhythm", name: "Getting Into Rhythm", description: "A few focused days are the start of a lasting habit.", instructions: "Study on 3 consecutive calendar days.", category: "study-consistency", rarity: "uncommon", requirement: { metric: "consecutive-study-days", target: 3 }, order: 5 }),
  define({ id: "weekly-wonder", name: "Weekly Wonder", description: "Keep your study momentum going for a full week.", instructions: "Study on 7 consecutive calendar days.", category: "study-consistency", rarity: "uncommon", requirement: { metric: "consecutive-study-days", target: 7 }, order: 6 }),
  define({ id: "dedicated-otter", name: "Dedicated Otter", description: "A month of steady study shows remarkable dedication.", instructions: "Study on 30 consecutive calendar days.", category: "study-consistency", rarity: "rare", requirement: { metric: "consecutive-study-days", target: 30 }, order: 7 }),
  define({ id: "study-superstar", name: "Study Superstar", description: "Show up for quizzes across many different days.", instructions: "Complete quizzes on 50 distinct calendar days.", category: "study-consistency", rarity: "rare", requirement: { metric: "distinct-quiz-completion-days", target: 50 }, order: 8 }),
  define({ id: "sharp-mind", name: "Sharp Mind", description: "Show strong recall on a substantial quiz.", instructions: "Score at least 80% on a quiz with at least 10 original questions.", category: "quiz-performance", rarity: "uncommon", requirement: { metric: "qualifying-quiz-score", target: 1, minimumScorePercent: 80, minimumOriginalQuestions: 10 }, order: 9 }),
  define({ id: "perfect-pearl", name: "Perfect Pearl", description: "Recall every answer on a substantial quiz correctly.", instructions: "Score 100% on a quiz with at least 10 original questions.", category: "quiz-performance", rarity: "rare", requirement: { metric: "qualifying-quiz-score", target: 1, minimumScorePercent: 100, minimumOriginalQuestions: 10 }, order: 10 }),
  define({ id: "recall-detective", name: "Recall Detective", description: "Careful practice adds up to a hundred correct answers.", instructions: "Answer 100 quiz questions correctly.", category: "quiz-performance", rarity: "uncommon", requirement: { metric: "qualifying-correct-quiz-answers", target: 100 }, order: 11 }),
  define({ id: "enumeration-expert", name: "Enumeration Expert", description: "Recall every item in a list, with nothing missing.", instructions: "Answer 10 complete enumeration questions fully correctly.", category: "quiz-performance", rarity: "rare", requirement: { metric: "fully-correct-enumeration-answers", target: 10 }, order: 12 }),
  define({ id: "finish-line", name: "Finish Line", description: "Pick up an unfinished quiz and see it through.", instructions: "Resume an unfinished quiz and complete it successfully.", category: "quiz-performance", rarity: "uncommon", requirement: { metric: "resumed-quiz-completions", target: 1 }, order: 13 }),
  define({ id: "growing-knowledge", name: "Growing Knowledge", description: "Build a solid foundation of mastery in one subject.", instructions: "Reach at least 25% mastery in a non-empty subject.", category: "mastery", rarity: "common", requirement: { metric: "current-subject-mastery", target: 25, persistentMilestone: true }, order: 14 }),
  define({ id: "halfway-genius", name: "Halfway Genius", description: "Reach the halfway mark in a subject’s genuine mastery.", instructions: "Reach at least 50% mastery in a non-empty subject.", category: "mastery", rarity: "uncommon", requirement: { metric: "current-subject-mastery", target: 50, persistentMilestone: true }, order: 15 }),
  define({ id: "memory-pro", name: "Memory Pro", description: "Master most of the material in a subject.", instructions: "Reach at least 75% mastery in a non-empty subject.", category: "mastery", rarity: "rare", requirement: { metric: "current-subject-mastery", target: 75, persistentMilestone: true }, order: 16 }),
  define({ id: "mastermind-abii", name: "Mastermind Abii", description: "Achieve complete, genuine mastery of one subject.", instructions: "Reach genuine 100% mastery in one non-empty subject.", category: "mastery", rarity: "legendary", requirement: { metric: "current-subject-mastery", target: 100, persistentMilestone: true }, order: 17 }),
  define({ id: "ultimate-scholar", name: "Ultimate Scholar", description: "Reach complete mastery across a collection of subjects.", instructions: "Reach genuine 100% mastery in 5 distinct non-empty subjects.", category: "mastery", rarity: "legendary", requirement: { metric: "subjects-reaching-mastery-milestone", target: 5, persistentMilestone: true }, order: 18 }),
] as const satisfies readonly BadgeDefinition[]);

export const BADGE_CATEGORIES_METADATA: Readonly<Record<BadgeCategory, { id: BadgeCategory; label: string; order: number }>> = Object.freeze({
  "getting-started": Object.freeze({ id: "getting-started", label: "Getting Started", order: 1 }),
  "study-consistency": Object.freeze({ id: "study-consistency", label: "Study Consistency", order: 2 }),
  "quiz-performance": Object.freeze({ id: "quiz-performance", label: "Quiz Performance", order: 3 }),
  mastery: Object.freeze({ id: "mastery", label: "Subject Mastery", order: 4 }),
});

export const BADGE_BY_ID: Readonly<Record<BadgeId, (typeof BADGE_CATALOG)[number]>> = Object.freeze(Object.fromEntries(BADGE_CATALOG.map((badge) => [badge.id, badge])) as Record<BadgeId, (typeof BADGE_CATALOG)[number]>);
export const BADGE_RARITIES: Readonly<Record<BadgeRarity, (typeof RARITY_DEFINITIONS)[BadgeRarity]>> = RARITY_DEFINITIONS;
