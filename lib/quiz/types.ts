// Shared, client-safe quiz types. Never put answer keys in these payloads before submission.

export const QUIZ_TYPES = ["multiple-choice", "identification", "true-false"] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];

export const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  "multiple-choice": "Multiple Choice",
  identification: "Identification",
  "true-false": "True or False",
};

export const QUIZ_TYPE_DESCRIPTIONS: Record<QuizType, string> = {
  "multiple-choice": "Choose the correct answer from the options.",
  identification: "Recall the answer and type it yourself.",
  "true-false": "Decide whether the statement is true or false.",
};

export const ALL_SUBJECTS = "all";

export function isQuizType(value: unknown): value is QuizType {
  return typeof value === "string" && (QUIZ_TYPES as readonly string[]).includes(value);
}

/** A question as the browser sees it: no correct option, truth value, or expected answer. */
export type PublicQuestion = {
  index: number;
  type: QuizType;
  prompt: string;
  hint: string | null;
  options?: string[];
  statement?: string;
  /** 1 for the first pass, 2+ for retry rounds of missed cards. */
  round: number;
  /** Which card (0-based position in round 1) this question is about. Not the card id. */
  cardIndex: number;
};

/** Only returned after a question has been submitted. */
export type QuestionResult = {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  selectedIndex?: number;
  correctIndex?: number;
  userAnswer?: string;
  selectedTruth?: boolean;
};

export type QuizSummary = {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  /** Distinct flashcards in the session. */
  cards: number;
  /** Cards answered correctly at least at the end (all of them once the session is complete). */
  mastered: number;
  /** Cards answered correctly on their first attempt. */
  firstTryCorrect: number;
  /** Number of rounds played (1 = no retries were needed). */
  rounds: number;
};

export type PublicSession = {
  id: string;
  subjectId: string | null;
  subjectName: string;
  type: QuizType;
  status: "active" | "completed";
  questions: PublicQuestion[];
  results: Record<number, QuestionResult>;
  summary: QuizSummary | null;
  cardTotal: number;
  /** Correct-in-a-row count per card (keyed by cardIndex). */
  mastery: Record<number, number>;
  /** Streak needed for a card to count as mastered. */
  masteryTarget: number;
};

export type SetupSubject = {
  id: string;
  name: string;
  flashcardCount: number;
  /** Cards that completed all three quiz types. */
  mastered: number;
  /** Cards that completed the 3-correct streak for each individual quiz type. */
  typeMastery: Record<QuizType, number>;
  eligible: Record<QuizType, number>;
};

