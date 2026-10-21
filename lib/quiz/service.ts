import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { QuizSession } from "@/models/QuizSession";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";
import { buildQuestionForCard, buildQuestions, eligibleTypes, isEligible, shuffle, isUsableCard, prepareCard, type PreparedCard } from "./builder";
import { ENUM_MAX_ITEMS, ENUM_ORDER_MATTERS, MASTERY_STREAK, MAX_ENUM_ITEM_LENGTH, MAX_TYPED_ANSWER_LENGTH, SESSION_TTL_HOURS } from "./config";
import { normalizeText, sanitizeTyped } from "./normalize";
import { computeNextReviewAt } from "./schedule";
import {
  ALL_SUBJECTS,
  QUIZ_MODES,
  emptyTypeProgress,
  isQuizMode,
  type PublicQuestion,
  type PublicSession,
  type QuestionResult,
  type QuizMode,
  type QuizSummary,
  type QuizType,
  type TypeProgress,
} from "./types";

type StoredQuestionDoc = {
  type?: QuizType | null;
  expectedItems?: string[] | null;
  userAnswers?: string[] | null;
  flashcardId: Types.ObjectId;
  prompt: string;
  hint?: string | null;
  options?: string[];
  correctIndex?: number;
  statement?: string | null;
  truth?: boolean | null;
  expectedAnswer: string;
  round?: number;
  origin?: number;
  answered?: boolean;
  correct?: boolean | null;
  selectedIndex?: number | null;
  userAnswer?: string | null;
  answeredAt?: Date | null;
};

type SessionDoc = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  subjectId?: Types.ObjectId | null;
  subjectName: string;
  type: QuizMode;
  status: "active" | "completed";
  questions: StoredQuestionDoc[];
};

/** The individual type of a stored question (sessions created before Mixed mode have no per-question type). */
function questionType(q: StoredQuestionDoc, session: SessionDoc): QuizType {
  if (q.type) return q.type;
  return session.type === "random" ? "identification" : session.type;
}

/** Grades an enumeration answer. Partial lists are incorrect. */
function gradeEnumeration(expected: string[], typed: string[]) {
  if (ENUM_ORDER_MATTERS) {
    const itemCorrect = typed.map((t, i) => i < expected.length && normalizeText(t) === normalizeText(expected[i]));
    return {
      correct: typed.length === expected.length && itemCorrect.every(Boolean),
      itemCorrect,
      missing: expected.filter((_, i) => !itemCorrect[i] || i >= typed.length),
    };
  }
  const remaining = expected.map((item) => ({ item, key: normalizeText(item) }));
  const itemCorrect = typed.map((t) => {
    const at = remaining.findIndex((r) => r.key === normalizeText(t));
    if (at === -1) return false;
    remaining.splice(at, 1);
    return true;
  });
  return { correct: itemCorrect.every(Boolean) && remaining.length === 0, itemCorrect, missing: remaining.map((r) => r.item) };
}

export type ServiceError = { ok: false; status: number; message: string };
const fail = (status: number, message: string): ServiceError => ({ ok: false, status, message });

/** All of a user's usable cards, prepared for quiz generation. Always scoped to the owner. */
export async function loadUsableCards(userId: Types.ObjectId | string): Promise<PreparedCard[]> {
  const cards = await Flashcard.find({ userId }).select("_id subjectId flashcardType question answer hint").lean();
  return cards.map(prepareCard).filter(isUsableCard);
}

export async function startSession(userId: Types.ObjectId | string, subjectParam: unknown, typeParam: unknown) {
  if (!isQuizMode(typeParam)) return fail(400, "Choose a valid quiz type.");
  const type: QuizMode = typeParam;
  if (typeof subjectParam !== "string") return fail(400, "Choose a subject.");

  await connectToDatabase();
  let subjectId: Types.ObjectId | null = null;
  let subjectName = "All Subjects";
  if (subjectParam !== ALL_SUBJECTS) {
    if (!isValidObjectId(subjectParam)) return fail(404, "This subject could not be found.");
    const subject = await Subject.findOne({ _id: subjectParam, userId }).select("_id name").lean();
    if (!subject) return fail(404, "This subject could not be found.");
    subjectId = subject._id as Types.ObjectId;
    subjectName = subject.name;
  }

  const usable = await loadUsableCards(userId);
  const scope = subjectId ? usable.filter((c) => c.subjectId === String(subjectId)) : usable;
  const questions = buildQuestions(scope, usable, type);
  if (questions.length === 0) {
    return fail(422, "There are no eligible flashcards for this subject and quiz type.");
  }

  const session = await QuizSession.create({
    userId,
    subjectId,
    subjectName,
    type,
    status: "active",
    questions: questions.map((q, i) => ({ ...q, flashcardId: new Types.ObjectId(q.flashcardId), round: 1, origin: i, answered: false })),
    expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000),
  });
  return { ok: true as const, sessionId: String(session._id), total: questions.length };
}

