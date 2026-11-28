"use client";

import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, ChartNoAxesColumnIncreasing, Check, ChevronRight,
  CircleCheck, Clock3, List, ListChecks, ListOrdered, PencilLine, Play,
  RotateCcw, X, Zap,
} from "lucide-react";
import { QUIZ_TYPE_LABELS, type PublicQuestion, type PublicSession, type QuestionResult, type QuizType } from "@/lib/quiz/types";
import { QuizCompletionConfetti } from "@/components/review/quiz-completion-confetti";

type Attempt = { question: PublicQuestion; result: QuestionResult; number: number };
const typeNames: Record<QuizType, string> = {
  "multiple-choice": "Multiple Choice", identification: "Identification", "true-false": "True or False",
  "enumeration-identification": "Enumeration — Identification", "enumeration-multiple-choice": "Enumeration — Multiple Choice",
};
const typeIcons: Record<QuizType, typeof ListChecks> = {
  "multiple-choice": ListChecks, identification: PencilLine, "true-false": CircleCheck,
  "enumeration-identification": ListOrdered, "enumeration-multiple-choice": List,
};
const cardClass = "rounded-[18px] border border-border bg-surface shadow-[0_3px_14px_rgba(47,41,48,0.035)]";
const actionClass = "flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-border bg-background px-3.5 py-3 text-left transition hover:border-border hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2";

function submittedAnswer(question: PublicQuestion, result: QuestionResult): string {
  if (result.userAnswer) return result.userAnswer;
  if (result.userAnswers) return result.userAnswers.join(", ");
  if (question.type === "multiple-choice" || question.type === "enumeration-multiple-choice") return question.options?.[result.selectedIndex ?? -1] ?? "Answer recorded";
  if (question.type === "true-false") return result.selectedTruth === undefined ? "Answer recorded" : result.selectedTruth ? "True" : "False";
  return "Answer recorded";
}

function QuestionDetails({ attempt }: { attempt: Attempt }) {
  const { question, result } = attempt;
  return <div className="mt-2 space-y-2 rounded-xl bg-background p-3 text-xs leading-5 text-muted">
    <p><span className="font-semibold text-foreground">Type:</span> {typeNames[question.type]} · Round {question.round}</p>
    <p><span className="font-semibold text-foreground">Your answer:</span> {submittedAnswer(question, result)}</p>
    <p><span className="font-semibold text-foreground">Correct answer:</span> {result.correctAnswer}</p>
    {result.explanation && <p>{result.explanation}</p>}
  </div>;
}

function AttemptsList({ attempts, heading, emptyText }: { attempts: Attempt[]; heading: string; emptyText: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return <div className="mt-3">
    <h3 className="mb-2 text-sm font-semibold text-foreground">{heading}</h3>
    {attempts.length === 0 ? <p className="rounded-xl bg-success-bg p-4 text-sm text-success-text">{emptyText}</p> :
      <ol className="divide-y divide-border rounded-xl border border-border px-3">
        {attempts.map((attempt) => <li key={attempt.question.index} className="py-2.5">
          <button type="button" aria-expanded={open === attempt.question.index} onClick={() => setOpen(open === attempt.question.index ? null : attempt.question.index)} className="flex min-h-11 w-full min-w-0 items-start gap-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover sm:items-center">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-surface text-xs font-semibold text-primary">{attempt.number}</span>
            <span className="min-w-0 flex-1 break-words whitespace-normal text-xs leading-5 text-muted">{attempt.question.prompt}</span>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${attempt.result.correct ? "bg-success-bg text-success" : "bg-error-bg text-error-text"}`}>
              {attempt.result.correct ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}{attempt.result.correct ? "Correct" : "Incorrect"}
            </span><ChevronRight aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open === attempt.question.index ? "rotate-90" : ""}`} />
          </button>
          {open === attempt.question.index && <QuestionDetails attempt={attempt} />}
        </li>)}
      </ol>}
  </div>;
}

