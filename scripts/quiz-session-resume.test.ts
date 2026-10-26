import test from "node:test";
import assert from "node:assert/strict";
import { currentRoundProgress, firstUnansweredQuestion } from "../lib/quiz/resume-state";

test("resume returns the first unanswered question without changing saved order", () => {
  assert.equal(firstUnansweredQuestion([{ answered: true }, { answered: true }, { answered: false }, { answered: false }]), 2);
});

test("fully answered saved round resumes on its last question for the finish action", () => {
  assert.equal(firstUnansweredQuestion([{ answered: true }, { answered: true }]), 1);
});

test("active card reports only retry-round progress", () => {
  const progress = currentRoundProgress([
    ...Array.from({ length: 10 }, () => ({ round: 1, answered: true })),
    { round: 2, answered: true }, { round: 2, answered: false }, { round: 2, answered: false },
  ]);
  assert.deepEqual(progress, { currentRound: 2, totalQuestions: 3, answeredCount: 1, progress: 33, readyToFinish: false });
});

test("completed current round is labeled ready to finish, including an empty session safely", () => {
  assert.equal(currentRoundProgress([{ round: 1, answered: true }]).readyToFinish, true);
  assert.deepEqual(currentRoundProgress([]), { currentRound: 1, totalQuestions: 0, answeredCount: 0, progress: 0, readyToFinish: false });
});
