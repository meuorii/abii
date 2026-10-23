import "server-only";
import { randomInt } from "node:crypto";
import {
  ALLOW_CROSS_SUBJECT_DISTRACTORS,
  ENUM_MAX_ITEMS,
  ENUM_MC_OPTION_COUNT,
  ENUM_MIN_ITEMS,
  MAX_ENUM_ANSWER_LENGTH,
  MAX_QUIZ_ANSWER_LENGTH,
  MC_OPTION_COUNT,
  TF_FALSE_PROBABILITY,
} from "./config";
import { normalizeText, parseEnumeration } from "./normalize";
import { buildEnumerationWrongLists } from "./distractors.mjs";
import { QUIZ_MODES, type FlashcardType, type QuizMode, type QuizType } from "./types";

export type PreparedCard = {
  id: string;
  subjectId: string;
  flashcardType: FlashcardType;
  question: string;
  answer: string;
  hint?: string;
  /** normalized question / answer */
  qn: string;
  an: string;
  /** Items of an enumeration answer (empty when the answer is not a list). */
  items: string[];
};

export type StoredQuestion = {
  /** The individual question type this question was built as (in Mixed / Random mode it varies). */
  type: QuizType;
  flashcardId: string;
  prompt: string;
  hint?: string;
  options: string[];
  correctIndex: number;
  statement?: string;
  truth?: boolean;
  /** Enumeration types: the complete list of expected items. */
  expectedItems?: string[];
  expectedAnswer: string;
};

export function prepareCard(raw: { _id: unknown; subjectId: unknown; question: string; answer: string; hint?: string | null; flashcardType?: string | null }): PreparedCard {
  const question = (raw.question ?? "").trim();
  const answer = (raw.answer ?? "").trim();
  const flashcardType: FlashcardType = raw.flashcardType === "items" ? "items" : "standard";
  const parsed = flashcardType === "items" ? parseEnumeration(answer) : [];
  const items = parsed.length >= ENUM_MIN_ITEMS && parsed.length <= ENUM_MAX_ITEMS ? parsed : [];
  return {
    id: String(raw._id),
    subjectId: String(raw.subjectId),
    flashcardType,
    question,
    answer,
    hint: raw.hint?.trim() || undefined,
    qn: normalizeText(question),
    an: normalizeText(answer),
    items,
  };
}

export function isEnumerationCard(card: PreparedCard): boolean {
  return card.flashcardType === "items" && card.items.length >= ENUM_MIN_ITEMS && card.items.length <= ENUM_MAX_ITEMS && card.answer.length <= MAX_ENUM_ANSWER_LENGTH;
}

/** Short enough to type or show as a single option. */
function isShortAnswer(card: PreparedCard): boolean {
  return card.answer.length <= MAX_QUIZ_ANSWER_LENGTH;
}

/**
 * Malformed or unsuitable cards (blank fields, answer too long to type or show) are excluded.
 * A long answer is still usable when it is a list that fits the enumeration question types.
 */
export function isUsableCard(card: PreparedCard): boolean {
  return card.qn.length > 0 && card.an.length > 0 && (card.flashcardType === "items" ? isEnumerationCard(card) : isShortAnswer(card));
}

/**
 * Another card's answer may serve as a distractor only when it clearly differs:
 * different card, different concept (question), a different answer, and neither
 * answer contains the other (so a "wrong" option can never also be right).
 */
function isValidDistractor(card: PreparedCard, other: PreparedCard): boolean {
  return (
    isShortAnswer(other) &&
    other.id !== card.id &&
    other.qn !== card.qn &&
    other.an !== card.an
  );
}

