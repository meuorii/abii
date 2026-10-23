import test from "node:test";
import assert from "node:assert/strict";
import { classifyFinishResponse, isPublicSessionForId } from "./finish-response.mjs";

const summary = { total: 3, answered: 3, correct: 2, incorrect: 1, accuracy: 67, cards: 2, mastered: 2, firstTryCorrect: 1, rounds: 2 };
function session(status = "completed") {
  return {
    id: "session-1", status, subjectId: "subject-1", subjectName: "Science", type: "identification",
    questions: [
      { index: 0, type: "identification", prompt: "First", round: 1, cardIndex: 0 },
      { index: 1, type: "identification", prompt: "Second", round: 1, cardIndex: 1 },
      { index: 2, type: "identification", prompt: "First", round: 2, cardIndex: 0 },
    ],
    results: { 0: { correct: false, correctAnswer: "A", explanation: "A" }, 1: { correct: true, correctAnswer: "B", explanation: "B" }, 2: { correct: true, correctAnswer: "A", explanation: "A" } },
    summary: status === "completed" ? summary : null, cardTotal: 2, mastery: { 0: 2, 1: 2 }, masteryTarget: 2,
    completedAt: status === "completed" ? "2026-10-23T00:00:00.000Z" : null,
  };
}

test("completed response transitions an active quiz to the complete session with retry history", () => {
  const completed = session();
  const result = classifyFinishResponse({ summary, session: completed }, "session-1");
  assert.equal(result.kind, "complete");
  if (result.kind === "complete") {
    assert.equal(result.session.status, "completed");
    assert.equal(result.session.questions.length, 3);
    assert.equal(Object.keys(result.session.results).length, 3);
    assert.equal(result.session.summary.accuracy, 67);
  }
});

test("retry response retains previous attempts and stays active", () => {
  const active = session("active");
  active.questions.push({ index: 3, type: "identification", prompt: "Retry", round: 3, cardIndex: 0 });
  const result = classifyFinishResponse({ retry: true, session: active }, "session-1");
  assert.equal(result.kind, "retry");
  if (result.kind === "retry") {
    assert.equal(result.session.status, "active");
    assert.equal(result.session.questions.length, 4);
    assert.equal(Object.keys(result.session.results).length, 3);
  }
});

test("inconsistent completion payload is rejected for persisted-session recovery", () => {
  assert.equal(classifyFinishResponse({ summary, session: session("active") }, "session-1").kind, "invalid");
  assert.equal(classifyFinishResponse({ summary: { ...summary, accuracy: 99 }, session: session() }, "session-1").kind, "invalid");
  assert.equal(classifyFinishResponse({ summary, session: session() }, "another-user-session").kind, "invalid");
});

test("owner session validation requires a real matching id and status-consistent summary", () => {
  assert.equal(isPublicSessionForId(session(), "session-1"), true);
  assert.equal(isPublicSessionForId(session("active"), "session-1"), true);
  assert.equal(isPublicSessionForId({ ...session("active"), summary }, "session-1"), false);
  assert.equal(isPublicSessionForId(session(), "other-session"), false);
});