export function QuizCompletion({ session, firstName, onAgain, againBusy, againError, celebrate = false }: {
  session: PublicSession; firstName: string; onAgain: () => void; againBusy: boolean; againError: string; celebrate?: boolean;
}) {
  const [filterType, setFilterType] = useState<QuizType | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [reviewMistakes, setReviewMistakes] = useState(false);
  const attempts = session.questions.flatMap((question, order) => {
    const result = session.results[question.index];
    return result ? [{ question, result, number: order + 1 }] : [];
  });
  const perType = (Object.keys(typeNames) as QuizType[]).flatMap((type) => {
    const group = attempts.filter((attempt) => attempt.question.type === type);
    return group.length ? [{ type, count: group.length, correct: group.filter((a) => a.result.correct).length }] : [];
  });
  const recent = [...attempts].slice(-5).reverse();
  const filtered = filterType ? attempts.filter((a) => a.question.type === filterType) : attempts;
  if (session.status !== "completed" || !session.summary) {
    return <section role="alert" className="mx-auto mt-6 max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h1 className="text-lg font-bold text-foreground">Your saved results are not ready yet</h1>
      <p className="mt-2 text-sm leading-6 text-muted">We couldn’t confirm that this quiz has completed. Reload the saved session or return to Review.</p>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">Reload saved results</button><Link href="/review" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">Back to Review</Link></div>
    </section>;
  }
  const summary = session.summary;
  const pct = Math.max(0, Math.min(100, summary.accuracy));
  const performance = pct >= 90 ? "Excellent Performance!" : pct >= 75 ? "Great Performance!" : pct >= 50 ? "Good Effort!" : "Keep Practicing!";
  const greeting = pct >= 90 ? "Amazing work" : pct >= 60 ? "Great effort" : "Nice work finishing";
  const completedDate = session.completedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.completedAt)) : null;

  return <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-3 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 lg:px-7 lg:pb-7">
    <Link href="/review" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-foreground transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"><ArrowLeft aria-hidden="true" className="h-4 w-4 text-primary" />Back to Review</Link>

    <AbiiPageHero
      variant="completion"
      headingId="completion-hero-title"
      title={<h1 className="abii-hero-heading">{greeting}, {firstName}!<br /><span className="abii-hero-emphasis">You did it!</span></h1>}
      description={<p className="max-w-[440px]">Every review brings you one step closer to mastering what you&apos;ve learned. Keep up the great work!</p>}
      metadata={<p>{session.subjectName} &middot; {QUIZ_TYPE_LABELS[session.type]}</p>}
      mascotSrc="/dashboard-hero/complete.png"
      mascotAlt=""
      priority
    />

    <QuizCompletionConfetti active={celebrate} />

    <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] [&>*]:min-w-0">
      <section className={`${cardClass} p-4 sm:p-5`}>
        <header className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2.5 text-lg font-bold tracking-[-.025em] text-foreground"><ChartNoAxesColumnIncreasing className="h-5 w-5 text-primary" aria-hidden="true"/>Your Quiz Results</h2>{completedDate && <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-[10px] text-muted"><Clock3 className="h-3.5 w-3.5" aria-hidden="true"/><time dateTime={session.completedAt ?? undefined}>{completedDate}</time></span>}</header>
        <div className="mt-3 grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-[minmax(180px,.8fr)_1.2fr] sm:items-center sm:p-5">
          <div className="flex flex-col items-center"><p className="mb-2 w-full text-sm font-semibold text-foreground">Overall Accuracy</p><div role="img" aria-label={`Overall accuracy: ${pct} percent`} className="relative grid h-[176px] w-[176px] place-items-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--border) 0deg)` }}><div className="grid h-[152px] w-[152px] place-content-center rounded-full bg-surface text-center"><strong className="text-[39px] font-bold leading-none tracking-[-.04em] text-foreground tabular-nums">{pct}%</strong><span className="mt-2 text-[12px] font-semibold text-primary">{performance}</span></div></div></div>
          <div><p className="text-sm leading-6 text-muted">You’re making progress. Keep practicing to strengthen your memory!</p><div className="mt-4 grid grid-cols-2 gap-2.5"><div className="rounded-2xl border border-success bg-success-bg p-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-success-bg text-success"><Check className="h-5 w-5" aria-hidden="true"/></span><strong className="text-2xl font-bold text-success tabular-nums">{summary.correct}</strong></div><p className="mt-1 text-[10px] text-muted">Correct Answers</p></div><div className="rounded-2xl border border-border bg-background p-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary-surface text-primary"><X className="h-5 w-5" aria-hidden="true"/></span><strong className="text-2xl font-bold text-primary tabular-nums">{summary.incorrect}</strong></div><p className="mt-1 text-[10px] text-muted">Incorrect Answers</p></div></div><div className="mt-3 grid grid-cols-3 gap-2 text-center">{[{ label: "Cards mastered", value: `${summary.mastered}/${summary.cards}` }, { label: "First try", value: `${summary.firstTryCorrect}/${summary.cards}` }, { label: "Retry rounds", value: String(Math.max(summary.rounds - 1, 0)) }].map((item) => <div key={item.label} className="rounded-xl bg-background px-2 py-2"><strong className="block text-sm font-bold text-foreground tabular-nums">{item.value}</strong><span className="mt-0.5 block text-[9px] leading-3 text-muted">{item.label}</span></div>)}</div></div>
        </div>
        {againError && <p role="alert" className="mt-3 text-sm text-error-text">{againError}</p>}
      </section>

      <section className={`${cardClass} p-4 sm:p-5`}>
        <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-[-.025em] text-foreground"><ChartNoAxesColumnIncreasing className="h-5 w-5 text-primary" aria-hidden="true"/>Performance by Question Type</h2>
        <div className="mt-3 space-y-2">{perType.map(({ type, count, correct }) => { const Icon = typeIcons[type]; const accuracy = count ? Math.round(correct / count * 100) : 0; return <button type="button" key={type} onClick={() => setFilterType(filterType === type ? null : type)} aria-pressed={filterType === type} className="flex min-h-[58px] w-full items-center gap-2 rounded-2xl border border-border px-2.5 py-2 text-left transition hover:border-border hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover sm:gap-3 sm:px-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary-surface text-primary"><Icon className="h-4 w-4" aria-hidden="true"/></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-foreground sm:text-xs">{typeNames[type]}</span><span className="mt-1 block h-2 overflow-hidden rounded-full bg-border"><span className="block h-full rounded-full bg-linear-to-r from-primary to-primary-hover" style={{ width: `${accuracy}%` }}/></span></span><strong className="w-10 text-right text-xs text-foreground tabular-nums">{accuracy}%</strong><span className="w-10 text-right text-[10px] text-muted tabular-nums">{correct}/{count}</span><ChevronRight className={`h-4 w-4 shrink-0 text-primary transition-transform ${filterType === type ? "rotate-90" : ""}`} aria-hidden="true"/></button>; })}</div>
        {filterType && <AttemptsList attempts={filtered} heading={`${typeNames[filterType]} questions`} emptyText="No answered questions for this type."/>}
      </section>
      <section className={`${cardClass} p-4 sm:p-5`}>
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><h2 className="flex min-w-0 items-center gap-2.5 text-base font-bold tracking-[-.025em] text-foreground sm:text-lg"><List className="h-5 w-5 shrink-0 text-primary" aria-hidden="true"/>Recent Questions</h2><button type="button" onClick={() => setShowAll((value) => !value)} className="inline-flex min-h-10 shrink-0 items-center gap-1 text-[11px] font-semibold text-primary hover:text-error-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">{showAll ? "Show Recent" : "View All Questions"}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true"/></button></header>
        <AttemptsList attempts={showAll ? [...attempts].reverse() : recent} heading="" emptyText="No answered questions are available for this session." />
      </section>

      <section className={`${cardClass} p-4 sm:p-5`}>
        <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-[-.025em] text-foreground"><Zap className="h-5 w-5 fill-primary text-primary" aria-hidden="true"/>What’s Next?</h2>
        <div className="mt-3 space-y-2">
          <button type="button" className={actionClass} onClick={() => { setReviewMistakes((value) => !value); setFilterType(null); }} aria-expanded={reviewMistakes}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-surface text-primary"><RotateCcw className="h-5 w-5" aria-hidden="true"/></span><span className="min-w-0 flex-1"><strong className="block text-xs font-bold text-foreground">Review Incorrect Answers</strong><span className="mt-0.5 block text-[10px] text-muted">{summary.incorrect ? "Focus on the questions you got wrong." : "You got every attempt correct. Lovely work!"}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true"/></button>
          {reviewMistakes && <AttemptsList attempts={[...attempts].reverse().filter((a) => !a.result.correct)} heading="Incorrect attempts" emptyText="Every attempt was correct. There are no mistakes to review."/>}
          <Link href={session.subjectId ? `/subjects/${session.subjectId}` : "/subjects"} className={actionClass}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-surface text-primary"><BookOpen className="h-5 w-5" aria-hidden="true"/></span><span className="min-w-0 flex-1"><strong className="block text-xs font-bold text-foreground">Study This Subject</strong><span className="mt-0.5 block text-[10px] text-muted">Continue learning more flashcards.</span></span><ChevronRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true"/></Link>
          <Link href="/review/setup" className={actionClass}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-surface text-primary-foreground"><Play className="h-4 w-4 fill-current" aria-hidden="true"/></span><span className="min-w-0 flex-1"><strong className="block text-xs font-bold text-foreground">Start a New Quiz</strong><span className="mt-0.5 block text-[10px] text-muted">Challenge yourself again.</span></span><ChevronRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true"/></Link>
          <button type="button" onClick={onAgain} disabled={againBusy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:opacity-60"><RotateCcw className="h-4 w-4" aria-hidden="true"/>{againBusy ? "Starting…" : "Review Again"}</button>
        </div>
      </section>
    </div>
  </div>;
}