/** Counts of eligible questions per subject (and for "all") and quiz type, using the same rules as the builder. */
export async function getEligibilityCounts(userId: Types.ObjectId | string) {
  const usable = await loadUsableCards(userId);
  const empty = () => Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>;
  const all = empty();
  const bySubject = new Map<string, Record<QuizMode, number>>();
  for (const card of usable) {
    const counts = bySubject.get(card.subjectId) ?? empty();
    for (const type of QUIZ_MODES) {
      if (isEligible(card, type, usable)) {
        counts[type] += 1;
        all[type] += 1;
      }
    }
    bySubject.set(card.subjectId, counts);
  }
  return { all, bySubject, usableCount: usable.length };
}

function explanationFor(q: StoredQuestionDoc, type: QuizType): string {
  if (type === "true-false") {
    return q.truth
      ? `That statement is true. The flashcard answer is “${q.expectedAnswer}”.`
      : `That statement is false. The correct answer is “${q.expectedAnswer}”.`;
  }
  if (type === "enumeration-identification" || type === "enumeration-multiple-choice") {
    return `The complete list is: ${(q.expectedItems ?? []).join(", ")}.`;
  }
  return `The correct answer is “${q.expectedAnswer}”.`;
}

function resultFor(q: StoredQuestionDoc, session: SessionDoc): QuestionResult {
  const type = questionType(q, session);
  const correct = Boolean(q.correct);
  const base: QuestionResult = { correct, correctAnswer: q.expectedAnswer, explanation: explanationFor(q, type) };
  if (type === "multiple-choice" || type === "enumeration-multiple-choice") {
    return { ...base, selectedIndex: q.selectedIndex ?? undefined, correctIndex: q.correctIndex ?? undefined };
  }
  if (type === "identification") return { ...base, userAnswer: q.userAnswer ?? undefined };
  if (type === "enumeration-identification") {
    const expected = q.expectedItems ?? [];
    const typed = q.userAnswers ?? [];
    const graded = gradeEnumeration(expected, typed);
    return { ...base, userAnswers: typed, correctItems: expected, itemCorrect: graded.itemCorrect, missingItems: graded.missing };
  }
  return { ...base, selectedTruth: correct ? Boolean(q.truth) : !q.truth };
}

/**
 * Correct-in-a-row streak per flashcard, from saved review records (newest first).
 * A wrong answer ends the streak. Cards with no records have streak 0.
 */
export async function computeStreaks(userId: Types.ObjectId | string, flashcardIds: string[] | undefined, type: QuizMode): Promise<Map<string, number>> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (flashcardIds) filter.flashcardId = { $in: flashcardIds.filter((id) => isValidObjectId(id)).map((id) => new Types.ObjectId(id)) };
  // Keep streaks independent by question type so a perfect Multiple Choice round
  // cannot accidentally complete Identification or True or False.
  filter.questionType = type;
  const records = await ReviewRecord.find(filter).select("flashcardId result reviewedAt questionType").sort({ reviewedAt: -1, _id: -1 }).lean();
  const streaks = new Map<string, number>();
  const ended = new Set<string>();
  for (const record of records) {
    const id = String(record.flashcardId);
    const key = `${id}:${type}`;
    if (ended.has(key)) continue;
    if (record.result === "correct") streaks.set(id, (streaks.get(id) ?? 0) + 1);
    else ended.add(key);
  }
  return streaks;
}

