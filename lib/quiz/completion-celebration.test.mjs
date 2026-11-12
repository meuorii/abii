import assert from "node:assert/strict";
import test from "node:test";
import { claimCompletionCelebration } from "./completion-celebration.mjs";

test("only a newly transitioned session can claim celebration, and only once", () => {
  const claimed = new Set();
  assert.equal(claimCompletionCelebration("session-a", false, claimed), false);
  assert.equal(claimCompletionCelebration("session-a", true, claimed), true);
  assert.equal(claimCompletionCelebration("session-a", true, claimed), false);
  assert.equal(claimCompletionCelebration("session-b", true, claimed), true);
  assert.equal(claimCompletionCelebration("", true, claimed), false);
});
