"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { TypeIcon } from "@/components/review/review-setup";
import { Mascot } from "@/components/ui/mascot";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import { QUIZ_TYPE_LABELS, type PublicSession, type QuestionResult, type QuizSummary, type QuizType } from "@/lib/quiz/types";
import { Check, X, Lightbulb } from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Show the interaction mode; Items is a flashcard format, not a separate quiz mode. */
function questionTypeLabel(type: QuizType): string {
  switch (type) {
    case "enumeration-identification":
      return `Items · ${QUIZ_TYPE_LABELS.identification}`;
    case "enumeration-multiple-choice":
      return `Items · ${QUIZ_TYPE_LABELS["multiple-choice"]}`;
    case "identification":
      return QUIZ_TYPE_LABELS.identification;
    case "multiple-choice":
      return QUIZ_TYPE_LABELS["multiple-choice"];
    case "true-false":
      return QUIZ_TYPE_LABELS["true-false"];
  }
}

function CheckIcon() { return <Check className="h-5 w-5" aria-hidden="true" />; }
function CrossIcon() { return <X className="h-5 w-5" aria-hidden="true" />; }
function BulbIcon() { return <Lightbulb className="h-4 w-4" aria-hidden="true" />; }

function ProgressPanel({ total, answered, correct, incorrect, mastered, cards, round, firstName }: { total: number; answered: number; correct: number; incorrect: number; mastered: number; cards: number; round: number; firstName: string }) {
  const remaining = total - answered;
  const pct = total ? Math.round((answered / total) * 360 / 100 * 100) : 0;
  const rows = [
    { label: "Correct", value: correct, dot: "bg-[#2FBF71]" },
    { label: "Wrong", value: incorrect, dot: "bg-[#F0507F]" },
    { label: "Remaining", value: remaining, dot: "bg-[#A78BFA]" },
    { label: "Mastered cards", value: `${mastered}/${cards}`, dot: "bg-[#FF9FBA]" },
  ];
  return (
    <section aria-labelledby="session-progress-title" className="rounded-2xl border border-[#E8EAF0] bg-white p-4 sm:p-5">
      <h2 id="session-progress-title" className="text-sm font-bold text-[#153B56]">Review Progress</h2>
      <p className="sr-only">This session only. Not your long-term subject progress.</p>
      <div className="mt-3 flex items-center gap-4 lg:flex-col lg:items-stretch lg:gap-3 xl:flex-row xl:items-center">
        <div className="relative flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full lg:mx-auto xl:mx-0" style={{ background: `conic-gradient(#F0507F ${pct}deg, #F3E9ED 0deg)` }} role="img" aria-label={`${answered} of ${total} questions answered`}>
          <div className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full bg-white"><span className="text-base font-bold leading-none text-[#153B56]">{answered}/{total}</span><span className="mt-1 text-[9px] text-[#7890A4]">answered</span></div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[#557087]"><span className={`h-2 w-2 rounded-full ${r.dot}`} aria-hidden="true" />{r.label}</span><span className="font-semibold tabular-nums text-[#153B56]">{r.value}</span></li>
          ))}
        </ul>
      </div>
      {round > 1 && <p className="mt-3 rounded-lg bg-[#FFE8EF] px-3 py-2 text-xs font-semibold text-[#C65380]">Retry round {round}</p>}
      <div className="mt-3 hidden items-center gap-3 rounded-xl bg-[#FFF7F9] p-3 lg:flex">
        <Mascot state={answered === 0 ? "welcome" : "correct"} size="sm" />
        <p className="text-xs leading-5 text-[#6C4A58]">{answered === 0 ? `You’ve got this, ${firstName}!` : `Great start, ${firstName}! Keep going!`}</p>
      </div>
    </section>
  );
}

