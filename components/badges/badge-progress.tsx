import type { BadgePageItem } from "./types";

function percentage(badge: BadgePageItem) {
  if (badge.unlocked) return 100;
  if (badge.target <= 0) return 0;
  return Math.max(0, Math.min(100, (badge.progress / badge.target) * 100));
}

export function BadgeProgress({ badge, compact = false }: { badge: BadgePageItem; compact?: boolean }) {
  const value = percentage(badge);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className={`${compact ? "text-[11px]" : "text-sm"} min-w-0 flex-1 break-words leading-5 text-[#756B72]`}>{badge.unlocked ? "Requirement completed" : badge.progressLabel}</p>
        {!compact && <span className="shrink-0 text-xs font-bold tabular-nums text-[#657B8E]">{Math.round(value)}%</span>}
      </div>
      <div role="progressbar" aria-label={`${badge.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-valuetext={badge.unlocked ? "Requirement completed" : badge.progressLabel} className={`mt-2 overflow-hidden rounded-full bg-[#F4EDF0] ${compact ? "h-1.5" : "h-2.5"}`}>
        <div className="h-full rounded-full bg-[#F15D8A] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function remainingRequirement(badge: BadgePageItem) {
  if (badge.unlocked) return "Requirement completed.";
  if (badge.requirement.metric === "qualifying-quiz-score") return `Score at least ${badge.requirement.minimumScorePercent}% on one quiz with ${badge.requirement.minimumOriginalQuestions}+ original questions. Retry rounds do not change the first-attempt score.`;
  if (badge.requirement.metric === "current-subject-mastery") {
    const best = Number(badge.progressLabel.match(/(\d+(?:\.\d+)?)%/)?.[1] ?? 0);
    const points = Math.max(0, Math.ceil(badge.target - best));
    return `Reach ${badge.target}% mastery in a non-empty subject${points ? ` · ${points} percentage point${points === 1 ? "" : "s"} to go` : ""}.`;
  }
  if (badge.requirement.metric === "resumed-quiz-completions") return "Resume an unfinished quiz, then complete that same session.";
  if (badge.requirement.metric === "consecutive-study-days") {
    const current = Number(badge.progressLabel.match(/Current streak: (\d+)/)?.[1] ?? 0);
    return current ? `Keep studying every day for ${badge.remaining} more consecutive study day${badge.remaining === 1 ? "" : "s"}.` : `Start a streak and study on ${badge.target} consecutive calendar days.`;
  }
  const count = Math.max(0, Math.ceil(badge.remaining));
  const unitByMetric: Record<string, string> = {
    "current-subject-count": "subject",
    "current-flashcard-count": "flashcard",
    "current-subjects-with-flashcards": "subject with flashcards",
    "consecutive-study-days": "consecutive study day",
    "distinct-quiz-completion-days": "quiz day",
    "completed-quiz-count": "completed quiz",
    "qualifying-correct-quiz-answers": "correct answer",
    "fully-correct-enumeration-answers": "fully correct enumeration answer",
    "resumed-quiz-completions": "resumed quiz completion",
    "subjects-reaching-mastery-milestone": "fully mastered subject",
  };
  const unit = unitByMetric[badge.requirement.metric] ?? "step";
  return `${count} more ${unit}${count === 1 ? "" : "s"} needed.`;
}
