import assert from "node:assert/strict";
import { test } from "node:test";
import { changedOtpPositions, nextOtpCaretPosition, otpDigitDelay, sanitizeOtpInput, shouldCascadeOtp } from "../components/auth/otp-input-state";

test("OTP input sanitizes numeric typing and preserves leading zeroes", () => {
  assert.equal(sanitizeOtpInput("012-34 5"), "012345");
  assert.equal(sanitizeOtpInput("987654321"), "987654");
  assert.equal(sanitizeOtpInput(""), "");
});

test("only changed OTP slots are marked for digit pop-in", () => {
  assert.deepEqual(changedOtpPositions("", "4"), [0]);
  assert.deepEqual(changedOtpPositions("4", "47"), [1]);
  assert.deepEqual(changedOtpPositions("01234", "012345"), [5]);
  assert.deepEqual(changedOtpPositions("012345", "01234"), [5]);
  assert.deepEqual(changedOtpPositions("44", "454"), [1, 2]);
  assert.deepEqual(changedOtpPositions("123456", "123956"), [3]);
  assert.deepEqual(changedOtpPositions("123456", "123456"), []);
});

test("pasted and autofilled codes populate all six stable positions immediately", () => {
  const pasted = sanitizeOtpInput("012345");
  assert.equal(pasted, "012345");
  assert.deepEqual(changedOtpPositions("", pasted), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(index => otpDigitDelay(index, true)), [0, 30, 60, 90, 120, 150]);
  assert.equal(otpDigitDelay(5, false), 0);
  assert.equal(shouldCascadeOtp("", pasted, false), true);
  assert.equal(shouldCascadeOtp("01234", pasted, false), false);
  assert.equal(shouldCascadeOtp("123456", "123956", false), false);
  assert.equal(shouldCascadeOtp("", "12", true), true);
});

test("OTP arrow navigation clamps to the six-digit input boundaries", () => {
  assert.equal(nextOtpCaretPosition(3, "left"), 2);
  assert.equal(nextOtpCaretPosition(3, "right"), 4);
  assert.equal(nextOtpCaretPosition(0, "left"), 0);
  assert.equal(nextOtpCaretPosition(6, "right"), 6);
});
