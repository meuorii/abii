import test from "node:test";
import assert from "node:assert/strict";
import { demoQuestions } from "../components/landing/demo-data";
import { gradeLandingDemoAnswer } from "../lib/landing-demo-grading";

test("multiple choice grading matches the local answer exactly after normalization", () => {
  const question = demoQuestions["multiple-choice"][0];
  assert.equal(gradeLandingDemoAnswer("multiple-choice", question, [" Cell "]), true);
  assert.equal(gradeLandingDemoAnswer("multiple-choice", question, ["Tissue"]), false);
  assert.equal(gradeLandingDemoAnswer("multiple-choice", question, []), false);
});

test("identification accepts listed variants without case or whitespace sensitivity", () => {
  const question = demoQuestions.identification[0];
  assert.equal(gradeLandingDemoAnswer("identification", question, ["  mitochondria  "]), true);
  assert.equal(gradeLandingDemoAnswer("identification", question, ["ribosome"]), false);
});

test("true or false answers are compared against the local boolean label", () => {
  const question = demoQuestions["true-false"][0];
  assert.equal(gradeLandingDemoAnswer("true-false", question, ["TRUE"]), true);
  assert.equal(gradeLandingDemoAnswer("true-false", question, ["false"]), false);
});

test("enumeration matches the expected set in any order and rejects duplicates or omissions", () => {
  const question = demoQuestions.enumeration[0];
  assert.equal(gradeLandingDemoAnswer("enumeration", question, ["Nucleus", "cell membrane", " Cytoplasm "]), true);
  assert.equal(gradeLandingDemoAnswer("enumeration", question, ["Nucleus", "nucleus", "Cytoplasm"]), false);
  assert.equal(gradeLandingDemoAnswer("enumeration", question, ["Nucleus", "Cytoplasm", "Cell wall"]), false);
});
