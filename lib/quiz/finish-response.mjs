const SUMMARY_FIELDS = ["total", "answered", "correct", "incorrect", "accuracy", "cards", "mastered", "firstTryCorrect", "rounds"];

export function isQuizSummary(value) {
  return Boolean(value && typeof value === "object" && SUMMARY_FIELDS.every((field) => Number.isFinite(value[field])));
}

export function isPublicSessionForId(value, expectedId) {
  return Boolean(
    value && typeof value === "object" && value.id === expectedId &&
    (value.status === "active" || value.status === "completed") &&
    Array.isArray(value.questions) && value.results && typeof value.results === "object" &&
    value.mastery && typeof value.mastery === "object" &&
    (value.status === "active" ? value.summary === null : isQuizSummary(value.summary)),
  );
}

export function classifyFinishResponse(value, expectedId) {
  if (!value || typeof value !== "object" || !isPublicSessionForId(value.session, expectedId)) return { kind: "invalid" };
  const { session } = value;
  if (value.retry === true && session.status === "active") return { kind: "retry", session };
  if (session.status === "completed" && isQuizSummary(value.summary) &&
      SUMMARY_FIELDS.every((field) => value.summary[field] === session.summary[field])) {
    return { kind: "complete", session };
  }
  return { kind: "invalid" };
}
