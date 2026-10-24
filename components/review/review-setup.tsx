"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { useRouter } from "next/navigation";
import { ListChecks, PenLine, ListOrdered, Shuffle, CheckCircle2, BookOpen, Layers3, FolderOpen } from "lucide-react";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";
import {
  QUIZ_MODES,
  QUIZ_TYPE_DESCRIPTIONS,
  QUIZ_TYPE_LABELS,
  type QuizMode,
  type ReviewScope,
  type SetupSubject,
  type TypeProgress,
} from "@/lib/quiz/types";

type Props = {
  firstName: string;
  subjects: SetupSubject[];
  allEligible: Record<QuizMode, number>;
  totalCards: number;
  allMastered: number;
  allProgress: number;
  allCompletedRequirements: number;
  allTotalRequirements: number;
  allTypeMastery: TypeProgress;
  initialSubjectId: string | null;
  initialTopicId: string | null;
  loadFailed: boolean;
};

export function TypeIcon({ type, className = "h-6 w-6" }: { type: QuizMode | import("@/lib/quiz/types").QuizType; className?: string }) {
  const Icon = type === "multiple-choice" || type === "enumeration-multiple-choice" ? ListChecks : type === "identification" ? PenLine : type === "enumeration-identification" ? ListOrdered : type === "random" ? Shuffle : CheckCircle2;
  return <Icon className={className} aria-hidden="true" />;
}

/** Completion pills for every mode that applies to at least one card. */
export function MasteryPills({ progress, size = "sm", className = "flex flex-wrap gap-1" }: { progress: TypeProgress; size?: "sm" | "md"; className?: string }) {
  const dims = size === "md" ? "h-9 min-w-9 px-2 text-sm" : "h-7 min-w-7 px-2 text-[11px]";
  return (
    <span className={className} aria-label="Question type completion">
      {QUIZ_MODES.filter((mode) => (progress?.[mode]?.total ?? 0) > 0).map((mode) => {
        // Newly created subjects may not have saved progress for every quiz mode yet.
        const { done, total } = progress?.[mode] ?? { done: 0, total: 0 };
        const complete = done === total;
        return (
          <span key={mode} title={`${QUIZ_TYPE_LABELS[mode]}: ${done}/${total} cards complete`} aria-label={`${QUIZ_TYPE_LABELS[mode]} ${complete ? "complete" : "not complete"}: ${done}/${total}`} className={`inline-flex ${dims} items-center justify-center rounded-full border font-bold ${complete ? "border-[#F7C6D6] bg-[#FFF0F5] text-[#D94675]" : "border-[#E7E7EB] bg-[#F3F3F5] text-[#A0A0AA]"}`}>
            <TypeIcon type={mode} className="h-3.5 w-3.5" />
          </span>
        );
      })}
    </span>
  );
}

function unavailableReason(type: QuizMode) {
  if (type === "multiple-choice") return "Multiple Choice needs flashcards with short answers, plus at least one other flashcard with a different answer to build the options.";
  if (type === "identification") return "Identification needs flashcards with a question and a short answer (120 characters or fewer).";
  if (type === "random") return "Mixed / Random needs at least one usable flashcard.";
  return "True or False needs flashcards with a question and a short answer (120 characters or fewer).";
}

