import Link from "next/link";
import { CalendarDays, Clock3, CircleCheck, Flame, BookOpen, ChartNoAxesColumnIncreasing, RefreshCw } from "lucide-react";
import type { TypeProgress } from "@/lib/quiz/types";
import { MasteryPills } from "@/components/review/review-setup";

export type ReviewSubjectItem = {
  id: string;
  name: string;
  flashcardCount: number;
  progress: number;
  lastReviewedAt: number;
  mastered: number;
  typeMastery: TypeProgress;
};

type Props = {
  firstName: string;
  subjects: ReviewSubjectItem[];
  totalCards: number;
  totalMastered: number;
  dueCount: number;
  reviewedUniqueCount: number;
  reviewedTodayUnique: number;
  reviewAttemptsToday: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
};

function Icon({ name }: { name: "calendar" | "clock" | "check" | "flame" | "book" | "chart" }) { const icons={calendar:CalendarDays,clock:Clock3,check:CircleCheck,flame:Flame,book:BookOpen,chart:ChartNoAxesColumnIncreasing};const Component=icons[name];return <Component className="h-5 w-5" aria-hidden="true"/>; }

function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <div className="flex items-center gap-3">
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EDF0F3]" role="progressbar" aria-label={label ?? "Progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
      <div className="h-full rounded-full bg-gradient-to-r from-[#FF477D] to-[#F76C9A]" style={{ width: `${safeValue}%` }} />
    </div>
    <span className="w-9 shrink-0 text-right text-xs font-semibold text-[#567087]">{safeValue}%</span>
  </div>;
}

