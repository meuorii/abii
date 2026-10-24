import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Layers3, BookOpen, FlaskConical, Leaf, Plus, RefreshCw, ChevronRight, ArrowRight, Circle } from "lucide-react";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";

type SubjectOverview = {
  id: string;
  name: string;
  flashcardCount: number;
  masteredCount: number;
  progress: number;
};

type DashboardOverviewProps = {
  firstName: string;
  dueCount: number;
  totalCards: number;
  overallMastery: { mastered: number; total: number; progress: number };
  currentStreak: number;
  lastSevenDays: { label: string; completed: boolean }[];
  subjects: SubjectOverview[];
  loadFailed?: boolean;
};

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) { const icons: Record<string, typeof CalendarDays> = { calendar: CalendarDays, cards: Layers3, book: BookOpen, flask: FlaskConical, leaf: Leaf, plus: Plus, refresh: RefreshCw, chevron: ChevronRight, arrow: ArrowRight, circle: Circle }; const Component=icons[name]??Circle; return <Component className={className} aria-hidden="true" />; }

function SectionHeading({ icon, title, href, linkLabel = "See all" }: { icon: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F5] text-[#E9577D]"><Icon name={icon} className="h-[19px] w-[19px]" /></span>
        <h2 className="truncate text-base font-semibold tracking-[-0.025em] text-[#2F2930] sm:text-lg">{title}</h2>
      </div>
      {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#E9577D] transition-colors hover:bg-[#FFF0F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">{linkLabel}<span aria-hidden="true">→</span></Link>}
    </div>
  );
}

function EmptySubjects() {
  return (
    <div className="rounded-2xl border border-dashed border-[#E8C7D2] bg-white px-5 py-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F5] text-[#E9577D]"><Icon name="book" /></span>
      <h3 className="mt-3 text-sm font-semibold text-[#2F2930]">Your study library starts here</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-[#756B72]">Add a subject, then create flashcards for the topics you want to remember.</p>
      <Link href="/subjects" className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-xl bg-[#FF6F96] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"><Icon name="plus" className="h-4 w-4" />Add Subject</Link>
    </div>
  );
}

export function DashboardOverview({ firstName, dueCount, totalCards, overallMastery, currentStreak, lastSevenDays, subjects, loadFailed = false }: DashboardOverviewProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const shownSubjects = subjects.slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-4 pb-24 sm:space-y-6 sm:px-6 sm:py-6 lg:px-6 lg:py-5 lg:pb-8">
      <section className="relative isolate min-h-[370px] overflow-hidden rounded-[20px] border border-[#F6DCE5] bg-[#FFF0F5] sm:min-h-[248px] lg:min-h-[254px]" aria-labelledby="dashboard-hero-title">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_45%,rgba(255,255,255,0.86),transparent_58%)]" />
        <div className="relative z-10 flex min-h-[370px] items-start sm:min-h-[248px] sm:items-center lg:min-h-[254px]">
          <div className="w-full max-w-full px-5 pb-[145px] pt-6 sm:max-w-[57%] sm:px-8 sm:py-8 sm:pb-8 lg:max-w-[56%] lg:px-9">
            <p className="text-xs font-medium text-[#2F4658] sm:text-sm">{greeting}, {firstName}! <span aria-hidden="true">👋</span></p>
            <h1 id="dashboard-hero-title" className="mt-2 max-w-[490px] text-[clamp(1.7rem,3.3vw,2.8rem)] font-bold leading-[1.08] tracking-[-0.055em] text-[#203D50]">What should you <span className="text-[#E9577D]">study</span> today?</h1>
            <p className="mt-3 max-w-[340px] text-xs leading-5 text-[#6C8192] sm:text-sm sm:leading-6">A little review today helps you remember more tomorrow.</p>
            <Link href="/review" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6F96] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_4px_10px_rgba(233,87,125,0.15)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:mt-5 sm:min-h-11 sm:px-5 sm:text-sm">Start Review <Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
          <div className="pointer-events-none absolute bottom-0 right-0 h-[48%] w-[58%] sm:inset-y-0 sm:h-auto sm:w-[49%] lg:w-[48%]">
            <Image src="/dashboard-hero/dashboard.png" alt="Abii the pink otter waving hello" fill priority sizes="(max-width: 640px) 48vw, (max-width: 1024px) 42vw, 520px" className="object-contain object-[right_bottom] sm:object-[right_bottom]" />
          </div>
        </div>
      </section>

      {loadFailed ? (
        <section role="alert" className="rounded-2xl border border-[#F2C9D5] bg-white p-5 sm:p-7">
          <p className="text-sm font-semibold text-[#B83F68]">Your study data couldn’t load</p>
          <p className="mt-1 text-sm leading-6 text-[#756B72]">Please refresh the page and try again. Your study data hasn’t been changed.</p>
          <Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-[#FF6F96] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Try again</Link>
        </section>
      ) : (
        <>
          <section aria-label="Overall mastery" className="rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-[#153B56]">Overall mastery</h2>
            <MasteryProgressBar label="Overall mastery progress" mastered={overallMastery.mastered} total={overallMastery.total} progress={overallMastery.progress} size="md" />
          </section>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
            <section className="min-w-0 rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5" aria-labelledby="today-review-heading">
              <SectionHeading icon="calendar" title="Today’s Review" href="/review" />
              <div className="flex min-h-[100px] flex-wrap items-center gap-4 rounded-2xl border border-[#F6E8ED] bg-[#FFFCFD] p-4 sm:flex-nowrap sm:gap-5 sm:px-5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FFE8EF] text-[#E9577D]"><Icon name="cards" className="h-7 w-7" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2"><span className="text-3xl font-bold tracking-[-0.06em] text-[#203D50] tabular-nums">{dueCount}</span><span className="text-xs text-[#536B7F]">{dueCount === 1 ? "card due" : "cards due"}</span></div>
                  <p className="mt-1 text-xs text-[#8392A0]">{dueCount > 0 ? "Keep your study momentum going." : totalCards > 0 ? "You’re all caught up for now." : "Add flashcards to start your first review."}</p>
                </div>
                <Link href={dueCount > 0 ? "/review" : "/subjects"} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6F96] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">{dueCount > 0 ? "Start Review" : totalCards > 0 ? "Review" : "Add Cards"}<Icon name="arrow" className="h-4 w-4" /></Link>
              </div>
            </section>

            <section className="min-w-0 rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5" aria-labelledby="study-streak-heading">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[#E9577D]"><span aria-hidden="true" className="text-xl">♨</span><h2 id="study-streak-heading" className="text-base font-semibold text-[#2F4658]">Study Streak</h2></div>
                  <p className="mt-2 text-2xl font-bold tracking-[-0.05em] text-[#203D50]">{currentStreak} {currentStreak === 1 ? "day" : "days"}</p>
                  <p className="mt-1 text-xs text-[#536B7F]">{currentStreak > 0 ? "You’re showing up for yourself." : "A small session can start your streak."}</p>
                </div>
                <div className="relative h-[58px] w-[70px] shrink-0 overflow-hidden rounded-xl bg-[#FFF7F9] sm:h-[70px] sm:w-[82px]">
                  <Image src="/dashboard-hero/dashboard.png" alt="" fill sizes="82px" className="object-contain object-bottom" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Study activity for the last seven days">
                {lastSevenDays.map(({ completed, label }, index) => (
                  <div key={index} className="flex min-w-0 flex-col items-center gap-1.5">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${completed ? "border-[#FF6F96] bg-[#FF6F96] text-white" : "border-[#E8E2E5] bg-white text-transparent"}`} aria-label={completed ? "Studied" : "No study recorded"}>{completed ? "✓" : "·"}</span>
                    <span className="text-[9px] font-medium text-[#8B9AA6]">{label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section aria-labelledby="subjects-heading" className="rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5">
            <SectionHeading icon="book" title="My Subjects" href="/subjects" />
            {subjects.length === 0 ? <EmptySubjects /> : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {shownSubjects.map((subject, index) => {
                  const subjectIcon = ["cards", "flask", "book", "leaf"][index % 4];
                  return <li key={subject.id}>
                    <Link href={`/subjects/${subject.id}`} className="group block h-full rounded-xl border border-[#EAE6E8] bg-white p-3.5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#F0B6C9] hover:shadow-[0_6px_18px_rgba(47,41,48,0.045)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-[#E9577D]"><Icon name={subjectIcon} className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#2F4658]">{subject.name}</span><span className="mt-1 block text-[10px] text-[#8B9AA6]">{subject.flashcardCount} {subject.flashcardCount === 1 ? "card" : "cards"}</span></span>
                        <Icon name="chevron" className="h-4 w-4 shrink-0 text-[#A0AFBA] transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-4"><MasteryProgressBar label={`${subject.name} mastery progress`} mastered={subject.masteredCount} total={subject.flashcardCount} progress={subject.progress} /></div>
                    </Link>
                  </li>;
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="quick-actions-heading" className="rounded-[18px] border border-[#F2E5EA] bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F5] text-[#E9577D] text-xl" aria-hidden="true">ϟ</span><h2 id="quick-actions-heading" className="text-base font-semibold tracking-[-0.025em] text-[#2F2930] sm:text-lg">Quick Actions</h2></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link href="/subjects" className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-[#F3E2E8] bg-[#FFFCFD] p-3.5 transition-[border-color,background-color] hover:border-[#F0B6C9] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF6F96] text-white"><Icon name="plus" className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#2F4658]">Add Subject</span><span className="mt-1 block text-[10px] leading-4 text-[#8795A2]">Create a new subject and start learning.</span></span><Icon name="chevron" className="h-4 w-4 shrink-0 text-[#E9577D]" />
              </Link>
              <Link href="/review" className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-[#F3E2E8] bg-[#FFFCFD] p-3.5 transition-[border-color,background-color] hover:border-[#F0B6C9] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F17D9D] text-white"><Icon name="refresh" className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#2F4658]">Start Review</span><span className="mt-1 block text-[10px] leading-4 text-[#8795A2]">Jump back into your pending cards.</span></span><Icon name="chevron" className="h-4 w-4 shrink-0 text-[#E9577D]" />
              </Link>
              <Link href="/progress" className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-[#F3E2E8] bg-[#FFFCFD] p-3.5 transition-[border-color,background-color] hover:border-[#F0B6C9] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E9577D] text-white"><Icon name="book" className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#2F4658]">Progress</span><span className="mt-1 block text-[10px] leading-4 text-[#8795A2]">See how your study is coming along.</span></span><Icon name="chevron" className="h-4 w-4 shrink-0 text-[#E9577D]" />
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
