import { BADGE_CATALOG } from "./catalog";
import type { BadgeId, BadgeProgressMetric } from "./types";
import type { AchievementMetrics, EvidenceCompleteness } from "./metrics";

export type BadgeEvaluation = {
  badgeId: BadgeId;
  unlocked: boolean;
  alreadyEarned: boolean;
  progress: number;
  target: number;
  remaining: number;
  progressLabel: string;
  evidenceCompleteness: EvidenceCompleteness;
  historicalNote?: string;
  evidenceSubjectId?: string;
  evidenceId?: string;
};

function metricValue(metrics: AchievementMetrics, metric: BadgeProgressMetric): { value: number; completeness: EvidenceCompleteness } {
  switch (metric) {
    case "current-subject-count": return { value: metrics.subjectCount, completeness: metrics.subjectCreationCompleteness };
    case "current-flashcard-count": return { value: metrics.flashcardCount, completeness: metrics.flashcardCreationCompleteness };
    case "current-subjects-with-flashcards": return { value: metrics.distinctSubjectsWithFlashcards, completeness: metrics.flashcardCreationCompleteness };
    case "consecutive-study-days": return { value: metrics.longestStudyStreak, completeness: metrics.studyDayKeys.length ? "verified-minimum" : "incomplete" };
    case "distinct-quiz-completion-days": return { value: metrics.completedQuizDayKeys.length, completeness: metrics.quizHistoryCompleteness };
    case "completed-quiz-count": return { value: metrics.completedQuizCount, completeness: metrics.quizHistoryCompleteness };
    case "qualifying-quiz-score": return { value: metrics.qualifyingQuizScores.some((score) => score.originalQuestionCount >= 10) ? 1 : 0, completeness: metrics.quizHistoryCompleteness };
    case "qualifying-correct-quiz-answers": return { value: metrics.correctQuizAnswers, completeness: metrics.correctQuizAnswers ? "verified-minimum" : "incomplete" };
    case "fully-correct-enumeration-answers": return { value: metrics.enumerationFullyCorrectAnswers, completeness: metrics.enumerationFullyCorrectAnswers ? "verified-minimum" : "incomplete" };
    case "resumed-quiz-completions": return { value: metrics.resumedQuizCompletions, completeness: metrics.quizHistoryCompleteness };
    case "current-subject-mastery": return { value: Math.max(0, ...metrics.subjectsWithFlashcards.map((subject) => subject.progressPercent)), completeness: "current-state" };
    case "subjects-reaching-mastery-milestone": return { value: metrics.fullyMasteredSubjectCount, completeness: "verified-minimum" };
  }
}

function readableProgress(metric: BadgeProgressMetric, progress: number, target: number, threshold?: number) {
  const current = Math.min(progress, target);
  const left = Math.max(0, target - progress);
  switch (metric) {
    case "current-subject-count": return `${current} / ${target} subjects`;
    case "current-flashcard-count": return `${current} / ${target} flashcards`;
    case "current-subjects-with-flashcards": return `${current} / ${target} subjects with flashcards`;
    case "consecutive-study-days": return `${current} / ${target} consecutive days`;
    case "distinct-quiz-completion-days": return `${current} / ${target} quiz days`;
    case "completed-quiz-count": return `${current} / ${target} completed quizzes`;
    case "qualifying-quiz-score": return threshold === undefined ? `${current} / ${target} qualifying quizzes` : `${current ? "Qualified" : "Not yet qualified"} · at least ${threshold}%`;
    case "qualifying-correct-quiz-answers": return `${current} / ${target} correct answers`;
    case "fully-correct-enumeration-answers": return `${current} / ${target} complete enumeration answers`;
    case "resumed-quiz-completions": return `${current} / ${target} resumed quizzes completed`;
    case "current-subject-mastery": return `${Math.min(progress, 100)}% / ${threshold ?? target}% mastery`;
    case "subjects-reaching-mastery-milestone": return `${current} / ${target} fully mastered subjects`;
  }
}