/**
 * Mastery progress per subject and mode, for the setup, review and subject pages.
 * A mode only counts for cards it applies to (e.g. Enumeration only for list answers).
 * A card is mastered when it has the streak in every mode that applies to it AND in Mixed / Random mode.
 */
export async function getSubjectMastery(userId: Types.ObjectId | string) {
  const usable = await loadUsableCards(userId);
  const records = await ReviewRecord.find({ userId })
    .select("flashcardId result reviewedAt questionType")
    .sort({ reviewedAt: -1, _id: -1 })
    .lean();

  const streakByMode = new Map<QuizMode, Map<string, number>>();
  for (const mode of QUIZ_MODES) {
    const streaks = new Map<string, number>();
    const ended = new Set<string>();
    for (const record of records) {
      if (record.questionType !== mode) continue;
      const id = String(record.flashcardId);
      if (ended.has(id)) continue;
      if (record.result === "correct") streaks.set(id, (streaks.get(id) ?? 0) + 1);
      else ended.add(id);
    }
    streakByMode.set(mode, streaks);
  }

  const bySubject = new Map<string, number>();
  const byTypeBySubject = new Map<string, TypeProgress>();
  const allByType = emptyTypeProgress();
  let all = 0;
  for (const card of usable) {
    const subjectId = card.subjectId;
    const progress = byTypeBySubject.get(subjectId) ?? emptyTypeProgress();
    const applicable: QuizMode[] = [...eligibleTypes(card, usable), "random"];
    let complete = true;
    for (const mode of applicable) {
      const done = (streakByMode.get(mode)?.get(card.id) ?? 0) >= MASTERY_STREAK;
      progress[mode].total += 1;
      allByType[mode].total += 1;
      if (done) {
        progress[mode].done += 1;
        allByType[mode].done += 1;
      } else complete = false;
    }
    byTypeBySubject.set(subjectId, progress);
    if (complete) {
      bySubject.set(subjectId, (bySubject.get(subjectId) ?? 0) + 1);
      all += 1;
    }
  }
  return { bySubject, byTypeBySubject, allByType, all };
}

/** Current consecutive-correct streak for cards in this session's selected quiz type. */
export async function sessionMastery(userId: Types.ObjectId | string, session: SessionDoc): Promise<Map<string, number>> {
  return computeStreaks(userId, [...new Set(session.questions.map((q) => String(q.flashcardId)))], session.type);
}

export function summarize(session: SessionDoc, streaks?: Map<string, number>): QuizSummary {
  const total = session.questions.length;
  const answered = session.questions.filter((q) => q.answered).length;
  const correct = session.questions.filter((q) => q.answered && q.correct).length;
  const incorrect = answered - correct;
  const latest = latestByCard(session);
  const cards = latest.size;
  const mastered = streaks
    ? [...latest.values()].filter((q) => (streaks.get(String(q.flashcardId)) ?? 0) >= MASTERY_STREAK).length
    : [...latest.values()].filter((q) => q.answered && q.correct).length;
  const firstTryCorrect = session.questions.filter((q) => (q.round ?? 1) === 1 && q.answered && q.correct).length;
  const rounds = session.questions.reduce((max, q) => Math.max(max, q.round ?? 1), 1);
  return { total, answered, correct, incorrect, accuracy: answered ? Math.round((correct / answered) * 100) : 0, cards, mastered, firstTryCorrect, rounds };
}

/** The most recent question for each card, so retries replace earlier misses. */
function latestByCard(session: SessionDoc): Map<number, StoredQuestionDoc> {
  const map = new Map<number, StoredQuestionDoc>();
  session.questions.forEach((q, i) => map.set(q.origin ?? i, q));
  return map;
}

