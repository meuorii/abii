// Quiz configuration. Change these in one place.

/** When a subject has too few distinct answers, allow distractors from the same user's other subjects. */
export const ALLOW_CROSS_SUBJECT_DISTRACTORS = true;

/** Answers longer than this are not suitable for quiz questions (too long to type or to show as an option). */
export const MAX_QUIZ_ANSWER_LENGTH = 120;

/** Target number of Multiple Choice options (fewer are used only when distinct answers run out). */
export const MC_OPTION_COUNT = 4;

/** Chance of generating a false statement when a reliable alternative exists. */
export const TF_FALSE_PROBABILITY = 0.5;

/** Quiz sessions (and their saved question data) are removed this long after creation. */
export const SESSION_TTL_HOURS = 24;

/** Maximum length accepted for a typed Identification answer. */
export const MAX_TYPED_ANSWER_LENGTH = 500;

/**
 * A card is "mastered" after this many correct answers in a row (counted across all sessions,
 * from saved review records). A wrong answer resets the card's streak to 0. A review session
 * keeps cycling the not-yet-mastered cards until every card reaches this streak.
 */
export const MASTERY_STREAK = 3;
