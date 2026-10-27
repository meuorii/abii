import assert from "node:assert/strict";
import { test } from "node:test";
import { BADGE_CATALOG } from "../lib/badges/catalog";
import { evaluateBadgeCatalog } from "../lib/badges/evaluator";
import type { AchievementMetrics } from "../lib/badges/metrics";

function fixture(): AchievementMetrics {
  const fullSubjects = Array.from({ length: 5 }, (_, index) => ({ subjectId: `subject-${index}`, totalCards: 10, masteredCards: 10, progressPercent: 100, genuinelyComplete: true }));
  return {
    userId: "012345678901234567890123",
    evaluatedAt: new Date("2025-01-01T00:00:00Z"),
    timezone: "UTC",
    subjectCount: 1,
    subjectIds: ["subject-0", "subject-1", "subject-2", "subject-3", "subject-4"],
    flashcardIds: [],
    flashcardCount: 10,
    distinctSubjectsWithFlashcards: 3,
    subjectIdsWithFlashcards: ["subject-0", "subject-1", "subject-2"],
    subjectCreationCompleteness: "current-state",
    flashcardCreationCompleteness: "verified-minimum",
    creationTimestamps: [],
    studyDayKeys: [],
    currentStudyStreak: 0,
    longestStudyStreak: 30,
    completedQuizCount: 1,
    completedQuizSessionIds: ["quiz-0"],
    completedQuizDayKeys: Array.from({ length: 50 }, (_, index) => `2024-01-${String(index + 1).padStart(2, "0")}`),
    firstQuizCompleted: true,
    quizHistoryCompleteness: "verified-minimum",
    qualifyingQuizScores: [{ scorePercent: 100, originalQuestionCount: 10, completedAt: new Date("2024-01-01T00:00:00Z"), evidenceId: "quiz:1" }],
    correctQuizAnswers: 100,
    distinctCorrectQuestionIdentities: 100,
    enumerationFullyCorrectAnswers: 10,
    resumedQuizCompletions: 1,
    resumedQuizSessionIds: ["quiz-resumed"],
    subjectsWithFlashcards: fullSubjects,
    masteryThresholdSubjectIds: {
      25: fullSubjects.map((subject) => subject.subjectId),
      50: fullSubjects.map((subject) => subject.subjectId),
      75: fullSubjects.map((subject) => subject.subjectId),
      100: fullSubjects.map((subject) => subject.subjectId),
    },
    fullyMasteredSubjectCount: 5,
  };
}

function emptyMetrics(): AchievementMetrics {
  const metrics = fixture();
  metrics.subjectCount = 0;
  metrics.subjectIds = [];
  metrics.flashcardIds = [];
  metrics.flashcardCount = 0;
  metrics.distinctSubjectsWithFlashcards = 0;
  metrics.subjectIdsWithFlashcards = [];
  metrics.subjectCreationCompleteness = "incomplete";
  metrics.flashcardCreationCompleteness = "incomplete";
  metrics.creationTimestamps = [];
  metrics.studyDayKeys = [];
  metrics.currentStudyStreak = 0;
  metrics.longestStudyStreak = 0;
  metrics.completedQuizCount = 0;
  metrics.completedQuizSessionIds = [];
  metrics.completedQuizDayKeys = [];
  metrics.firstQuizCompleted = false;
  metrics.quizHistoryCompleteness = "incomplete";
  metrics.qualifyingQuizScores = [];
  metrics.correctQuizAnswers = 0;
  metrics.distinctCorrectQuestionIdentities = 0;
  metrics.enumerationFullyCorrectAnswers = 0;
  metrics.resumedQuizCompletions = 0;
  metrics.resumedQuizSessionIds = [];
  metrics.subjectsWithFlashcards = [];
  metrics.masteryThresholdSubjectIds = { 25: [], 50: [], 75: [], 100: [] };
  metrics.fullyMasteredSubjectCount = 0;
  return metrics;
}

