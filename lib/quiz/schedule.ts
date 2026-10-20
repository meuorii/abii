/**
 * Next review date for a quiz answer.
 *
 * The existing project stores `nextReviewAt` on every ReviewRecord but has no
 * scheduling function yet (nothing in the Dashboard, Review overview, or
 * subject pages computes one). This is the minimal rule needed to satisfy the
 * required field; it is NOT a spaced-repetition algorithm. Replace this one
 * function if/when a real scheduler is added.
 */
const CORRECT_DELAY_MS = 24 * 60 * 60 * 1000; // 1 day
const WRONG_DELAY_MS = 10 * 60 * 1000; // 10 minutes

export function computeNextReviewAt(result: "correct" | "wrong", now: Date): Date {
  return new Date(now.getTime() + (result === "correct" ? CORRECT_DELAY_MS : WRONG_DELAY_MS));
}