export function ReviewSetup({ firstName, subjects, allEligible, totalCards, allMastered, allProgress, allCompletedRequirements, allTotalRequirements, allTypeMastery, initialSubjectId, initialTopicId, loadFailed }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [scope, setScope] = useState<ReviewScope>(initialTopicId ? "topic" : initialSubjectId ? "subject" : "all");
  const [subjectId, setSubjectId] = useState<string>(initialSubjectId ?? "");
  const [topicId, setTopicId] = useState<string>(initialTopicId ?? "");
  const [type, setType] = useState<QuizMode | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loadFailed) {
      toast({ kind: "error", title: "Review options couldn’t load", message: "Check your connection, then try again." });
    } else if (subjects.length === 0) {
      toast({ kind: "info", title: "No subjects yet", message: "Create a subject and add flashcards before starting a quiz." });
    } else if (totalCards === 0) {
      toast({ kind: "info", title: "No flashcards yet", message: "Add flashcards to your subjects before starting a quiz." });
    }
  }, [loadFailed, subjects.length, totalCards, toast]);

  const selectedSubject = subjects.find((s) => s.id === subjectId) ?? null;
  const selectedTopic = selectedSubject?.topics.find((item) => item.id === topicId) ?? null;
  const counts = scope === "all" ? allEligible : scope === "subject" ? selectedSubject?.eligible ?? null : selectedTopic?.eligible ?? null;
  const available = counts && type ? counts[type] : null;
  const hasRequiredScope = scope === "all" || Boolean(selectedSubject && (scope === "subject" || selectedTopic));
  const canStart = Boolean(hasRequiredScope && type && available && available > 0 && !starting);
  const scopeLabel = scope === "all" ? "All Subjects and Topics" : scope === "subject" ? selectedSubject?.name : `${selectedSubject?.name ?? "Subject"} · ${selectedTopic?.name ?? "Topic"}`;

  async function start() {
    if (!canStart || !type) return;
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/quiz/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, ...(scope !== "all" ? { subjectId } : {}), ...(scope === "topic" ? { topicId } : {}), type }) });
      const data = (await response.json().catch(() => ({}))) as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) {
        const message = data.error || "We couldn’t start your quiz. Please try again.";
        setError(message);
        toast({ kind: "error", title: "Couldn’t start quiz", message });
        setStarting(false);
        return;
      }
      toast({ kind: "success", title: "Quiz ready", message: "Your review session is starting." });
      router.push(`/review/quiz/${data.sessionId}`);
    } catch {
      const message = "You seem to be offline. Check your connection and try again.";
      setError(message);
      toast({ kind: "error", title: "Connection hiccup", message });
      setStarting(false);
    }
  }

  const hero = (
    <section aria-labelledby="setup-hero-title" className="relative isolate min-h-[170px] overflow-hidden rounded-[1.4rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[210px]">
      <div className="relative z-10 max-w-[64%] px-5 py-6 sm:max-w-[58%] sm:px-8 sm:py-8">
        <p className="text-sm font-semibold text-[#C65380]">Ready, {firstName}? <span aria-hidden="true">👋</span></p>
        <h1 id="setup-hero-title" className="mt-2 text-[clamp(1.5rem,3vw,2.3rem)] font-bold leading-[1.12] tracking-[-0.045em] text-[#173B55]">Let’s <span className="text-[#E9577D]">review!</span></h1>
        <p className="mt-2 max-w-sm text-xs leading-5 text-[#45647A] sm:text-sm sm:leading-6">Pick a subject and a quiz type. Your questions come from your own flashcards.</p>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[42%] sm:w-[40%]">
        <Image src="/dashboard-hero/my-subjects.png" alt="" fill priority sizes="(max-width: 640px) 42vw, 380px" className="object-contain object-bottom" />
      </div>
    </section>
  );

  if (loadFailed) {
    return (
      <div className="space-y-5 p-4 sm:p-6 xl:p-7">
        {hero}
        <section role="alert" className="rounded-2xl border border-[#F0C7D3] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#2F2930]">Your review options couldn’t load.</h2>
          <p className="mt-2 text-sm leading-6 text-[#756B72]">Please check your connection and try again. Your study data hasn’t been changed.</p>
          <Link href="/review/setup" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Try again</Link>
        </section>
      </div>
    );
  }

  if (subjects.length === 0 || totalCards === 0) {
    return (
      <div className="space-y-5 p-4 sm:p-6 xl:p-7">
        {hero}
        <section className="rounded-2xl border border-dashed border-[#E8C7D2] bg-[#FFFCFD] px-5 py-10 text-center">
          <div className="relative mx-auto h-28 w-28"><Image src="/mascot/empty.png" alt="Abii is ready when you are" fill sizes="112px" className="object-contain" /></div>
          <h2 className="mt-2 text-lg font-bold text-[#2F2930]">{subjects.length === 0 ? "Create a subject to start reviewing." : "Add flashcards to start reviewing."}</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-[#756B72]">Quizzes are built from your own flashcards, so add some questions and answers first.</p>
          <Link href="/subjects" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#FF6F96] px-5 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Go to My Subjects</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 pb-24 sm:p-6 xl:p-7">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm">
        <Link href="/review" className="rounded font-medium text-[#75889A] transition-colors hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Review</Link>
        <span aria-hidden="true" className="text-[#B4A5AC]">›</span>
        <span aria-current="page" className="font-semibold text-[#2F2930]">New quiz</span>
      </nav>
      {hero}

      <section aria-labelledby="choose-scope" className="space-y-3">
        <h2 id="choose-scope" className="text-base font-bold tracking-tight text-[#153B56] sm:text-lg"><span className="mr-2 text-[#E9577D]">1</span>Choose review scope</h2>
        <div role="radiogroup" aria-labelledby="choose-scope" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([ ["all", "All Subjects and Topics", Layers3], ["subject", "Specific Subject", BookOpen], ["topic", "Specific Topic", FolderOpen] ] as const).map(([value, label, Icon]) => <button key={value} type="button" role="radio" aria-checked={scope === value} onClick={() => { setScope(value); setError(""); }} className={`flex min-h-16 min-w-0 items-center gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 ${scope === value ? "border-[#FF6F96] bg-[#FFF0F5] shadow-[0_4px_14px_rgba(233,87,125,0.1)]" : "border-[#E8E2E5] bg-white hover:border-[#F0B6C9]"}`}><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FFE8EF] text-[#E9577D]"><Icon className="h-5 w-5"/></span><span className="min-w-0 text-sm font-bold text-[#153B56]">{label}</span></button>)}
        </div>
        {scope !== "all" && <div className={`grid min-w-0 gap-3 ${scope === "topic" ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
          <label className="block text-sm font-semibold text-[#294A60]">Subject<select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setTopicId(""); setError(""); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3 text-sm font-normal text-[#153B56] focus:border-[#E9577D] focus:outline-none focus:ring-4 focus:ring-[#FF9FBA]/15"><option value="">Choose a subject…</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          {scope === "topic" && <label className="block text-sm font-semibold text-[#294A60]">Topic<select value={topicId} onChange={(event) => { setTopicId(event.target.value); setError(""); }} disabled={!selectedSubject || selectedSubject.topics.length === 0} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3 text-sm font-normal text-[#153B56] disabled:bg-[#F5F2F4] focus:border-[#E9577D] focus:outline-none focus:ring-4 focus:ring-[#FF9FBA]/15"><option value="">{!selectedSubject ? "Choose a subject first" : selectedSubject.topics.length ? "Choose a topic…" : "This subject has no topics yet"}</option>{selectedSubject?.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name} · {topic.flashcardCount} cards</option>)}</select>{selectedSubject && selectedSubject.topics.length === 0 && <Link href={`/subjects/${selectedSubject.id}`} className="mt-2 inline-flex text-xs font-semibold text-[#C65380] underline underline-offset-2">Create a topic in this subject</Link>}</label>}
        </div>}
        <p className="text-xs leading-5 text-[#7890A4]">{scope === "all" ? `${totalCards} flashcards across ${subjects.length} subjects; ${allMastered} mastered. Eligible questions can draw distractors from your full study library.` : scope === "subject" ? selectedSubject ? `${selectedSubject.flashcardCount} flashcards in ${selectedSubject.name}, across all its topics.` : "Choose a subject to see its eligible questions." : selectedTopic ? `${selectedTopic.flashcardCount} flashcards in ${selectedTopic.name}.` : "Choose a subject and topic to continue."}</p>
        {scope === "all" && <MasteryProgressBar label="Overall mastery progress" mastered={allMastered} total={totalCards} completedRequirements={allCompletedRequirements} totalRequirements={allTotalRequirements} progress={allProgress} />}
        {scope === "subject" && selectedSubject && <MasteryProgressBar label={`${selectedSubject.name} mastery progress`} mastered={selectedSubject.mastered} total={selectedSubject.flashcardCount} completedRequirements={selectedSubject.completedRequirements} totalRequirements={selectedSubject.totalRequirements} usable={selectedSubject.usableCount} progress={selectedSubject.masteryProgress} />}
        {scope === "topic" && selectedTopic && <MasteryProgressBar label={`${selectedTopic.name} mastery progress`} mastered={selectedTopic.mastered} total={selectedTopic.flashcardCount} completedRequirements={selectedTopic.completedRequirements} totalRequirements={selectedTopic.totalRequirements} usable={selectedTopic.usableCount} progress={selectedTopic.masteryProgress} />}
        {scope === "all" && <MasteryPills progress={allTypeMastery} />}
        {scope === "subject" && selectedSubject && <MasteryPills progress={selectedSubject.typeMastery} />}
      </section>
      <section aria-labelledby="choose-type">
        <h2 id="choose-type" className="text-base font-bold tracking-tight text-[#153B56] sm:text-lg"><span className="mr-2 text-[#E9577D]">2</span>Choose a quiz type</h2>
        <p className="mt-1 text-xs leading-5 text-[#7890A4]">Each question type, including Mixed / Random, has its own 3-correct-answer streak. Complete every type that applies to a card, plus Random, to earn the <span className="font-semibold text-[#207A4B]">Mastered</span> indicator.</p>
        <div role="radiogroup" aria-labelledby="choose-type" className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {QUIZ_MODES.map((t) => {
            const selected = type === t;
            const n = counts ? counts[t] : null;
            return (
              <button key={t} type="button" role="radio" aria-checked={selected} onClick={() => { setType(t); setError(""); if (hasRequiredScope && counts && counts[t] === 0) toast({ kind: "error", title: "No eligible flashcards", message: `There are no cards ready for ${QUIZ_TYPE_LABELS[t]} in ${scopeLabel ?? "this scope"}. Choose another quiz type or update your flashcards.` }); }} className={`flex min-h-[132px] min-w-0 flex-col items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 ${selected ? "border-[#FF6F96] bg-[#FFF0F5] shadow-[0_4px_14px_rgba(233,87,125,0.1)]" : "border-[#E8E2E5] bg-white hover:border-[#F0B6C9]"}`}>
                <span className="flex w-full items-center justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${selected ? "bg-[#FF6F96] text-white" : "bg-[#FFE8EF] text-[#E9577D]"}`}><TypeIcon type={t} /></span>
                  <span className="flex flex-wrap items-center justify-end gap-1.5">
                    {n !== null && <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${n > 0 ? "bg-white text-[#C65380]" : "bg-[#F4F1F3] text-[#8B7C84]"}`}>{n} {n === 1 ? "question" : "questions"}</span>}
                    {scope !== "topic" && (() => {
                      const progress = scope === "all" ? allTypeMastery[t] : selectedSubject?.typeMastery[t];
                      const isComplete = Boolean(progress && progress.total > 0 && progress.done === progress.total);
                      return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isComplete ? "bg-[#FFF0F5] text-[#D94675]" : "bg-[#F3F3F5] text-[#A0A0AA]"}`}>{isComplete ? "✓" : "○"}</span>;
                    })()}
                  </span>
                </span>
                <span>
                  <span className="block text-sm font-bold text-[#153B56]">{QUIZ_TYPE_LABELS[t]}{t === "random" && <span className="ml-2 rounded-full bg-[#FFF0F5] px-2 py-0.5 text-[10px] font-semibold text-[#C65380]">Optional</span>}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#6C879C]">{QUIZ_TYPE_DESCRIPTIONS[t]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-live="polite" className="rounded-2xl border border-[#F1DDE4] bg-[#FFFAFC] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#153B56]">Quiz summary</h2>
            {!hasRequiredScope || !type ? (
              <p className="mt-1 text-sm text-[#6C879C]">{!hasRequiredScope ? scope === "topic" && selectedSubject?.topics.length === 0 ? "This subject has no topics yet. Create one to review by topic." : `Choose ${scope === "topic" ? "a subject and topic" : "a subject"} to continue.` : "Choose a quiz type to continue."}</p>
            ) : available && available > 0 ? (
              <p className="mt-1 text-sm text-[#45647A]"><span className="font-semibold text-[#153B56]">{available} {available === 1 ? "question" : "questions"}</span> · {QUIZ_TYPE_LABELS[type]} · {scopeLabel}. Every eligible flashcard is included, in random order.</p>
            ) : (
              <p role="alert" className="mt-1 text-sm leading-6 text-[#A43E5C]">No eligible flashcards for {QUIZ_TYPE_LABELS[type]} in {scopeLabel}. {unavailableReason(type)} <Link href={selectedSubject ? `/subjects/${selectedSubject.id}` : "/subjects"} className="font-semibold underline underline-offset-2">Add or update flashcards</Link>, or choose another option yourself.</p>
            )}            {error && <p role="alert" className="mt-2 text-sm text-[#A43E5C]">{error}</p>}
          </div>
          <button type="button" onClick={start} disabled={!canStart} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF477D] px-7 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(233,87,125,0.14)] transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11">
            {starting ? "Starting…" : "Start Quiz"} {!starting && <span aria-hidden="true">→</span>}
          </button>
        </div>
      </section>
    </div>
  );
}