function Completion({ session, summary, firstName, onAgain, againBusy, againError }: { session: PublicSession; summary: QuizSummary; firstName: string; onAgain: () => void; againBusy: boolean; againError: string }) {
  const stats = [
    { label: "Cards mastered", value: `${summary.mastered}/${summary.cards}` },
    { label: "Correct on first try", value: `${summary.firstTryCorrect}/${summary.cards}` },
    { label: "Retry rounds", value: summary.rounds - 1 },
    { label: "Overall accuracy", value: `${summary.accuracy}%` },
  ];
  return (
    <section aria-labelledby="done-title" className="overflow-hidden rounded-[1.4rem] border border-[#F5DDE5] bg-[#FFF7F9] p-5 sm:p-8">
      <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
        <Mascot state="complete" size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C65380]">Review complete</p>
          <h1 id="done-title" className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#173B55] sm:text-3xl">{summary.mastered === summary.cards ? `Great job, ${firstName}! Every card is mastered.` : `Nice work, ${firstName}!`}</h1>
          <p className="mt-2 text-sm text-[#6C879C]">{session.subjectName} · {QUIZ_TYPE_LABELS[session.type]}</p>
          <p className="mt-1 text-xs text-[#7890A4]">Complete {session.masteryTarget} correct answers in a row for this quiz type. Each type has its own streak; a wrong answer resets that type’s progress. Complete Multiple Choice, Identification, and True or False to master a card.</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-[#F1DDE4] bg-white px-3 py-3"><dt className="text-[11px] font-medium text-[#7890A4]">{s.label}</dt><dd className="mt-1 text-xl font-bold tabular-nums text-[#153B56]">{s.value}</dd></div>
            ))}
          </dl>
          {againError && <p role="alert" className="mt-3 text-sm text-[#A43E5C]">{againError}</p>}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onAgain} disabled={againBusy} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF477D] px-6 text-sm font-semibold text-white transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{againBusy ? "Starting…" : "Review Again"}</button>
            <Link href="/review" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#E8E2E5] bg-white px-6 text-sm font-semibold text-[#51464E] transition hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Back to Review</Link>
            {session.subjectId && <Link href={`/subjects/${session.subjectId}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#E8E2E5] bg-white px-6 text-sm font-semibold text-[#51464E] transition hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Back to Subject</Link>}
          </div>
        </div>
      </div>
    </section>
  );
}

export function QuizSession({ initial, firstName }: { initial: PublicSession; firstName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [questions, setQuestions] = useState(initial.questions);
  const total = questions.length;
  const [roundNotice, setRoundNotice] = useState("");
  const [mastery, setMastery] = useState<Record<number, number>>(initial.mastery);
  const [autoNext, setAutoNext] = useState(false);
  const [autoSeconds, setAutoSeconds] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, QuestionResult>>(initial.results);
  const [index, setIndex] = useState(() => {
    const first = questions.findIndex((q) => !initial.results[q.index]);
    return first === -1 ? Math.max(total - 1, 0) : first;
  });
  const [summary, setSummary] = useState<QuizSummary | null>(initial.summary);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedTruth, setSelectedTruth] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [itemAnswers, setItemAnswers] = useState<string[]>([]);
  const [hintOpen, setHintOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [againBusy, setAgainBusy] = useState(false);
  const [againError, setAgainError] = useState("");
  const busyRef = useRef(false);
  const nextRef = useRef<() => void>(() => {});
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLInputElement | null>>([]);

  const question = questions[index];
  const result = question ? results[question.index] : undefined;
  const answeredCount = Object.keys(results).length;
  const correctCount = Object.values(results).filter((r) => r.correct).length;
  const incorrectCount = answeredCount - correctCount;
  const isLast = index >= total - 1;
  const target = initial.masteryTarget;
  const cardIndexes = [...new Set(questions.map((q) => q.cardIndex))];
  const cardTotal = cardIndexes.length;
  const masteredCount = cardIndexes.filter((c) => (mastery[c] ?? 0) >= target).length;
  const currentStreak = question ? Math.min(mastery[question.cardIndex] ?? 0, target) : 0;
  const currentRound = question?.round ?? 1;
  const typeLabel = QUIZ_TYPE_LABELS[initial.type];
  const hasResult = Boolean(result);
  const questionType = question?.type;

  const autoDelay = result?.correct ? autoSeconds : autoSeconds * 2;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("abii-auto-next");
      if (saved) {
        const parsed = JSON.parse(saved) as { on?: boolean; seconds?: number };
        if (typeof parsed.on === "boolean") setAutoNext(parsed.on);
        if (parsed.seconds && [2, 3, 5].includes(parsed.seconds)) setAutoSeconds(parsed.seconds);
      }
    } catch {
      /* storage unavailable: keep defaults */
    }
  }, []);

  function saveAuto(on: boolean, seconds: number) {
    setAutoNext(on);
    setAutoSeconds(seconds);
    try {
      window.localStorage.setItem("abii-auto-next", JSON.stringify({ on, seconds }));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    nextRef.current = next;
  });

  // Auto-next: after an answer is shown, advance on its own. Wrong answers get twice as long to read.
  useEffect(() => {
    if (!autoNext || !hasResult || summary) {
      setCountdown(null);
      return;
    }
    let remaining = autoDelay;
    setCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        setCountdown(null);
        nextRef.current();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [autoNext, hasResult, index, autoDelay, summary]);

  useEffect(() => {
    if (questionType === "identification" && !hasResult) inputRef.current?.focus();
    if (questionType === "enumeration-identification" && !hasResult) itemRefs.current[0]?.focus();
  }, [index, questionType, hasResult]);

  if (busy && result && isLast && !summary) {
    return <PageLoadingSkeleton variant="finish" withShell={false} />;
  }

  if (summary) {
    return (
      <div className="space-y-3 p-4 pb-24 sm:p-5 xl:p-6">
        <Completion session={initial} summary={summary} firstName={firstName} againBusy={againBusy} againError={againError} onAgain={restart} />
      </div>
    );
  }
  if (!question) return null;

  const selOption = result?.selectedIndex ?? selectedOption;
  const selTruth = result?.selectedTruth ?? selectedTruth;
  const typed = result?.userAnswer ?? text;
  const itemCount = question.itemCount ?? 0;
  const enumTyped = result?.userAnswers ?? Array.from({ length: itemCount }, (_, i) => itemAnswers[i] ?? "");

  async function restart() {
    if (againBusy) return;
    setAgainBusy(true);
    setAgainError("");
    try {
      const response = await fetch("/api/quiz/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId: initial.subjectId ?? "all", type: initial.type }) });
      const data = (await response.json().catch(() => ({}))) as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) {
        const message = data.error || "We couldn’t start a new review. Please try again.";
        setAgainError(message);
        toast({ kind: "error", title: "Couldn’t start review again", message });
        setAgainBusy(false);
        return;
      }
      toast({ kind: "success", title: "New review started", message: "Your flashcards are ready." });
      router.push(`/review/quiz/${data.sessionId}`);
    } catch {
      const message = "You seem to be offline. Check your connection and try again.";
      setAgainError(message);
      toast({ kind: "error", title: "Connection hiccup", message });
      setAgainBusy(false);
    }
  }

  async function submit() {
    if (busyRef.current || result || !question) return;
    let payload: Record<string, unknown>;
    if (question.type === "multiple-choice" || question.type === "enumeration-multiple-choice") {
      if (selectedOption === null) return;
      payload = { selectedIndex: selectedOption };
    } else if (question.type === "identification") {
      if (!text.trim()) return;
      payload = { answer: text };
    } else if (question.type === "enumeration-identification") {
      const answers = Array.from({ length: question.itemCount ?? 0 }, (_, i) => (itemAnswers[i] ?? "").trim()).filter(Boolean);
      if (answers.length === 0) return;
      payload = { answers };
    } else {
      if (selectedTruth === null) return;
      payload = { truth: selectedTruth };
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/quiz/${initial.id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionIndex: question.index, ...payload }) });
      const data = (await response.json().catch(() => ({}))) as { result?: QuestionResult; mastery?: Record<number, number>; error?: string };
      if (!response.ok || !data.result) {
        setError(data.error || "We couldn’t save that answer. Please try again.");
        toast({ kind: "error", title: "Answer not saved", message: data.error || "Please try submitting your answer again." });
        return;
      }
      const saved = data.result;
      setResults((current) => ({ ...current, [question.index]: saved }));
      if (data.mastery) setMastery(data.mastery);
      if (saved.correct) {
        toast({ kind: "success", title: "That’s correct! ✨", message: "Nice recall. Keep that streak going!" });
      } else {
        toast({ kind: "info", title: "Not quite — keep learning!", message: "Take a look at the answer, then try again next round." });
      }
    } catch {
      setError("You seem to be offline. Check your connection and try again.");
      toast({ kind: "error", title: "Connection hiccup", message: "Your answer could not be saved. Check your connection and retry." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function next() {
    if (busyRef.current || !result) return;
    setError("");
    if (!isLast) {
      setIndex(index + 1);
      setSelectedOption(null);
      setSelectedTruth(null);
      setText("");
      setItemAnswers([]);
      setHintOpen(false);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/quiz/${initial.id}/finish`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { summary?: QuizSummary; retry?: boolean; session?: PublicSession; error?: string };
      if (!response.ok || (!data.summary && !(data.retry && data.session))) {
        const message = data.error || "We couldn’t finish this review. Please try again.";
        setError(message);
        toast({ kind: "error", title: "Couldn’t finish review", message });
        return;
      }
      if (data.retry && data.session) {
        const nextQuestions = data.session.questions;
        const nextResults = data.session.results;
        const first = nextQuestions.findIndex((q) => !nextResults[q.index]);
        const round = nextQuestions[first >= 0 ? first : 0]?.round ?? 2;
        setQuestions(nextQuestions);
        setResults(nextResults);
        setMastery(data.session.mastery);
        setIndex(first >= 0 ? first : 0);
        setSelectedOption(null);
        setSelectedTruth(null);
        setText("");
        setItemAnswers([]);
        setHintOpen(false);
        setRoundNotice(`Round ${round}: these cards still need ${target} consecutive correct answers in ${QUIZ_TYPE_LABELS[initial.type]}. A wrong answer resets this quiz type’s streak.`);
        toast({ kind: "info", title: `Round ${round} started`, message: "Keep going — these cards need a little more practice." });
        return;
      }
      if (data.summary) {
        setSummary(data.summary);
        toast({ kind: "success", title: "Review complete! 🎉", message: `You finished ${data.summary.cards} cards. Great work showing up to study!` });
      }
    } catch {
      const message = "You seem to be offline. Check your connection and try again.";
      setError(message);
      toast({ kind: "error", title: "Connection hiccup", message });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  const canSubmit = !busy && !result && (question.type === "multiple-choice" || question.type === "enumeration-multiple-choice" ? selectedOption !== null : question.type === "identification" ? text.trim().length > 0 : question.type === "enumeration-identification" ? itemAnswers.some((a) => a.trim().length > 0) : selectedTruth !== null);
  const progressPct = total ? Math.round((answeredCount / total) * 100) : 0;
  const upcoming = questions.slice(index + 1, index + 5);

  function optionClass(i: number) {
    const base = "flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-1";
    if (result) {
      if (i === result.correctIndex) return `${base} border-[#2FBF71] bg-[#EAF8F0] text-[#1F5E3E]`;
      if (i === selOption) return `${base} border-[#F0507F] bg-[#FFF1F1] text-[#8B273F]`;
      return `${base} border-[#E8E2E5] bg-white text-[#9A8C93]`;
    }
    return i === selOption ? `${base} border-[#FF6F96] bg-[#FFE8EF] text-[#2F2930]` : `${base} border-[#E8E2E5] bg-white text-[#2F2930] hover:border-[#F0B6C9]`;
  }
  function letterClass(i: number) {
    const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold";
    if (result) {
      if (i === result.correctIndex) return `${base} bg-[#2FBF71] text-white`;
      if (i === selOption) return `${base} bg-[#F0507F] text-white`;
      return `${base} bg-[#F4F1F3] text-[#9A8C93]`;
    }
    return i === selOption ? `${base} bg-[#FF6F96] text-white` : `${base} bg-[#F4F1F3] text-[#6C879C]`;
  }
  function truthClass(value: boolean) {
    const base = "flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-1";
    const correctValue = result ? (result.correct ? selTruth : !selTruth) : null;
    if (result) {
      if (value === correctValue) return `${base} border-[#2FBF71] bg-[#EAF8F0] text-[#1F5E3E]`;
      if (value === selTruth) return `${base} border-[#F0507F] bg-[#FFF1F1] text-[#8B273F]`;
      return `${base} border-[#E8E2E5] bg-white text-[#9A8C93]`;
    }
    return selTruth === value ? `${base} border-[#FF6F96] bg-[#FFE8EF] text-[#2F2930]` : `${base} border-[#E8E2E5] bg-white text-[#2F2930] hover:border-[#F0B6C9]`;
  }

  return (
    <div className="space-y-3 p-4 pb-24 sm:space-y-4 sm:p-5 xl:p-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
        <Link href="/review" className="shrink-0 rounded font-medium text-[#75889A] transition-colors hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Review</Link>
        <span aria-hidden="true" className="text-[#B4A5AC]">›</span>
        {initial.subjectId ? <Link href={`/subjects/${initial.subjectId}`} className="max-w-[40vw] truncate rounded font-medium text-[#75889A] transition-colors hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">{initial.subjectName}</Link> : <span className="max-w-[40vw] truncate font-medium text-[#75889A]">{initial.subjectName}</span>}
        <span aria-hidden="true" className="text-[#B4A5AC]">›</span>
        <span aria-current="page" className="truncate font-semibold text-[#2F2930]">{typeLabel}</span>
      </nav>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_290px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="quiz-hero-title" className="relative isolate order-1 min-h-[150px] overflow-hidden rounded-[1.4rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[200px] lg:col-start-1 lg:row-start-1">
          <div className="relative z-10 max-w-[66%] px-4 py-4 sm:max-w-[60%] sm:px-7 sm:py-6">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFE0E9] text-lg text-[#E9577D] sm:h-11 sm:w-11">▤</span>
              <div className="min-w-0">
                <h2 id="quiz-hero-title" className="truncate text-base font-bold tracking-[-0.03em] text-[#2F2930] sm:text-xl">{initial.subjectName}</h2>
                <p className="text-[11px] text-[#6E8497] sm:text-xs">{total} {total === 1 ? "question" : "questions"} · {typeLabel}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2"><div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/90 sm:w-48" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}><div className="h-full rounded-full bg-[#F0789A] transition-[width]" style={{ width: `${progressPct}%` }} /></div><span className="text-[11px] font-semibold text-[#6E8497]">{progressPct}%</span></div>
            <p className="mt-3 text-[clamp(1.3rem,2.6vw,2rem)] font-bold leading-[1.1] tracking-[-0.045em] text-[#173B52]">Let’s review!</p>
            <p className="mt-1 hidden max-w-xs text-xs leading-5 text-[#526F83] sm:block sm:text-sm sm:leading-6">Take your time, think it through, you’ll do great!</p>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[36%] sm:w-[38%]"><Image src="/dashboard-hero/my-subjects.png" alt="" fill priority sizes="(max-width: 640px) 36vw, 320px" className="object-contain object-bottom" /></div>
        </section>

        <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-1">
          <ProgressPanel total={total} answered={answeredCount} correct={correctCount} incorrect={incorrectCount} mastered={masteredCount} cards={cardTotal} round={currentRound} firstName={firstName} />
        </div>

        <section aria-labelledby="question-heading" className="order-2 min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-4 sm:p-6 lg:order-none lg:col-start-1 lg:row-start-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#6C879C]" aria-live="polite">Question <span className="font-bold text-[#153B56]">{index + 1}</span> of <span className="font-bold text-[#153B56]">{total}</span></p>
            <span className="inline-flex items-center gap-1" aria-label={`Card mastery ${currentStreak} of ${target}`} title="Correct in a row for this card"><span className="mr-1 text-[11px] text-[#8B7C84]">Mastery</span>{Array.from({ length: target }).map((_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i < currentStreak ? "bg-[#FF6F96]" : "bg-[#F3E9ED]"}`} />)}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F1DDE4] bg-[#FFF7F9] px-3 py-1 text-xs font-medium text-[#C65380]"><TypeIcon type={question.type} className="h-3.5 w-3.5" />{currentRound > 1 ? `Retry · ${questionTypeLabel(question.type)}` : questionTypeLabel(question.type)}</span>
          </div>
          {roundNotice && currentRound > 1 && <p role="status" className="mt-3 rounded-xl border border-[#F1DDE4] bg-[#FFF7F9] px-3.5 py-3 text-sm text-[#6C4A58]">{roundNotice}</p>}

          <h2 id="question-heading" className="mt-5 whitespace-pre-wrap break-words text-lg font-semibold leading-snug tracking-[-0.02em] text-[#153B56] sm:text-xl">{question.type === "true-false" ? "Is this the correct answer to the question below?" : question.prompt}</h2>
          {question.type === "true-false" && (
            <div className="mt-3 space-y-2 rounded-xl border border-[#F1DDE4] bg-[#FFFAFC] p-4">
              <p className="whitespace-pre-wrap break-words text-sm text-[#45647A]"><span className="font-semibold text-[#153B56]">Question: </span>{question.prompt}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-[#45647A]"><span className="font-semibold text-[#153B56]">Statement: </span>The answer is “{question.statement}”.</p>
            </div>
          )}

          <form onSubmit={onFormSubmit} className="mt-5 space-y-3">
            {question.type === "multiple-choice" && (
              <div role="radiogroup" aria-labelledby="question-heading" className="space-y-2.5">
                {(question.options ?? []).map((option, i) => (
                  <button key={i} type="button" role="radio" aria-checked={selOption === i} disabled={Boolean(result) || busy} onClick={() => setSelectedOption(i)} className={optionClass(i)}>
                    <span className={letterClass(i)}>{LETTERS[i] ?? i + 1}</span>
                    <span className="min-w-0 flex-1 break-words">{option}</span>
                    {result && i === result.correctIndex && <span className="text-[#2FBF71]"><CheckIcon /></span>}
                    {result && i === selOption && i !== result.correctIndex && <span className="text-[#F0507F]"><CrossIcon /></span>}
                  </button>
                ))}
              </div>
            )}

            {question.type === "enumeration-multiple-choice" && (
              <div role="radiogroup" aria-labelledby="question-heading" className="space-y-2.5">
                <p className="text-xs text-[#7890A4]">Choose the complete list. Items inside each list are shuffled.</p>
                {(question.options ?? []).map((option, i) => (
                  <button key={i} type="button" role="radio" aria-checked={selOption === i} disabled={Boolean(result) || busy} onClick={() => setSelectedOption(i)} className={optionClass(i)}>
                    <span className={letterClass(i)}>{LETTERS[i] ?? i + 1}</span>
                    <ul className="min-w-0 flex-1 list-disc space-y-0.5 pl-4 marker:text-[#E9577D]">
                      {option.split("\n").map((item, k) => <li key={k} className="break-words">{item}</li>)}
                    </ul>
                    {result && i === result.correctIndex && <span className="text-[#2FBF71]"><CheckIcon /></span>}
                    {result && i === selOption && i !== result.correctIndex && <span className="text-[#F0507F]"><CrossIcon /></span>}
                  </button>
                ))}
              </div>
            )}

            {question.type === "enumeration-identification" && (
              <fieldset className="space-y-2" disabled={Boolean(result) || busy}>
                <legend className="mb-1.5 text-sm font-semibold text-[#2F2930]">Type all {itemCount} items. Any order is accepted.</legend>
                {Array.from({ length: result ? enumTyped.length : itemCount }, (_, i) => {
                  const state = result ? (result.itemCorrect?.[i] ? "ok" : "bad") : "idle";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right text-xs font-semibold text-[#8B9BAA]">{i + 1}.</span>
                      <input
                        ref={(el) => { itemRefs.current[i] = el; }}
                        aria-label={`Item ${i + 1}`}
                        value={enumTyped[i] ?? ""}
                        onChange={(e) => setItemAnswers((cur) => { const copy = Array.from({ length: itemCount }, (_, k) => cur[k] ?? ""); copy[i] = e.target.value; return copy; })}
                        onKeyDown={(e) => { if (e.key === "Enter" && i < itemCount - 1) { e.preventDefault(); itemRefs.current[i + 1]?.focus(); } }}
                        maxLength={120}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder={`Item ${i + 1}`}
                        className={`min-h-11 w-full rounded-xl border px-3.5 text-sm outline-none transition placeholder:text-[#A79AA1] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20 disabled:cursor-not-allowed ${state === "ok" ? "border-[#2FBF71] bg-[#EAF8F0]" : state === "bad" ? "border-[#F0507F] bg-[#FFF1F1]" : "border-[#E8E2E5] bg-white"}`}
                      />
                    </div>
                  );
                })}
                {result && (result.missingItems?.length ?? 0) > 0 && (
                  <p className="rounded-xl border border-[#F1DDE4] bg-[#FFFAFC] px-3.5 py-2.5 text-sm text-[#45647A]"><span className="font-semibold text-[#153B56]">Missing or not matched: </span>{result.missingItems?.join(", ")}</p>
                )}
              </fieldset>
            )}

            {question.type === "true-false" && (
              <div role="radiogroup" aria-label="True or False" className="flex flex-col gap-2.5 sm:flex-row">
                {[true, false].map((value) => (
                  <button key={String(value)} type="button" role="radio" aria-checked={selTruth === value} disabled={Boolean(result) || busy} onClick={() => setSelectedTruth(value)} className={truthClass(value)}>{value ? "True" : "False"}</button>
                ))}
              </div>
            )}

            {question.type === "identification" && (
              <div>
                <label htmlFor="identification-answer" className="mb-1.5 block text-sm font-semibold text-[#2F2930]">Your answer</label>
                <input ref={inputRef} id="identification-answer" value={typed} onChange={(e) => setText(e.target.value)} disabled={Boolean(result) || busy} maxLength={500} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Type your answer…" className={`min-h-12 w-full rounded-xl border px-4 text-sm outline-none transition placeholder:text-[#A79AA1] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20 disabled:cursor-not-allowed ${result ? (result.correct ? "border-[#2FBF71] bg-[#EAF8F0]" : "border-[#F0507F] bg-[#FFF1F1]") : "border-[#E8E2E5] bg-white"}`} />
              </div>
            )}

            {hintOpen && question.hint && !result && (
              <div className="flex gap-3 rounded-xl border border-[#F1DDE4] bg-[#FFF7F9] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFE8EF] text-[#E9577D]"><BulbIcon /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#2F2930]">Hint</p><p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[#756B72]">{question.hint}</p><button type="button" onClick={() => setHintOpen(false)} className="mt-2 rounded-lg border border-[#F1DDE4] bg-white px-3 py-1.5 text-xs font-semibold text-[#C65380] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Got it</button></div>
              </div>
            )}

            {result && (
              <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 ${result.correct ? "border-[#CDEBD9] bg-[#EAF8F0]" : "border-[#F6D0D8] bg-[#FFF1F1]"}`}>
                <Mascot state={result.correct ? "correct" : "wrong"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={`flex items-center gap-1.5 text-base font-bold ${result.correct ? "text-[#1F7A4C]" : "text-[#B83F68]"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${result.correct ? "bg-[#2FBF71]" : "bg-[#F0507F]"}`}>{result.correct ? <CheckIcon /> : <CrossIcon />}</span>{result.correct ? "Correct!" : "Not quite."}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#45515A]">{result.correct ? "That’s right! " : ""}{result.explanation}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#F1DDE4] bg-[#FFFAFC] px-3.5 py-2.5 text-xs text-[#6C4A58]">
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input type="checkbox" checked={autoNext} onChange={(e) => saveAuto(e.target.checked, autoSeconds)} className="h-4 w-4 accent-[#E9577D]" />
                Auto-next
              </label>
              <label className="flex items-center gap-2">
                <span className="text-[#8B7C84]">after</span>
                <select value={autoSeconds} onChange={(e) => saveAuto(autoNext, Number(e.target.value))} disabled={!autoNext} className="rounded-lg border border-[#E8E2E5] bg-white px-2 py-1 text-xs disabled:opacity-50">
                  <option value={2}>2s</option>
                  <option value={3}>3s</option>
                  <option value={5}>5s</option>
                </select>
              </label>
              <span className="text-[#8B7C84]">{autoNext ? "Wrong answers wait twice as long. Turn off to pause." : "Or press Next Question yourself."}</span>
            </div>

            {error && <p role="alert" className="rounded-xl border border-[#F0C7D3] bg-[#FFF1F1] px-3.5 py-3 text-sm text-[#A43E5C]">{error}</p>}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {question.hint && !result && !hintOpen && (
                  <button type="button" onClick={() => setHintOpen(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#F1DDE4] bg-[#FFF7F9] px-5 text-xs font-semibold text-[#C65380] transition hover:bg-[#FFE8EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] sm:w-auto"><BulbIcon />Show Hint</button>
                )}
              </div>
              {result ? (
                <button type="button" onClick={next} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF477D] px-7 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(233,87,125,0.14)] transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:min-h-11">{busy ? "Finishing…" : `${isLast ? "Finish Round" : "Next Question"}${countdown !== null ? ` (${countdown})` : ""}`}{!busy && <span aria-hidden="true">→</span>}</button>
              ) : (
                <button type="submit" disabled={!canSubmit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF477D] px-7 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(233,87,125,0.14)] transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11">{busy ? "Checking…" : question.type === "identification" || question.type === "enumeration-identification" ? "Submit Answer" : "Check Answer"}{!busy && <span aria-hidden="true">→</span>}</button>
              )}
            </div>
          </form>
        </section>

        <aside aria-labelledby="next-up-title" className="hidden rounded-2xl border border-[#E8EAF0] bg-white p-4 sm:p-5 lg:col-start-2 lg:row-start-2 lg:block">
          <h2 id="next-up-title" className="text-sm font-bold text-[#153B56]">Next Up</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-xs leading-5 text-[#7890A4]">This is your last question. Nice work!</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {upcoming.map((q) => (
                <li key={q.index} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center text-[11px] text-[#8B9BAA]">{q.index + 1}</span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFE8EF] text-[#E9577D]"><TypeIcon type={q.type} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-xs font-medium leading-4 text-[#294A60]">{q.prompt}</span><span className="mt-1 inline-block rounded bg-[#F4F1F3] px-1.5 py-0.5 text-[10px] text-[#8B7C84]">{questionTypeLabel(q.type)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}


