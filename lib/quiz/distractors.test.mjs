import test from "node:test";
import assert from "node:assert/strict";
import { buildEnumerationWrongLists } from "./distractors.mjs";

test("enumeration distractors keep the target list length and contain unique items", () => {
  const correct = ["Red", "Blue", "Yellow"];
  const wrong = buildEnumerationWrongLists(correct, ["Green", "Purple"], ["Orange", "Brown", "Black"], 3);
  assert.ok(wrong.length > 0);
  for (const option of wrong) {
    assert.equal(option.length, correct.length);
    assert.equal(new Set(option.map((item) => item.toLowerCase())).size, correct.length);
    assert.notDeepEqual([...option].map((x) => x.toLowerCase()).sort(), [...correct].map((x) => x.toLowerCase()).sort());
  }
  assert.equal(new Set(wrong.map((option) => option.map((x) => x.toLowerCase()).sort().join("|"))).size, wrong.length);
});

test("distractors are empty when there are no foreign candidates", () => {
  assert.deepEqual(buildEnumerationWrongLists(["A", "B", "C"], [], [], 3), []);
});

test("one valid foreign item can make a valid exact-length wrong list", () => {
  const wrong = buildEnumerationWrongLists(["A", "B", "C", "D", "E"], ["X"], [], 3);
  assert.ok(wrong.length > 0);
  assert.ok(wrong.every((option) => option.length === 5 && option.includes("X")));
});

test("normalized duplicates and target collisions are excluded", () => {
  const wrong = buildEnumerationWrongLists(["Red", "Blue", "Yellow"], [" red ", "GREEN", "green"], ["BLUE", "Purple"], 3);
  assert.ok(wrong.length > 0);
  for (const option of wrong) {
    assert.equal(option.length, 3);
    assert.equal(new Set(option.map((item) => item.toLowerCase().trim())).size, 3);
    assert.notDeepEqual([...option].map((x) => x.toLowerCase().trim()).sort(), ["blue", "red", "yellow"]);
  }
  assert.equal(new Set(wrong.map((option) => option.map((x) => x.toLowerCase().trim()).sort().join("|"))).size, wrong.length);
});