test("catalog evaluation unlocks at exact thresholds, stacks milestones, and never unlocks below evidence", () => {
  const all = evaluateBadgeCatalog(fixture());
  assert.equal(all.length, 18);
  assert.equal(all.filter((result) => result.unlocked).length, 18);
  assert.equal(all.find((result) => result.badgeId === "sharp-mind")?.progressLabel.includes("80%"), true);
  assert.equal(all.find((result) => result.badgeId === "perfect-pearl")?.unlocked, true);
  assert.equal(all.find((result) => result.badgeId === "ultimate-scholar")?.unlocked, true);

  const fiftyFive = fixture();
  fiftyFive.subjectsWithFlashcards = [{ subjectId: "s55", totalCards: 20, masteredCards: 11, progressPercent: 55, genuinelyComplete: false }];
  fiftyFive.masteryThresholdSubjectIds = { 25: ["s55"], 50: ["s55"], 75: [], 100: [] };
  fiftyFive.fullyMasteredSubjectCount = 0;
  const fiftyFiveResults = evaluateBadgeCatalog(fiftyFive);
  assert.equal(fiftyFiveResults.find((result) => result.badgeId === "growing-knowledge")?.unlocked, true);
  assert.equal(fiftyFiveResults.find((result) => result.badgeId === "halfway-genius")?.unlocked, true);
  assert.equal(fiftyFiveResults.find((result) => result.badgeId === "memory-pro")?.unlocked, false);

  const eighty = fixture();
  eighty.subjectsWithFlashcards = [{ subjectId: "s80", totalCards: 20, masteredCards: 16, progressPercent: 80, genuinelyComplete: false }];
  eighty.masteryThresholdSubjectIds = { 25: ["s80"], 50: ["s80"], 75: ["s80"], 100: [] };
  eighty.fullyMasteredSubjectCount = 0;
  const eightyResults = evaluateBadgeCatalog(eighty);
  for (const id of ["growing-knowledge", "halfway-genius", "memory-pro"]) assert.equal(eightyResults.find((result) => result.badgeId === id)?.unlocked, true);
  assert.equal(eightyResults.find((result) => result.badgeId === "mastermind-abii")?.unlocked, false);

  const below = fixture();
  below.subjectCount = 0;
  below.flashcardCount = 9;
  below.distinctSubjectsWithFlashcards = 2;
  below.longestStudyStreak = 2;
  below.completedQuizCount = 0;
  below.completedQuizDayKeys = [];
  below.firstQuizCompleted = false;
  below.quizHistoryCompleteness = "incomplete";
  below.qualifyingQuizScores = [];
  below.correctQuizAnswers = 99;
  below.enumerationFullyCorrectAnswers = 9;
  below.resumedQuizCompletions = 0;
  below.subjectsWithFlashcards = [{ subjectId: "partial", totalCards: 100, masteredCards: 24, progressPercent: 24, genuinelyComplete: false }];
  below.masteryThresholdSubjectIds = { 25: [], 50: [], 75: [], 100: [] };
  below.fullyMasteredSubjectCount = 0;
  const locked = evaluateBadgeCatalog(below);
  assert.equal(locked.filter((result) => result.unlocked).length, 0);
  assert.equal(locked.find((result) => result.badgeId === "sharp-mind")?.evidenceCompleteness, "incomplete");

  const partialQuiz = fixture();
  partialQuiz.qualifyingQuizScores = [{ scorePercent: 80, originalQuestionCount: 10, completedAt: new Date("2025-01-01"), evidenceId: "eligible-quiz" }];
  const partialQuizResults = evaluateBadgeCatalog(partialQuiz);
  assert.equal(partialQuizResults.find((result) => result.badgeId === "sharp-mind")?.unlocked, true);
  assert.equal(partialQuizResults.find((result) => result.badgeId === "perfect-pearl")?.unlocked, false);
  assert.match(partialQuizResults.find((result) => result.badgeId === "perfect-pearl")?.progressLabel ?? "", /8 \/ 10/);

  const liveStreak = fixture();
  liveStreak.currentStudyStreak = 4;
  liveStreak.longestStudyStreak = 4;
  const rhythm = evaluateBadgeCatalog(liveStreak).find((result) => result.badgeId === "weekly-wonder");
  assert.equal(rhythm?.remaining, 3);
  assert.match(rhythm?.progressLabel ?? "", /Current streak: 4 days/);

  const masteryProgress = fixture();
  masteryProgress.subjectsWithFlashcards = [{ subjectId: "s62", totalCards: 50, masteredCards: 31, progressPercent: 62, genuinelyComplete: false }];
  masteryProgress.masteryThresholdSubjectIds = { 25: ["s62"], 50: ["s62"], 75: [], 100: [] };
  masteryProgress.fullyMasteredSubjectCount = 0;
  const memoryPro = evaluateBadgeCatalog(masteryProgress).find((result) => result.badgeId === "memory-pro");
  assert.equal(memoryPro?.remaining, 13);
  assert.match(memoryPro?.progressLabel ?? "", /Best subject mastery: 62%/);

  const roundedButNotMastered = fixture();
  roundedButNotMastered.subjectsWithFlashcards = [{ subjectId: "almost", totalCards: 4, masteredCards: 3, progressPercent: 100, genuinelyComplete: false }];
  roundedButNotMastered.masteryThresholdSubjectIds = { 25: ["almost"], 50: ["almost"], 75: ["almost"], 100: [] };
  roundedButNotMastered.fullyMasteredSubjectCount = 0;
  assert.equal(evaluateBadgeCatalog(roundedButNotMastered).find((result) => result.badgeId === "mastermind-abii")?.unlocked, false);
  assert.ok(BADGE_CATALOG.every((definition) => all.some((result) => result.badgeId === definition.id)));
});

