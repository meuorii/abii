import type { DailyCount, ReportingWindow } from "./reporting";

export type MetricResult<T> =
  | { status: "available"; value: T }
  | { status: "partial"; value: T; coverage: string }
  | { status: "unavailable"; reason: string };

export type Comparison<T> = { current: T; previous: T };
export type Trend = Comparison<number> & { daily: DailyCount[] };
export type Fraction = { counted: number; eligible: number };
export type ReviewTotals = { attempts: number; correct: number; wrong: number; ungraded: number };
export type ReviewDay = ReviewTotals & { day: string };
export type ReviewActivity = Comparison<ReviewTotals> & { daily: ReviewDay[] };
export const retentionHorizon = [1, 7, 30] as const;
export type RetentionDay = typeof retentionHorizon[number];
export type RetentionRates = Record<RetentionDay, Fraction>;
export type RetentionCohort = { start: string; end: string; size: number; rates: RetentionRates };
export type Retention = Comparison<RetentionRates> & { cohorts: RetentionCohort[] };
export const quizModes = [
  { id: "multiple-choice", label: "Multiple choice" },
  { id: "identification", label: "Identification" },
  { id: "true-false", label: "True or false" },
  { id: "random", label: "Random" },
] as const;
export type QuizMode = typeof quizModes[number]["id"];
export type QuizDistribution = {
  modes: Record<QuizMode, number>;
  unknown: number;
  first: string | null;
  last: string | null;
};

export type AnalyticsReport = {
  measuredAt: string;
  window: ReportingWindow;
  previous: ReportingWindow;
  growth: MetricResult<Trend>;
  active: MetricResult<Trend>;
  activation: MetricResult<Comparison<Fraction>>;
  retention: MetricResult<Retention>;
  reviews: MetricResult<ReviewActivity>;
  quizzes: MetricResult<QuizDistribution>;
  subjects: MetricResult<Trend>;
  flashcards: MetricResult<Trend>;
};

export function rate({ counted, eligible }: Fraction): number | null {
  return eligible > 0 ? 100 * counted / eligible : null;
}

export function countChange({ current, previous }: Comparison<number>): number | null {
  return previous > 0 ? 100 * (current - previous) / previous : null;
}
