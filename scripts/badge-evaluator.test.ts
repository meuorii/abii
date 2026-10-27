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
