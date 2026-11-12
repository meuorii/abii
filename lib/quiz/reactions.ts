export type QuizReactionKind = "selection" | "typing" | "correct" | "incorrect";

const reactions: Record<QuizReactionKind, readonly string[]> = {
  selection: [
    "Ooh, nice pick!",
    "Feeling confident?",
    "Going with that?",
    "Interesting choice!",
    "Ready to lock it in?",
    "Trust your memory!",
  ],
  typing: [
    "Take your time!",
    "You got this!",
    "Think it through!",
    "Keep going!",
    "Ready when you are!",
  ],
  correct: ["You nailed it!", "That's the one!", "Amazing recall!", "Perfect!", "Nice work!"],
  incorrect: ["Not quite!", "Almost there!", "Good try!", "Keep practicing!", "You'll get it!"],
};

export type QuizReactionInput = {
  gradedResult?: { correct: boolean } | null;
  hasSelection?: boolean;
  hasDraft?: boolean;
  seed: number;
};

/**
 * Derives a short, stable reaction from the current interaction state.
 * Grading language is impossible without a server-returned result.
 */
export function resolveQuizReaction({ gradedResult, hasSelection = false, hasDraft = false, seed }: QuizReactionInput) {
  const kind: QuizReactionKind | null = gradedResult
    ? gradedResult.correct ? "correct" : "incorrect"
    : hasSelection ? "selection"
      : hasDraft ? "typing"
        : null;

  if (!kind) return null;
  const choices = reactions[kind];
  const index = Math.abs(Math.trunc(seed)) % choices.length;
  return { kind, message: choices[index] } as const;
}
