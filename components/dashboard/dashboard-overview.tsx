import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Layers3, BookOpen, FlaskConical, Leaf, Plus, RefreshCw, ChevronRight, ArrowRight, Circle } from "lucide-react";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";
import { FeaturedBadgesStream } from "@/components/badges/featured-badges-stream";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";

type SubjectOverview = { id: string; name: string; flashcardCount: number; progress: number };

type DashboardOverviewProps = {
  firstName: string;
  studyTimezone: string;
  userId: string;
  dueCount: number;
  totalCards: number;
  overallMastery: { progress: number };
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFE8EF] text-[#F8769C]"><Icon name={icon} className="h-[19px] w-[19px]" /></span>
        <h2 className="truncate text-base font-semibold tracking-[-0.025em] text-[#30262B] sm:text-lg">{title}</h2>
      </div>
      {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#F8769C] transition-colors hover:bg-[#FFE8EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC658D]">{linkLabel}<span aria-hidden="true">→</span></Link>}
    </div>
  );
}

function EmptySubjects() {
  return (
    <div className="rounded-2xl border border-dashed border-[#E8DDE1] bg-white px-5 py-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFE8EF] text-[#F8769C]"><Icon name="book" /></span>
      <h3 className="mt-3 text-sm font-semibold text-[#30262B]">Your study library starts here</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-[#6F5964]">Add a subject, then create flashcards for the topics you want to remember.</p>
      <Link href="/subjects" className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-xl bg-[#F8769C] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#EC658D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC658D] focus-visible:ring-offset-2"><Icon name="plus" className="h-4 w-4" />Add Subject</Link>
    </div>
  );
}

export function DashboardOverview({ firstName, studyTimezone, userId, dueCount, totalCards, overallMastery, currentStreak, lastSevenDays, subjects, loadFailed = false }: DashboardOverviewProps) {
  const shownSubjects = subjects.slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-4 pb-24 sm:space-y-6 sm:px-6 sm:py-6 lg:px-6 lg:py-5 lg:pb-8">
      <AbiiPageHero
        variant="dashboard"
        headingId="dashboard-hero-title"
        eyebrow={<DashboardGreeting firstName={firstName} studyTimezone={studyTimezone} />}
        title={<h1 className="abii-hero-heading max-w-[490px]">What should you <span className="abii-hero-emphasis">study</span> today?</h1>}
        description={<p className="max-w-[520px]">Choose a subject to continue learning, or review what’s due today.</p>}
        mascotSrc="/dashboard-hero/dashboard.png"
        mascotAlt="Abii the pink otter waving hello"
        priority
      />

      {loadFailed ? (
        <section role="alert" className="rounded-2xl border border-[#E8DDE1] bg-white p-5 sm:p-7">
          <p className="text-sm font-semibold text-[#8A1F36]">Your study data couldn’t load</p>
          <p className="mt-1 text-sm leading-6 text-[#6F5964]">Please refresh the page and try again. Your study data hasn’t been changed.</p>
          <Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-[#F8769C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EC658D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC658D]">Try again</Link>
        </section>
      ) : (
        <>
          <ScrollReveal><section aria-label="Overall mastery" className="rounded-[18px] border border-[#E8DDE1] bg-white p-4 sm:p-4">
            <div className="space-y-1"><MasteryProgressBar label="Overall Mastery" ariaLabel="Overall mastery progress" progress={overallMastery.progress} size="md" /><p className="text-xs text-[#6F5964]">How much of your study material you’ve mastered through practice.</p></div>
          </section></ScrollReveal>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
            <ScrollReveal className="min-w-0"><section className="min-w-0 rounded-[18px] border border-[#E8DDE1] bg-white p-4 sm:p-5" aria-labelledby="today-review-heading">
              <SectionHeading icon="calendar" title="Today’s Review" href="/review/setup?reviewFilter=due" />
                <div className="flex min-h-[100px] flex-col items-stretch gap-3 rounded-2xl border border-[#F6E8ED] bg-[#FFF9FC] p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
                  <div className="flex min-w-0 items-center gap-4 sm:flex-1">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FFE8EF] text-[#F8769C]"><Icon name="cards" className="h-7 w-7" /></span>
                    <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2"><span className="text-3xl font-bold tracking-[-0.06em] text-[#30262B] tabular-nums">{dueCount}</span><span className="text-xs text-[#6F5964]">{dueCount === 1 ? "card due" : "cards due"}</span></div>
                  <p className="mt-1 text-xs text-[#6F5964]">{dueCount > 0 ? "You have flashcards ready for review. Practice them to strengthen your recall." : totalCards > 0 ? "You’re all caught up! Come back when your next flashcards are ready." : "Create flashcards to begin your first review."}</p>
                    </div>
                </div>
                  <Link href={dueCount > 0 ? "/review/setup?reviewFilter=due" : "/subjects"} className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#F8769C] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#EC658D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC658D] focus-visible:ring-offset-2 sm:ml-auto sm:w-auto">{dueCount > 0 ? "Start Due Review" : totalCards > 0 ? "Review" : "Add Cards"}<Icon name="arrow" className="h-4 w-4" /></Link>
              </div>
            </section></ScrollReveal>

            <ScrollReveal className="min-w-0" delay={0.12}><section className="min-w-0 rounded-[18px] border border-[#E8DDE1] bg-white p-4 sm:p-5" aria-labelledby="study-streak-heading">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[#F8769C]"><span aria-hidden="true" className="text-xl">♨</span><h2 id="study-streak-heading" className="text-base font-semibold text-[#30262B]">Study Streak</h2></div>
                  <p className="mt-2 text-2xl font-bold tracking-[-0.05em] text-[#30262B]">{currentStreak} {currentStreak === 1 ? "day" : "days"}</p>
                  <p className="mt-1 text-xs text-[#6F5964]">{currentStreak > 0 ? "Keep showing up and build on your study routine." : "Complete a study activity to start building your streak."}</p>
                </div>
                <div className="relative h-[58px] w-[70px] shrink-0 overflow-hidden rounded-xl bg-[#FFF9FC] sm:h-[70px] sm:w-[82px]">
                  <Image src="/dashboard-hero/dashboard.png" alt="" fill sizes="82px" className="object-contain object-bottom" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Study activity for the last seven days">
                {lastSevenDays.map(({ completed, label }, index) => (
                  <div key={index} className="flex min-w-0 flex-col items-center gap-1.5">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${completed ? "border-[#F8769C] bg-[#F8769C] text-white" : "border-[#E8DDE1] bg-white text-transparent"}`} aria-label={completed ? "Studied" : "No study recorded"}>{completed ? "✓" : "·"}</span>
                    <span className="text-[9px] font-medium text-[#6F5964]">{label}</span>
                  </div>
                ))}
              </div>
            </section></ScrollReveal>
          </div>

          <section aria-labelledby="subjects-heading" className="rounded-[18px] border border-[#E8DDE1] bg-white p-4 sm:p-5">
            <ScrollReveal><SectionHeading icon="book" title="My Subjects" href="/subjects" /></ScrollReveal>
            {subjects.length === 0 ? <ScrollReveal><EmptySubjects /></ScrollReveal> : (
              <StaggerContainer as="ul" className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {shownSubjects.map((subject, index) => {
                  const subjectIcon = ["cards", "flask", "book", "leaf"][index % 4];
                  return <StaggerItem as="li" index={index} key={subject.id}>
                    <Link href={`/subjects/${subject.id}`} className="group block h-full rounded-xl border border-[#EAE6E8] bg-white p-3.5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#E8DDE1] hover:shadow-[0_6px_18px_rgba(47,41,48,0.045)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC658D]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFE8EF] text-[#F8769C]"><Icon name={subjectIcon} className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1"><span className="line-clamp-2 break-words text-xs font-semibold text-[#30262B]">{subject.name}</span><span className="mt-1 block text-[10px] text-[#6F5964]">{subject.flashcardCount} {subject.flashcardCount === 1 ? "flashcard" : "flashcards"}</span></span>
                        <Icon name="chevron" className="h-4 w-4 shrink-0 text-[#A0AFBA] transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-3"><MasteryProgressBar label="Mastery" ariaLabel={`${subject.name} mastery progress`} progress={subject.progress} /></div>
                    </Link>
                  </StaggerItem>;
                })}
              </StaggerContainer>
            )}
          </section>

          <ScrollReveal><FeaturedBadgesStream surface="dashboard" userId={userId} /></ScrollReveal>

          <section aria-labelledby="quick-actions-heading" className="rounded-[18px] border border-[#E8DDE1] bg-white p-4 sm:p-5">
            <ScrollReveal className="mb-4 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFE8EF] text-[#F8769C] text-xl" aria-hidden="true">ϟ</span><h2 id="quick-actions-heading" className="text-base font-semibold tracking-[-0.025em] text-[#30262B] sm:text-lg">Quick Actions</h2></ScrollReveal>
            <StaggerContainer className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StaggerItem index={0}><Link href="/subjects" className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-[#E8DDE1] bg-[#FFF9FC] p-3.5 transition-[border-color,background-color] hover:border-[#E8DDE1] hover:bg-[#FFF9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC658D]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8769C] text-white"><Icon name="plus" className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#30262B]">Add Subject</span><span className="mt-1 block text-[10px] leading-4 text-[#6F5964]">Create a new subject and start learning.</span></span><Icon name="chevron" className="h-4 w-4 shrink-0 text-[#F8769C]" />
              </Link></StaggerItem>
              <StaggerItem index={1}><Link href="/review" className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-[#E8DDE1] bg-[#FFF9FC] p-3.5 transition-[border-color,background-color] hover:border-[#E8DDE1] hover:bg-[#FFF9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC658D]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8769C] text-white"><Icon name="refresh" className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#30262B]">Start Review</span><span className="mt-1 block text-[10px] leading-4 text-[#6F5964]">Jump back into your pending cards.</span></span><Icon name="chevron" className="h-4 w-4 shrink-0 text-[#F8769C]" />
              </Link></StaggerItem>
              <StaggerItem index={2}><Link href="/progress" className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-[#E8DDE1] bg-[#FFF9FC] p-3.5 transition-[border-color,background-color] hover:border-[#E8DDE1] hover:bg-[#FFF9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC658D]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8769C] text-white"><Icon name="book" className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#30262B]">Progress</span><span className="mt-1 block text-[10px] leading-4 text-[#6F5964]">See how your study is coming along.</span></span><Icon name="chevron" className="h-4 w-4 shrink-0 text-[#F8769C]" />
              </Link></StaggerItem>
            </StaggerContainer>
          </section>
        </>
      )}
    </div>
  );
}
