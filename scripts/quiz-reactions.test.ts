import assert from "node:assert/strict";
import test from "node:test";
import { resolveQuizReaction } from "../lib/quiz/reactions";

test("ungraded selections and drafts never receive a grading reaction", () => {
  assert.equal(resolveQuizReaction({ hasSelection: true, seed: 4 })?.kind, "selection");
  assert.equal(resolveQuizReaction({ hasDraft: true, seed: 4 })?.kind, "typing");
  assert.equal(resolveQuizReaction({ seed: 4 }), null);
});

test("correct and incorrect reactions require and follow a graded result", () => {
  assert.equal(resolveQuizReaction({ gradedResult: { correct: true }, hasSelection: true, seed: 2 })?.kind, "correct");
  assert.equal(resolveQuizReaction({ gradedResult: { correct: false }, hasDraft: true, seed: 2 })?.kind, "incorrect");
});

test("reaction text is stable for a state and seed, and varies across seeds", () => {
  const first = resolveQuizReaction({ hasSelection: true, seed: 0 });
  assert.deepEqual(resolveQuizReaction({ hasSelection: true, seed: 0 }), first);
  assert.notEqual(resolveQuizReaction({ hasSelection: true, seed: 1 })?.message, first?.message);
});
