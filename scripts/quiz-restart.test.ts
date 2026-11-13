import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewAgainInput } from "../lib/quiz/restart-input";

test("Review Again preserves topic scope, mode, and due-review intent", () => {
  assert.deepEqual(reviewAgainInput({
    scope: "topic", subjectId: "subject-1", topicId: "topic-1", type: "identification", reviewFilter: "due",
  }), { scope: "topic", subjectId: "subject-1", topicId: "topic-1", type: "identification", reviewFilter: "due" });
});

test("legacy sessions without scope or filter keep regular review defaults", () => {
  assert.deepEqual(reviewAgainInput({ subjectId: "subject-1", type: "multiple-choice" }), {
    scope: "subject", subjectId: "subject-1", type: "multiple-choice", reviewFilter: "all",
  });
});