/** Browser-safe view of a session. Answer keys appear only for questions already submitted. */
export function toPublicSession(session: SessionDoc, streaks?: Map<string, number>): PublicSession {
  const questions: PublicQuestion[] = session.questions.map((q, index) => ({
    index,
    type: questionType(q, session),
    round: q.round ?? 1,
    cardIndex: q.origin ?? index,
    prompt: q.prompt,
    hint: q.hint ?? null,
    ...(["multiple-choice", "enumeration-multiple-choice"].includes(questionType(q, session)) ? { options: q.options ?? [] } : {}),
    ...(questionType(q, session) === "true-false" ? { statement: q.statement ?? "" } : {}),
    ...(questionType(q, session) === "enumeration-identification" ? { itemCount: q.expectedItems?.length ?? 0 } : {}),
  }));
  const results: Record<number, QuestionResult> = {};
  session.questions.forEach((q, index) => {
    if (q.answered) results[index] = resultFor(q, session);
  });
  const mastery: Record<number, number> = {};
  session.questions.forEach((q, i) => {
    mastery[q.origin ?? i] = streaks?.get(String(q.flashcardId)) ?? 0;
  });
  return {
    id: String(session._id),
    subjectId: session.subjectId ? String(session.subjectId) : null,
    subjectName: session.subjectName,
    type: session.type,
    status: session.status,
    questions,
    results,
    summary: session.status === "completed" ? summarize(session, streaks) : null,
    cardTotal: latestByCard(session).size,
    mastery,
    masteryTarget: MASTERY_STREAK,
  };
}

export async function loadSession(userId: Types.ObjectId | string, sessionId: string): Promise<SessionDoc | null> {
  if (!isValidObjectId(sessionId)) return null;
  await connectToDatabase();
  const session = await QuizSession.findOne({ _id: sessionId, userId }).lean();
  return (session as unknown as SessionDoc | null) ?? null;
}

type AnswerInput = { questionIndex?: unknown; selectedIndex?: unknown; answer?: unknown; answers?: unknown; truth?: unknown };

export async function submitAnswer(userId: Types.ObjectId | string, sessionId: string, input: AnswerInput) {
  const session = await loadSession(userId, sessionId);
  if (!session) return fail(404, "This quiz session has expired or could not be found.");
  if (session.status === "completed") return fail(409, "This quiz is already finished.");

  const index = input.questionIndex;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= session.questions.length) {
    return fail(400, "That question could not be found.");
  }
  const q = session.questions[index];

  // Repeated request for an answered question: return the saved result, record nothing.
  if (q.answered) return { ok: true as const, duplicate: true, result: resultFor(q, session), progress: summarize(session), mastery: toPublicSession(session, await sessionMastery(userId, session)).mastery };

  let correct: boolean;
  const set: Record<string, unknown> = {};
  const prefix = `questions.${index}`;

  const qType = questionType(q, session);
  if (qType === "multiple-choice" || qType === "enumeration-multiple-choice") {
    const sel = input.selectedIndex;
    if (typeof sel !== "number" || !Number.isInteger(sel) || sel < 0 || sel >= (q.options?.length ?? 0)) {
      return fail(400, qType === "multiple-choice" ? "Choose one of the answer options." : "Choose one of the lists.");
    }
    correct = sel === q.correctIndex;
    set[`${prefix}.selectedIndex`] = sel;
  } else if (qType === "identification") {
    if (typeof input.answer !== "string") return fail(400, "Type your answer first.");
    const typed = sanitizeTyped(input.answer, MAX_TYPED_ANSWER_LENGTH).trim();
    if (!typed) return fail(400, "Type your answer first.");
    // Exact match after normalization only. No substring or fuzzy matching.
    correct = normalizeText(typed) === normalizeText(q.expectedAnswer);
    set[`${prefix}.userAnswer`] = typed;
  } else if (qType === "enumeration-identification") {
    if (!Array.isArray(input.answers) || input.answers.length > ENUM_MAX_ITEMS * 2 || input.answers.some((a) => typeof a !== "string")) {
      return fail(400, "Type the items of the list first.");
    }
    const typed = (input.answers as string[]).map((a) => sanitizeTyped(a, MAX_ENUM_ITEM_LENGTH).trim()).filter(Boolean);
    if (typed.length === 0) return fail(400, "Type at least one item first.");
    correct = gradeEnumeration(q.expectedItems ?? [], typed).correct;
    set[`${prefix}.userAnswers`] = typed;
  } else {
    if (typeof input.truth !== "boolean") return fail(400, "Choose True or False.");
    correct = input.truth === Boolean(q.truth);
  }
  set[`${prefix}.correct`] = correct;
  set[`${prefix}.answered`] = true;
  const now = new Date();
  set[`${prefix}.answeredAt`] = now;

  // Atomic claim: only the first request for this question can flip answered false -> true.
  const claimed = await QuizSession.updateOne(
    { _id: session._id, userId, status: "active", [`${prefix}.answered`]: false },
    { $set: set },
  );
  if (claimed.modifiedCount === 0) {
    const fresh = await loadSession(userId, sessionId);
    if (fresh?.questions[index]?.answered) {
      return { ok: true as const, duplicate: true, result: resultFor(fresh.questions[index], fresh), progress: summarize(fresh), mastery: toPublicSession(fresh, await sessionMastery(userId, fresh)).mastery };
    }
    return fail(409, "This answer could not be saved. Please try again.");
  }

  const resultValue = correct ? "correct" : "wrong";
  try {
    await ReviewRecord.create({
      userId,
      flashcardId: q.flashcardId,
      result: resultValue,
      // Mixed / Random answers are recorded under "random" so that mode keeps its own streak.
      questionType: session.type,
      reviewedAt: now,
      nextReviewAt: computeNextReviewAt(resultValue, now),
    });
  } catch (error) {
    // Undo the claim so the learner can retry and no answer is lost or scored without a record.
    await QuizSession.updateOne(
      { _id: session._id, userId },
      { $set: { [`${prefix}.answered`]: false }, $unset: { [`${prefix}.correct`]: "", [`${prefix}.selectedIndex`]: "", [`${prefix}.userAnswer`]: "", [`${prefix}.userAnswers`]: "", [`${prefix}.answeredAt`]: "" } },
    );
    console.error("Unable to save review record.", error);
    return fail(500, "We couldn’t save that answer. Please try again.");
  }

  const fresh = await loadSession(userId, sessionId);
  if (!fresh) return fail(404, "This quiz session has expired or could not be found.");
  const streaks = await sessionMastery(userId, fresh);
  return { ok: true as const, duplicate: false, result: resultFor(fresh.questions[index], fresh), progress: summarize(fresh), mastery: toPublicSession(fresh, streaks).mastery };
}