export function evaluateBadgeCatalog(metrics: AchievementMetrics, previouslyEarned: ReadonlySet<string> = new Set()): BadgeEvaluation[] {
  return BADGE_CATALOG.map((badge) => {
    const { value, completeness } = metricValue(metrics, badge.requirement.metric);
    let progress = value;
    let evidenceSubjectId: string | undefined;
    let evidenceId: string | undefined;
    let scoreLabel: string | undefined;
    let qualifies = value >= badge.requirement.target;

    if (badge.requirement.metric === "qualifying-quiz-score") {
      const score = metrics.qualifyingQuizScores
        .filter((item) => item.originalQuestionCount >= (badge.requirement.minimumOriginalQuestions ?? 0))
        .filter((item) => item.scorePercent >= (badge.requirement.minimumScorePercent ?? 0))
        .sort((a, b) => b.scorePercent - a.scorePercent)[0];
      progress = score ? badge.requirement.target : 0;
      qualifies = Boolean(score);
      evidenceId = score?.evidenceId;
      scoreLabel = score
        ? `${score.scorePercent}% score · target ${badge.requirement.minimumScorePercent}% on ${score.originalQuestionCount} questions`
        : `Complete a quiz with at least ${badge.requirement.minimumOriginalQuestions} original questions`;
    }

    if (badge.requirement.metric === "current-subject-mastery") {
      const threshold = badge.requirement.target as 25 | 50 | 75 | 100;
      const subjectId = metrics.masteryThresholdSubjectIds[threshold][0];
      const subject = metrics.subjectsWithFlashcards.find((item) => item.subjectId === subjectId);
      const historicalEvidence = Boolean(subjectId && (!subject || (threshold === 100 ? !subject.genuinelyComplete : subject.progressPercent < threshold)));
      progress = historicalEvidence ? threshold : subject?.progressPercent ?? value;
      qualifies = metrics.masteryThresholdSubjectIds[threshold].length > 0;
      evidenceSubjectId = subjectId;
      evidenceId = historicalEvidence ? `mastery-milestone:${threshold}` : undefined;
    }

    if (badge.requirement.metric === "subjects-reaching-mastery-milestone") {
      progress = metrics.masteryThresholdSubjectIds[100].length;
      qualifies = progress >= badge.requirement.target;
      evidenceId = "genuine-100-percent-mastery";
    }

    const alreadyEarned = previouslyEarned.has(badge.id);
    const unlocked = alreadyEarned || qualifies;
    const displayProgress = badge.requirement.metric === "qualifying-quiz-score" ? (qualifies ? 1 : 0) : progress;
    return {
      badgeId: badge.id,
      unlocked,
      alreadyEarned,
      progress: displayProgress,
      target: badge.requirement.target,
      remaining: Math.max(0, badge.requirement.target - displayProgress),
      progressLabel: scoreLabel ?? (badge.requirement.metric === "current-subject-mastery" && unlocked && evidenceId?.startsWith("mastery-milestone:")
        ? `Previously reached ${badge.requirement.target}% mastery`
        : readableProgress(badge.requirement.metric, displayProgress, badge.requirement.target, badge.requirement.minimumScorePercent)),
      evidenceCompleteness: alreadyEarned ? "current-state" : completeness,
      ...(!alreadyEarned && completeness === "incomplete" && (badge.category === "quiz-performance" || badge.id === "study-superstar") ? { historicalNote: "Older completed quiz sessions may have expired; no missing quiz, score, date, or resume evidence is inferred." } : {}),
      ...(!alreadyEarned && completeness === "verified-minimum" && (badge.category === "quiz-performance" || badge.id === "study-superstar") ? { historicalNote: "Verified minimum from surviving sessions and durable records; older completed sessions may have expired." } : {}),
      ...(!alreadyEarned && completeness === "verified-minimum" && (badge.id === "card-creator" || badge.id === "little-explorer") ? { historicalNote: "This is a verified minimum from current materials and retained creation records." } : {}),
      ...(!alreadyEarned && completeness === "incomplete" && (badge.id === "card-creator" || badge.id === "hello-abii" || badge.id === "little-explorer") ? { historicalNote: "No surviving current record or retained creation event proves prior activity; no missing history is inferred." } : {}),
      ...(evidenceSubjectId ? { evidenceSubjectId } : {}),
      ...(evidenceId ? { evidenceId } : {}),
    };
  });
}