function SummaryCard({ title, value, detail, icon, progress }: { title: string; value: string | number; detail: string; icon: "calendar" | "clock" | "check" | "flame"; progress?: number }) {
  return <article className="min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-4 transition-colors hover:border-[#F1C3D2] sm:p-5">
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-[#FF5B8B]"><Icon name={icon} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[#557087] sm:text-sm">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-[#153B56]">{value}</p>
        <p className="mt-0.5 text-xs text-[#7890A4]">{detail}</p>
      </div>
    </div>
    {progress !== undefined && <div className="mt-4"><ProgressBar value={progress} label={`${title} progress`} /></div>}
  </article>;
}

function subjectSymbol(name: string) {
  const normalized = name.toLowerCase();
  if (/math|algebra|calculus|statistics/.test(normalized)) return "▦";
  if (/science|biology|chemistry|physics/.test(normalized)) return "⚗";
  if (/english|language|literature/.test(normalized)) return "▤";
  if (/history|social/.test(normalized)) return "❀";
  if (/filipino|literacy/.test(normalized)) return "◈";
  return "▤";
}

export function ReviewOverview({ firstName, subjects, totalCards, totalMastered, dueCount, reviewedUniqueCount, reviewedTodayUnique, reviewAttemptsToday, correctCount, wrongCount, streak }: Props) {
  const overallProgress = totalCards ? Math.round((totalMastered / totalCards) * 100) : 0;
  const completedTodayProgress = totalCards ? Math.round((reviewedTodayUnique / totalCards) * 100) : 0;
  const totalResults = correctCount + wrongCount;
  const accuracy = totalResults ? Math.round((correctCount / totalResults) * 100) : 0;

  return <div className="space-y-7">
    <section aria-labelledby="review-overview-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 text-[#FF5B8B]"><RefreshCw className="h-7 w-7" aria-hidden="true"/></span>
          <div><h2 id="review-overview-title" className="text-lg font-bold tracking-tight text-[#153B56] sm:text-xl">Review Overview</h2><p className="mt-0.5 text-xs text-[#6C879C] sm:text-sm">See your progress and stay on track with your learning goals.</p></div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E8EAF0] bg-white px-3 py-2 text-xs font-medium text-[#557087]"><Icon name="calendar" /> Today</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Cards Due Today" value={dueCount} detail={`${totalCards} total cards`} icon="calendar" progress={totalCards ? Math.round(((totalCards - dueCount) / totalCards) * 100) : 0} />
        <SummaryCard title="In Review" value={reviewAttemptsToday} detail="Review attempts today" icon="clock" progress={totalCards ? Math.min(100, Math.round((reviewAttemptsToday / totalCards) * 100)) : 0} />
        <SummaryCard title="Reviewed Today" value={reviewedTodayUnique} detail="Unique cards reviewed today" icon="check" progress={completedTodayProgress} />
        <article className="min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-4 transition-colors hover:border-[#F1C3D2] sm:p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-[#FF5B8B]"><Icon name="flame" /></span><div><p className="text-xs font-medium text-[#557087] sm:text-sm">Study Streak</p><p className="mt-1 text-2xl font-bold tracking-tight text-[#153B56]">{streak} {streak === 1 ? "day" : "days"}</p><p className="mt-0.5 text-xs text-[#7890A4]">{streak ? "Keep your momentum going!" : "Your next study day starts a streak."}</p></div></div></article>
      </div>
    </section>

    {totalCards === 0 ? <section className="overflow-hidden rounded-2xl border border-[#F1DDE4] bg-[#FFFAFC] p-5 sm:p-7"><div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#FFE8EF] text-3xl text-[#E9577D]">♡</div><div className="flex-1"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C65380]">A fresh start</p><h2 className="mt-1 text-xl font-bold text-[#153B56]">Your first flashcard starts here.</h2><p className="mt-1 text-sm leading-6 text-[#6C879C]">Add a question and start building your knowledge. Choose a subject to add your first card.</p></div><Link href="/subjects" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF477D] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Add Flashcard <span aria-hidden="true">→</span></Link></div></section> : dueCount === 0 ? <section className="flex flex-col gap-3 rounded-2xl border border-[#DDEFE5] bg-[#F7FCF9] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="font-semibold text-[#245C43]">You’re all caught up for now!</h2><p className="mt-1 text-sm text-[#527C68]">No cards are due. You can still practice with your available flashcards.</p></div><Link href="/review/setup" className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#FF477D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Practice now →</Link></section> : null}

    <section aria-labelledby="recent-subjects-title">
      <div className="mb-4 flex items-end justify-between gap-3"><div className="flex items-start gap-3"><span className="mt-1 text-[#FF5B8B]"><Icon name="book" /></span><div><h2 id="recent-subjects-title" className="text-lg font-bold tracking-tight text-[#153B56] sm:text-xl">Recent Subjects</h2><p className="mt-0.5 text-xs text-[#6C879C] sm:text-sm">Track mastered cards and continue where you left off.</p></div></div><Link href="/subjects" className="shrink-0 text-xs font-semibold text-[#E9577D] hover:text-[#C93E68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">View all <span aria-hidden="true">→</span></Link></div>
      {subjects.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{subjects.map((subject) => <Link key={subject.id} href={`/subjects/${subject.id}`} className="group min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#F0B6C9] hover:shadow-[0_5px_16px_rgba(47,41,48,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-xl text-[#FF5B8B]">{subjectSymbol(subject.name)}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="min-w-0 truncate text-sm font-bold text-[#153B56]">{subject.name}</h3>{subject.mastered === subject.flashcardCount && subject.flashcardCount > 0 && <span title="Mastered" aria-label="Mastered" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F7C6D6] bg-[#FFF0F5] px-2 py-1 text-[10px] font-bold text-[#D94675]">✓ Mastered</span>}</div><p className="mt-1 text-xs text-[#7890A4]">{subject.flashcardCount} {subject.flashcardCount === 1 ? "card" : "cards"}</p></div><span className="text-lg text-[#7190A6] transition group-hover:translate-x-0.5 group-hover:text-[#E9577D]" aria-hidden="true">›</span></div><div className="mt-4"><ProgressBar value={subject.progress} label={`${subject.name} mastery progress`} /></div><div className="mt-3 flex flex-wrap gap-1" aria-label={`${subject.name} quiz-type mastery`}>
          <MasteryPills progress={subject.typeMastery} />

        </div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-[#E9D9E0] bg-white px-5 py-8 text-center"><p className="font-semibold text-[#153B56]">No subjects yet</p><p className="mt-1 text-sm text-[#7890A4]">Create a subject to start organizing your flashcards.</p><Link href="/subjects" className="mt-4 inline-flex rounded-full bg-[#FF477D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E9577D]">Go to My Subjects →</Link></div>}
    </section>

    <section aria-labelledby="review-progress-title" className="rounded-2xl border border-[#E8EAF0] bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0F5] text-[#FF5B8B]"><Icon name="chart" /></span><div><h2 id="review-progress-title" className="font-bold text-[#153B56]">Review Progress</h2><p className="mt-0.5 text-xs text-[#7890A4]">Cards count as complete only after mastery of every question type that applies, plus Mixed / Random.</p></div></div><Link href="/progress" className="text-xs font-semibold text-[#E9577D] hover:text-[#C93E68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">View details <span aria-hidden="true">→</span></Link></div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:items-center">
        <div className="flex items-center gap-4 rounded-xl bg-[#FFFAFC] p-4"><div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#E9577D ${overallProgress * 3.6}deg, #F0F1F4 0deg)` }}><div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-white"><span className="text-xl font-bold text-[#153B56]">{overallProgress}%</span><span className="text-[10px] text-[#7890A4]">mastered</span></div></div><div><p className="text-sm font-semibold text-[#153B56]">Overall Progress</p><p className="mt-1 text-xs text-[#7890A4]">{totalMastered} / {totalCards} mastered · {reviewedUniqueCount} reviewed</p></div></div>
        <div className="space-y-4"><div><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="text-[#557087]">Correct answers</span><span className="font-semibold text-[#153B56]">{correctCount}</span></div><ProgressBar value={accuracy} label="Correct answer share" /></div><div><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="text-[#557087]">Incorrect answers</span><span className="font-semibold text-[#153B56]">{wrongCount}</span></div><ProgressBar value={totalResults ? Math.round((wrongCount / totalResults) * 100) : 0} label="Incorrect answer share" /></div><p className="text-xs text-[#7890A4]">Based on {totalResults} saved review {totalResults === 1 ? "attempt" : "attempts"}. Cards may be reviewed more than once.</p></div>
      </div>
    </section>
  </div>;
}