export async function finishSession(userId: Types.ObjectId | string, sessionId: string) {
  const session = await loadSession(userId, sessionId);
  if (!session) return fail(404, "This quiz session has expired or could not be found.");
  if (session.questions.some((q) => !q.answered)) return fail(409, "Answer every question before finishing.");

  let streaks = await sessionMastery(userId, session);

  if (session.status === "active") {
    // A review is complete only when every card has reached the mastery streak.
    // Cards that are not mastered yet come back in a new round (wrong answers reset the streak).
    const pending = [...latestByCard(session).entries()].filter(([, q]) => (streaks.get(String(q.flashcardId)) ?? 0) < MASTERY_STREAK);
    if (pending.length > 0) {
      const usable = await loadUsableCards(userId);
      const byId = new Map(usable.map((c) => [c.id, c]));
      const round = session.questions.reduce((max, q) => Math.max(max, q.round ?? 1), 1) + 1;
      const next = shuffle(pending).flatMap(([origin, q]) => {
        const card = byId.get(String(q.flashcardId));
        const built = card ? buildQuestionForCard(card, usable, session.type) : null;
        return built ? [{ ...built, flashcardId: new Types.ObjectId(built.flashcardId), round, origin, answered: false }] : [];
      });
      if (next.length > 0) {
        const n = session.questions.length;
        // Guard: only one concurrent finish can append this round.
        await QuizSession.updateOne(
          { _id: session._id, userId, status: "active", [`questions.${n}`]: { $exists: false } },
          { $push: { questions: { $each: next } } },
        );
        const fresh = await loadSession(userId, sessionId);
        if (!fresh) return fail(404, "This quiz session has expired or could not be found.");
        streaks = await sessionMastery(userId, fresh);
        return { ok: true as const, done: false as const, session: toPublicSession(fresh, streaks) };
      }
    }
    await QuizSession.updateOne({ _id: session._id, userId, status: "active" }, { $set: { status: "completed", completedAt: new Date() } });
  }
  const fresh = await loadSession(userId, sessionId);
  if (!fresh || fresh.status !== "completed") return fail(500, "We couldn’t finish this review. Please try again.");
  return { ok: true as const, done: true as const, summary: summarize(fresh, streaks) };
}


