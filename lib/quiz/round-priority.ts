/** Stable card identities are the round-1 origin indexes, never generated question text. */
export type RoundAttempt = { origin?: number; round?: number; answered?: boolean; correct?: boolean | null };

export function priorMistakeState<T extends RoundAttempt>(question: T, history: readonly T[]) {
  const round = question.round ?? 1;
  const origin = question.origin;
  if (round <= 1 || origin === undefined) return { previouslyIncorrect: false, incorrectLastRound: false };
  const earlier = history.filter((attempt) => attempt.origin === origin && attempt.answered && (attempt.round ?? 1) < round);
  return {
    previouslyIncorrect: earlier.some((attempt) => attempt.correct === false),
    incorrectLastRound: earlier.some((attempt) => (attempt.round ?? 1) === round - 1 && attempt.correct === false),
  };
}

/** Shuffle independently by priority so incorrect cards always remain at the front. */
export function prioritizePending<T extends { correct?: boolean | null }>(
  pending: readonly T[],
  shuffle: (items: T[]) => T[],
): T[] {
  return [
    ...shuffle(pending.filter((question) => question.correct === false)),
    ...shuffle(pending.filter((question) => question.correct !== false)),
  ];
}
