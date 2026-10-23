import test from "node:test";
import assert from "node:assert/strict";
import { canPlayAbiiSound, getAnswerSound, resolveAbiiSoundVolume, resumeAbiiAudioContext, shouldPlayCompletionSound } from "./sounds-core.mjs";

test("answer sound selection requires a newly returned boolean grade", () => {
  assert.equal(getAnswerSound({ correct: true }), "correct");
  assert.equal(getAnswerSound({ correct: false }), "wrong");
  assert.equal(getAnswerSound({ correct: true }, true), null);
  assert.equal(getAnswerSound(undefined), null);
  assert.equal(getAnswerSound({}), null);
});

test("completion sound gate permits each session transition only once", () => {
  const played = new Set();
  assert.equal(shouldPlayCompletionSound("quiz-a", played), true);
  assert.equal(shouldPlayCompletionSound("quiz-a", played), false);
  assert.equal(shouldPlayCompletionSound("quiz-b", played), true);
  assert.equal(shouldPlayCompletionSound("", played), false);
});

test("volume resolution uses 42% for missing or invalid values and preserves explicit values", () => {
  const cases = [
    [null, 42],
    ["", 42],
    ["   ", 42],
    ["not-a-volume", 42],
    ["0", 0],
    ["25", 25],
    ["100", 100],
    ["150", 100],
    ["-10", 0],
  ];
  for (const [stored, expected] of cases) {
    assert.equal(resolveAbiiSoundVolume(stored), expected, `stored ${JSON.stringify(stored)}`);
  }
});

test("mute and zero volume suppress all quiz and preview playback", () => {
  assert.equal(canPlayAbiiSound(true, 42), true);
  assert.equal(canPlayAbiiSound(false, 42), false);
  assert.equal(canPlayAbiiSound(true, 0), false);
  assert.equal(canPlayAbiiSound(true, 100), true);
});

test("suspended audio contexts are resumed and running contexts are reused", async () => {
  let resumeCalls = 0;
  const suspended = {
    state: "suspended",
    resume: async () => { resumeCalls += 1; suspended.state = "running"; },
  };
  assert.equal(await resumeAbiiAudioContext(suspended), true);
  assert.equal(await resumeAbiiAudioContext(suspended), false);
  assert.equal(resumeCalls, 1);
});