function foreignItems(card: PreparedCard, usable: PreparedCard[]): string[] {
  const own = new Set((card.flashcardType === "items" ? card.items : [card.answer]).map(normalizeText));
  const seen = new Set<string>(own);
  const same: string[] = []; const cross: string[] = [];
  for (const other of shuffle(usable)) {
    if (other.id === card.id || other.qn === card.qn) continue;
    const values = other.flashcardType === "items" ? other.items : [other.answer];
    for (const value of values) {
      const key = normalizeText(value);
      if (!key || value.length > MAX_QUIZ_ANSWER_LENGTH || seen.has(key)) continue;
      seen.add(key); (other.subjectId === card.subjectId ? same : cross).push(value);
    }
  }
  return [...shuffle(same), ...shuffle(cross)];
}

export function hasDistractor(card: PreparedCard, usable: PreparedCard[]): boolean {
  if (card.flashcardType === "standard") return foreignItems(card, usable).length > 0;
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

function isEligibleForMode(card: PreparedCard, mode: QuizMode, usable: PreparedCard[]): boolean {
  if (mode === "random") return eligibleTypes(card, usable).length > 0;
  if (!isUsableCard(card)) return false;
  if (card.flashcardType === "items") {
    if (!isEnumerationCard(card)) return false;
    // Items use complete-list options for MC and a multi-entry answer for Identification.
    // True/False compares the displayed statement with the complete list.
      return mode === "multiple-choice" ? enumerationWrongLists(card, usable, 1).length > 0 : mode === "identification" || mode === "true-false";
  }
  switch (mode) {
    case "multiple-choice": return isShortAnswer(card) && hasDistractor(card, usable);
    case "identification":
    case "true-false": return isShortAnswer(card);
  }
}

/** Modes that apply to a card, for eligibility counts and mastery completion. */
export function eligibleTypes(card: PreparedCard, usable: PreparedCard[]): QuizMode[] {
  return QUIZ_MODES.filter((mode) => mode !== "random" && isEligibleForMode(card, mode, usable)) as QuizMode[];
}

export function isEligible(card: PreparedCard, mode: QuizMode, usable: PreparedCard[]): boolean {
  return mode === "random" ? eligibleTypes(card, usable).length > 0 : isEligibleForMode(card, mode, usable);
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
  const same = foreignItems(card, usable.filter((candidate) => candidate.subjectId === card.subjectId));
  const cross = foreignItems(card, usable.filter((candidate) => candidate.subjectId !== card.subjectId));
  const wanted = MC_OPTION_COUNT - 1;
  const picked = [...shuffle(same), ...shuffle(cross)].slice(0, wanted);
  if (picked.length === 0) return null; // skipped: no valid distractor can be found
  const entries = shuffle([
    { text: card.answer, correct: true },
    ...picked.map((text) => ({ text, correct: false })),
  ]);
  return {
    type: "multiple-choice",
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
    type: "identification",
    flashcardId: card.id,
    prompt: card.question,
    hint: safeHint(card),
    options: [],
    correctIndex: -1,
    expectedAnswer: card.answer,
  };
}

function buildTrueFalse(card: PreparedCard, usable: PreparedCard[]): StoredQuestion {
  if (card.flashcardType === "items") {
    const falseLists = enumerationWrongLists(card, usable, 1);
    const makeFalse = falseLists.length > 0 && randomInt(1000) < TF_FALSE_PROBABILITY * 1000;
    const statement = (makeFalse ? falseLists[0] : shuffle(card.items)).join("\n");
    return { type: "true-false", flashcardId: card.id, prompt: card.question, hint: safeHint(card), options: [], correctIndex: -1, statement, truth: !makeFalse, expectedItems: card.items, expectedAnswer: card.items.join(", ") };
  }
  const same = foreignItems(card, usable.filter((candidate) => candidate.subjectId === card.subjectId));
  const cross = foreignItems(card, usable.filter((candidate) => candidate.subjectId !== card.subjectId));
  const pool = same.length ? same : cross;
  const makeFalse = pool.length > 0 && randomInt(1000) < TF_FALSE_PROBABILITY * 1000;
  const statement = makeFalse ? pool[randomInt(pool.length)] : card.answer;
  return {
    type: "true-false",
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

function buildEnumerationIdentification(card: PreparedCard): StoredQuestion {
  return {
    type: "enumeration-identification",
    flashcardId: card.id,
    prompt: card.question,
    hint: safeHint(card),
    options: [],
    correctIndex: -1,
    expectedItems: card.items,
    expectedAnswer: card.items.join(", "),
  };
}

function enumerationWrongLists(card: PreparedCard, usable: PreparedCard[], count: number): string[][] {
  const same = foreignItems(card, usable.filter((candidate) => candidate.subjectId === card.subjectId));
  const cross = foreignItems(card, usable.filter((candidate) => candidate.subjectId !== card.subjectId));
  return buildEnumerationWrongLists(card.items, same, cross, count);
}

function buildEnumerationMultipleChoice(card: PreparedCard, usable: PreparedCard[]): StoredQuestion | null {
  const correct = card.items;
  const wanted = ENUM_MC_OPTION_COUNT - 1;
  const wrong = enumerationWrongLists(card, usable, wanted);
  if (wrong.length === 0) return null;
  const entries = shuffle([
    { items: correct, correct: true },
    ...wrong.slice(0, wanted).map((items) => ({ items, correct: false })),
  ]);
  return {
    type: "enumeration-multiple-choice",
    flashcardId: card.id,
    prompt: card.question,
    hint: safeHint(card),
    // Items are shuffled inside each option so list order never gives the answer away.
    options: entries.map((e) => e.items.join("\n")),
    correctIndex: entries.findIndex((e) => e.correct),
    expectedItems: correct,
    expectedAnswer: correct.join(", "),
  };
}

function buildOfType(card: PreparedCard, usable: PreparedCard[], type: QuizType): StoredQuestion | null {
  const mode: QuizMode = type === "enumeration-identification" ? "identification" : type === "enumeration-multiple-choice" ? "multiple-choice" : type;
  if (!isEligibleForMode(card, mode, usable)) return null;
  switch (type) {
    case "multiple-choice":
      return buildMultipleChoice(card, usable);
    case "identification":
      return buildIdentification(card);
    case "true-false":
      return buildTrueFalse(card, usable);
    case "enumeration-identification":
      return buildEnumerationIdentification(card);
    case "enumeration-multiple-choice":
      return buildEnumerationMultipleChoice(card, usable);
  }
}

/**
 * Builds a fresh question for one card (used for retry rounds). Null if the card is no longer eligible.
 * In Mixed / Random mode a random type that fits the card is chosen.
 */
export function buildQuestionForCard(card: PreparedCard, usable: PreparedCard[], mode: QuizMode): StoredQuestion | null {
  const internalType: QuizType = card.flashcardType === "items"
    ? mode === "multiple-choice" ? "enumeration-multiple-choice"
      : mode === "identification" ? "enumeration-identification" : "true-false"
    : mode === "random" ? "identification" : mode;
  if (mode !== "random") return buildOfType(card, usable, internalType);
  const candidates = shuffle(QUIZ_MODES.filter((candidate) => candidate !== "random"));
  for (const candidate of candidates) {
    const type: QuizType = card.flashcardType === "items"
      ? candidate === "multiple-choice" ? "enumeration-multiple-choice"
        : candidate === "identification" ? "enumeration-identification" : "true-false"
      : candidate;
    const built = buildOfType(card, usable, type);
    if (built) return built;
  }
  return null;
}

/**
 * Builds one question per eligible card in scope (no duplicates), in random order.
 * `usable` is the user's full set of usable cards, used only for distractors.
 */
export function buildQuestions(scope: PreparedCard[], usable: PreparedCard[], mode: QuizMode): StoredQuestion[] {
  const unique = new Map<string, PreparedCard>();
  for (const card of scope) if (!unique.has(card.id)) unique.set(card.id, card);
  const questions: StoredQuestion[] = [];
  for (const card of shuffle([...unique.values()])) {
    const q = buildQuestionForCard(card, usable, mode);
    if (q) questions.push(q);
  }
  return questions;
}
