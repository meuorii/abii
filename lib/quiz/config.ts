// Quiz configuration. Change these in one place.

/** When a subject has too few distinct answers, allow distractors from the same user's other subjects. */
export const ALLOW_CROSS_SUBJECT_DISTRACTORS = true;

/** Answers longer than this are not suitable for quiz questions (too long to type or to show as an option). */
export const MAX_QUIZ_ANSWER_LENGTH = 120;

/** Target number of Multiple Choice options (fewer are used only when distinct answers run out). */
export const MC_OPTION_COUNT = 4;

/** Chance of generating a false statement when a reliable alternative exists. */
export const TF_FALSE_PROBABILITY = 0.5;

/** Completed quiz history keeps the existing 24 hour retention policy. */
export const SESSION_TTL_HOURS = 24;
/** Active quizzes remain resumable for 30 days after meaningful activity. */
export const ACTIVE_SESSION_INACTIVITY_DAYS = 30;

/** Maximum length accepted for a typed Identification answer. */
export const MAX_TYPED_ANSWER_LENGTH = 500;

/**
 * A card completes an individual quiz type after this many consecutive correct answers
 * in that type. Each type has its own streak; a wrong answer resets only that type's streak.
 * A card is fully mastered after reaching this target in every quiz type that applies to it
 * AND in Mixed / Random mode.
 */
export const MASTERY_STREAK = 3;



/** Enumeration: answers are split into items by newline, ";" or ",". Needs at least this many items. */
export const ENUM_MIN_ITEMS = 2;
export const ENUM_MAX_ITEMS = 10;
/** Enumeration answers may be longer than a normal answer because they hold several items. */
export const MAX_ENUM_ANSWER_LENGTH = 400;
/** Longest single item accepted when typing an enumeration entry. */
export const MAX_ENUM_ITEM_LENGTH = 120;
/** Enumeration (Identification): false = any order is accepted (default); true = items must be in card order. */
export const ENUM_ORDER_MATTERS = false;
/** Number of list options shown in Enumeration (Multiple Choice). */
export const ENUM_MC_OPTION_COUNT = 4;
