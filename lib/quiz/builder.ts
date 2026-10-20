import "server-only";
import { randomInt } from "node:crypto";
import {
  ALLOW_CROSS_SUBJECT_DISTRACTORS,
  MAX_QUIZ_ANSWER_LENGTH,
  MC_OPTION_COUNT,
  TF_FALSE_PROBABILITY,
} from "./config";
import { normalizeText } from "./normalize";
import type { QuizType } from "./types";

export type PreparedCard = {
  id: string;
  subjectId: string;
  question: string;
  answer: string;
  hint?: string;
  /** normalized question / answer */
  qn: string;
  an: string;
};

export type StoredQuestion = {
  flashcardId: string;
  prompt: string;
  hint?: string;
  options: string[];
  correctIndex: number;
  statement?: string;
  truth?: boolean;
  expectedAnswer: string;
};

export function prepareCard(raw: { _id: unknown; subjectId: unknown; question: string; answer: string; hint?: string | null }): PreparedCard {
  const question = (raw.question ?? "").trim();
  const answer = (raw.answer ?? "").trim();
  return {
    id: String(raw._id),
    subjectId: String(raw.subjectId),
    question,
    answer,
    hint: raw.hint?.trim() || undefined,
    qn: normalizeText(question),
    an: normalizeText(answer),
  };
}

/** Malformed or unsuitable cards (blank fields, answer too long to type or show) are excluded. */
export function isUsableCard(card: PreparedCard): boolean {
  return card.qn.length > 0 && card.an.length > 0 && card.answer.length <= MAX_QUIZ_ANSWER_LENGTH;
}

/**
 * Another card's answer may serve as a distractor only when it clearly differs:
 * different card, different concept (question), a different answer, and neither
 * answer contains the other (so a "wrong" option can never also be right).
 */
function isValidDistractor(card: PreparedCard, other: PreparedCard): boolean {
  return (
    other.id !== card.id &&
    other.qn !== card.qn &&
    other.an !== card.an &&
    !other.an.includes(card.an) &&
    !card.an.includes(other.an)
  );
}

export function hasDistractor(card: PreparedCard, usable: PreparedCard[]): boolean {
  return usable.some(
    (other) =>
      isValidDistractor(card, other) &&
      (ALLOW_CROSS_SUBJECT_DISTRACTORS || other.subjectId === card.subjectId),
  );
}

/** Distinct distractor answers, same-subject first. All cards passed in must belong to the same user. */
export function getDistractors(card: PreparedCard, usable: PreparedCard[]): { same: string[]; other: string[] } {
  const seen = new Set<string>([card.an]);
  const collect = (cards: PreparedCard[]) => {
    const out: string[] = [];
    for (const c of cards) {
      if (!isValidDistractor(card, c) || seen.has(c.an)) continue;
      seen.add(c.an);
      out.push(c.answer);
    }
    return out;
  };
  const same = collect(usable.filter((c) => c.subjectId === card.subjectId));
  const other = ALLOW_CROSS_SUBJECT_DISTRACTORS ? collect(usable.filter((c) => c.subjectId !== card.subjectId)) : [];
  return { same, other };
}

export function isEligible(card: PreparedCard, type: QuizType, usable: PreparedCard[]): boolean {
  if (!isUsableCard(card)) return false;
  // Identification and True/False only need a clean question and answer
  // (True/False falls back to a true statement when no reliable false one exists).
  if (type === "multiple-choice") return hasDistractor(card, usable);
  return true;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** A hint that gives the answer away is not offered. */
function safeHint(card: PreparedCard): string | undefined {
  if (!card.hint) return undefined;
  return normalizeText(card.hint).includes(card.an) ? undefined : card.hint;
}

function buildMultipleChoice(card: PreparedCard, usable: PreparedCard[]): StoredQuestion | null {
  const { same, other } = getDistractors(card, usable);
  const wanted = MC_OPTION_COUNT - 1;
  const picked = [...shuffle(same), ...shuffle(other)].slice(0, wanted);
  if (picked.length === 0) return null; // skipped: no valid distractor can be found
  const entries = shuffle([
    { text: card.answer, correct: true },
    ...picked.map((text) => ({ text, correct: false })),
  ]);
  return {
    flashcardId: card.id,
    prompt: card.question,
    hint: safeHint(card),
    options: entries.map((e) => e.text),
    correctIndex: entries.findIndex((e) => e.correct),
    expectedAnswer: card.answer,
  };
}

function buildIdentification(card: PreparedCard): StoredQuestion {
  return {
    flashcardId: card.id,
    prompt: card.question,
    hint: safeHint(card),
    options: [],
    correctIndex: -1,
    expectedAnswer: card.answer,
  };
}

function buildTrueFalse(card: PreparedCard, usable: PreparedCard[]): StoredQuestion {
  const { same, other } = getDistractors(card, usable);
  const pool = same.length ? same : other;
  const makeFalse = pool.length > 0 && randomInt(1000) < TF_FALSE_PROBABILITY * 1000;
  const statement = makeFalse ? pool[randomInt(pool.length)] : card.answer;
  return {
    flashcardId: card.id,
    prompt: card.question,
    hint: safeHint(card),
    options: [],
    correctIndex: -1,
    statement,
    truth: !makeFalse,
    expectedAnswer: card.answer,
  };
}

/** Builds a fresh question for one card (used for retry rounds). Null if the card is no longer eligible. */
export function buildQuestionForCard(card: PreparedCard, usable: PreparedCard[], type: QuizType): StoredQuestion | null {
  if (!isEligible(card, type, usable)) return null;
  return type === "multiple-choice"
    ? buildMultipleChoice(card, usable)
    : type === "identification"
      ? buildIdentification(card)
      : buildTrueFalse(card, usable);
}

/**
 * Builds one question per eligible card in scope (no duplicates), in random order.
 * `usable` is the user's full set of usable cards, used only for distractors.
 */
export function buildQuestions(scope: PreparedCard[], usable: PreparedCard[], type: QuizType): StoredQuestion[] {
  const unique = new Map<string, PreparedCard>();
  for (const card of scope) if (!unique.has(card.id)) unique.set(card.id, card);
  const questions: StoredQuestion[] = [];
  for (const card of shuffle([...unique.values()])) {
    if (!isEligible(card, type, usable)) continue;
    const q =
      type === "multiple-choice"
        ? buildMultipleChoice(card, usable)
        : type === "identification"
          ? buildIdentification(card)
          : buildTrueFalse(card, usable);
    if (q) questions.push(q);
  }
  return questions;
}