test("each achievement rule qualifies independently at its exact metric threshold", () => {
  const cases: [string, (metrics: AchievementMetrics) => void][] = [
    ["hello-abii", (m) => { m.subjectCount = 1; }],
    ["card-creator", (m) => { m.flashcardCount = 10; }],
    ["quiz-rookie", (m) => { m.completedQuizCount = 1; }],
    ["little-explorer", (m) => { m.distinctSubjectsWithFlashcards = 3; }],
    ["getting-into-rhythm", (m) => { m.currentStudyStreak = 3; m.longestStudyStreak = 3; }],
    ["weekly-wonder", (m) => { m.currentStudyStreak = 7; m.longestStudyStreak = 7; }],
    ["dedicated-otter", (m) => { m.currentStudyStreak = 30; m.longestStudyStreak = 30; }],
    ["study-superstar", (m) => { m.completedQuizDayKeys = Array.from({ length: 50 }, (_, i) => new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10)); }],
    ["sharp-mind", (m) => { m.qualifyingQuizScores = [{ scorePercent: 80, originalQuestionCount: 10, completedAt: new Date("2025-01-01"), evidenceId: "sharp-fixture" }]; }],
    ["perfect-pearl", (m) => { m.qualifyingQuizScores = [{ scorePercent: 100, originalQuestionCount: 10, completedAt: new Date("2025-01-01"), evidenceId: "perfect-fixture" }]; }],
    ["recall-detective", (m) => { m.correctQuizAnswers = 100; }],
    ["enumeration-expert", (m) => { m.enumerationFullyCorrectAnswers = 10; }],
    ["finish-line", (m) => { m.resumedQuizCompletions = 1; }],
    ["growing-knowledge", (m) => { m.subjectsWithFlashcards = [{ subjectId: "s25", totalCards: 4, masteredCards: 1, progressPercent: 25, genuinelyComplete: false }]; m.masteryThresholdSubjectIds[25] = ["s25"]; }],
    ["halfway-genius", (m) => { m.subjectsWithFlashcards = [{ subjectId: "s50", totalCards: 2, masteredCards: 1, progressPercent: 50, genuinelyComplete: false }]; m.masteryThresholdSubjectIds[50] = ["s50"]; }],
    ["memory-pro", (m) => { m.subjectsWithFlashcards = [{ subjectId: "s75", totalCards: 4, masteredCards: 3, progressPercent: 75, genuinelyComplete: false }]; m.masteryThresholdSubjectIds[75] = ["s75"]; }],
    ["mastermind-abii", (m) => { m.subjectsWithFlashcards = [{ subjectId: "s100", totalCards: 1, masteredCards: 1, progressPercent: 100, genuinelyComplete: true }]; m.masteryThresholdSubjectIds[100] = ["s100"]; }],
    ["ultimate-scholar", (m) => { m.masteryThresholdSubjectIds[100] = ["s1", "s2", "s3", "s4", "s5"]; m.fullyMasteredSubjectCount = 5; }],
  ];

  assert.equal(cases.length, 18);
  for (const [badgeId, prepare] of cases) {
    const metrics = emptyMetrics();
    prepare(metrics);
    const result = evaluateBadgeCatalog(metrics).find((badge) => badge.badgeId === badgeId);
    assert.equal(result?.unlocked, true, `${badgeId} should qualify at its threshold`);
  }
});
