export type SavedQuestionState = { round?: number; answered?: boolean };

/** Uses only the latest retry round for the card showing current quiz completion. */
export function currentRoundProgress(questions: SavedQuestionState[]) {
  const currentRound = Math.max(1, ...questions.map((question) => question.round ?? 1));
  const current = questions.filter((question) => (question.round ?? 1) === currentRound);
  const answeredCount = current.filter((question) => question.answered).length;
  return { currentRound, totalQuestions: current.length, answeredCount,
    progress: current.length ? Math.round(answeredCount / current.length * 100) : 0,
    readyToFinish: current.length > 0 && answeredCount === current.length };
}

/** Session question order is authoritative; keep answered earlier round state intact. */
export function firstUnansweredQuestion<T extends SavedQuestionState>(questions: T[]): number {
  const index = questions.findIndex((question) => !question.answered);
  return index < 0 ? Math.max(questions.length - 1, 0) : index;
}
