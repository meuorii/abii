// Shared, client-safe quiz types. Flashcard type controls how answers are represented.
export const FLASHCARD_TYPES = ["standard", "items"] as const;
export type FlashcardType = (typeof FLASHCARD_TYPES)[number];
export function isFlashcardType(value: unknown): value is FlashcardType {
  return typeof value === "string" && (FLASHCARD_TYPES as readonly string[]).includes(value);
}

/** Quiz modes available to learners. Enumeration is a flashcard type, not a quiz mode. */
export const QUIZ_MODES = ["multiple-choice", "identification", "true-false", "random"] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];
export type ReviewScope = "all" | "subject" | "topic";

/** Internal question renderers used when an Items flashcard is played in MC/Identification. */
export const QUIZ_TYPES = ["multiple-choice", "identification", "true-false", "enumeration-identification", "enumeration-multiple-choice"] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];
export const RANDOM_MODE = "random" as const;

export const QUIZ_TYPE_LABELS: Record<QuizMode, string> = {
  "multiple-choice": "Multiple Choice",
  identification: "Identification",
  "true-false": "True or False",
  random: "Mixed / Random",
};
export const QUIZ_TYPE_DESCRIPTIONS: Record<QuizMode, string> = {
  "multiple-choice": "Choose the correct answer. Items flashcards show complete-list options.",
  identification: "Recall and type the answer. Items flashcards accept the full list in any order.",
  "true-false": "Decide whether the statement is true or false.",
  random: "A shuffled mix of Multiple Choice, Identification, and True or False.",
};
export type ModeProgress = { done: number; total: number };
export type TypeProgress = Record<QuizMode, ModeProgress>;
export function emptyTypeProgress(): TypeProgress {
  return Object.fromEntries(QUIZ_MODES.map((m) => [m, { done: 0, total: 0 }])) as TypeProgress;
}
export const ALL_SUBJECTS = "all";
export function isQuizType(value: unknown): value is QuizType {
  return typeof value === "string" && (QUIZ_TYPES as readonly string[]).includes(value);
}
export function isQuizMode(value: unknown): value is QuizMode {
  return typeof value === "string" && (QUIZ_MODES as readonly string[]).includes(value);
}
export type PublicQuestion = {
  index: number;
  type: QuizType;
  prompt: string;
  hint: string | null;
  options?: string[];
  statement?: string;
  itemCount?: number;
  round: number;
  cardIndex: number;
};
export type QuestionResult = {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  selectedIndex?: number;
  correctIndex?: number;
  userAnswer?: string;
  selectedTruth?: boolean;
  userAnswers?: string[];
  correctItems?: string[];
  itemCorrect?: boolean[];
  missingItems?: string[];
};
export type QuizSummary = {
  total: number; answered: number; correct: number; incorrect: number; accuracy: number;
  cards: number; mastered: number; firstTryCorrect: number; rounds: number;
};
export type PublicSession = {
  id: string; subjectId: string | null; subjectName: string; type: QuizMode;
  scope?: ReviewScope; topicId?: string | null; topicName?: string | null;
  status: "active" | "completed"; questions: PublicQuestion[]; results: Record<number, QuestionResult>;
  summary: QuizSummary | null; cardTotal: number; mastery: Record<number, number>; masteryTarget: number;
  completedAt: string | null;
};
export type SetupSubject = {
  id: string; name: string; flashcardCount: number; mastered: number;
  typeMastery: TypeProgress; eligible: Record<QuizMode, number>;
  topics: SetupTopic[];
};
export type SetupTopic = { id: string; name: string; flashcardCount: number; eligible: Record<QuizMode, number> };
