import assert from "node:assert/strict";
import { test } from "node:test";
import { priorMistakeState, prioritizePending, type RoundAttempt } from "../lib/quiz/round-priority";

const noShuffle = <T,>(items: T[]) => items;

test("wrong answers come first, with each priority group shuffled independently", () => {
  const ordered = prioritizePending([
    { card: "A", correct: true }, { card: "B", correct: false },
    { card: "C", correct: true }, { card: "D", correct: false },
  ], noShuffle);
  assert.deepEqual(ordered.map(({ card }) => card), ["B", "D", "A", "C"]);
  const calls: string[][] = [];
  prioritizePending([{ card: "A", correct: true }, { card: "B", correct: false }], (items) => {
    calls.push(items.map((item) => item.card));
    return items;
  });
  assert.deepEqual(calls, [["B"], ["A"]]);
});

test("continuous priority follows the most recent attempt while mistake history persists", () => {
  const round2: RoundAttempt[] = [
    { origin: 1, round: 2, answered: true, correct: true },
    { origin: 3, round: 2, answered: true, correct: false },
    { origin: 0, round: 2, answered: true, correct: true },
    { origin: 2, round: 2, answered: true, correct: true },
  ];
  const pending = round2.filter((question) => question.origin !== undefined).map((question) => ({ ...question, correct: question.correct }));
  assert.deepEqual(prioritizePending(pending, noShuffle).map((q) => q.origin), [3, 1, 0, 2]);
  assert.deepEqual(priorMistakeState<RoundAttempt>({ origin: 1, round: 3 }, [
    { origin: 1, round: 1, answered: true, correct: false },
    ...round2,
  ]), { previouslyIncorrect: true, incorrectLastRound: false });
  assert.deepEqual(priorMistakeState<RoundAttempt>({ origin: 3, round: 3 }, round2), { previouslyIncorrect: true, incorrectLastRound: true });
});

test("first round is not labeled and all-correct eligible cards remain pending", () => {
  assert.deepEqual(priorMistakeState({ origin: 0, round: 1 }, []), { previouslyIncorrect: false, incorrectLastRound: false });
  assert.deepEqual(prioritizePending([{ card: "A", correct: true }, { card: "B", correct: true }], noShuffle).map((q) => q.card), ["A", "B"]);
});
