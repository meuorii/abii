import Link from "next/link";
import { BookOpen, Flame, Layers3, Plus, Sparkles } from "lucide-react";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";
import { FeaturedBadgesStream } from "@/components/badges/featured-badges-stream";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";

type SubjectOverview = { id: string; name: string; flashcardCount: number; progress: number };
type DashboardOverviewProps = {
  firstName: string; studyTimezone: string; userId: string; dueCount: number; totalCards: number;
  overallMastery: { progress: number }; currentStreak: number;
  lastSevenDays: { label: string; completed: boolean }[]; subjects: SubjectOverview[]; loadFailed?: boolean;
};

const panel = "min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5";
const action = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2";

function Metric({ label, value, detail, icon: Icon, progress }: { label: string; value: string | number; detail: string; icon: typeof BookOpen; progress?: number }) {
  return <article className={`${panel} flex min-h-[108px] flex-col justify-between gap-2 sm:min-h-[112px]`}>
    <div className="flex min-w-0 items-center justify-between gap-2"><h2 className="truncate text-xs font-semibold text-muted">{label}</h2><Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /></div>
    <div className="flex min-w-0 items-end justify-between gap-3"><span className="text-2xl font-bold leading-none tracking-[-.04em] text-foreground tabular-nums">{value}</span><span className="text-right text-[10px] leading-4 text-muted">{detail}</span></div>
    {progress !== undefined && <div role="progressbar" aria-label="Overall mastery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 overflow-hidden rounded-full bg-secondary-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>}
  </article>;
}

function Heading({ title, href, label, id }: { title: string; href?: string; label?: string; id?: string }) {
  return <div className="mb-4 flex min-h-9 items-center justify-between gap-3"><h2 id={id} className="text-base font-semibold tracking-[-.025em] text-foreground sm:text-lg">{title}</h2>{href && <Link href={href} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">{label ?? "View all"} <span aria-hidden="true">→</span></Link>}</div>;
}

export function DashboardOverview({ firstName, studyTimezone, userId, dueCount, totalCards, overallMastery, currentStreak, lastSevenDays, subjects, loadFailed = false }: DashboardOverviewProps) {
  const shownSubjects = subjects.slice(0, 4);
  return <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-4 pb-24 sm:space-y-6 sm:px-6 sm:py-6 lg:px-6 lg:py-5 lg:pb-8">
    <AbiiPageHero variant="dashboard" headingId="dashboard-hero-title" eyebrow={<DashboardGreeting firstName={firstName} studyTimezone={studyTimezone} />} title={<h1 className="abii-hero-heading max-w-[490px]">What should you <span className="abii-hero-emphasis">study</span> today?</h1>} description={<p className="max-w-[520px]">Choose a subject to continue learning, or review what’s due today.</p>} mascotSrc="/dashboard-hero/dashboard.png" mascotAlt="Abii the pink otter waving hello" priority />

    {loadFailed ? <section role="alert" className={`${panel} p-5 sm:p-7`}><p className="text-sm font-semibold text-error-text">Your study data couldn’t load</p><p className="mt-1 text-sm leading-6 text-muted">Please refresh the page and try again. Your study data hasn’t been changed.</p><Link href="/dashboard" className={`${action} mt-4 bg-primary text-primary-foreground hover:bg-primary-hover`}>Try again</Link></section> : <>
      <section aria-label="Study statistics"><StaggerContainer className="grid grid-cols-2 items-stretch gap-3 xl:grid-cols-4 xl:gap-4">
        <StaggerItem index={0}><Metric label="My Subjects" value={subjects.length} detail="in your library" icon={BookOpen} /></StaggerItem>
        <StaggerItem index={1}><Metric label="Total Flashcards" value={totalCards} detail="ready to learn" icon={Layers3} /></StaggerItem>
        <StaggerItem index={2}><Metric label="Overall Mastery" value={`${overallMastery.progress}%`} detail="across your library" icon={Sparkles} progress={overallMastery.progress} /></StaggerItem>
        <StaggerItem index={3}><Metric label="Study Streak" value={currentStreak} detail={currentStreak === 1 ? "consecutive day" : "consecutive days"} icon={Flame} /></StaggerItem>
      </StaggerContainer></section>

      <div className="grid items-stretch gap-4 xl:grid-cols-12">
        <ScrollReveal className="min-w-0 xl:col-span-8"><section className={`${panel} h-full`} aria-labelledby="today-review-heading">
          <Heading id="today-review-heading" title="Today’s Review" />
          <div className="flex min-h-[140px] flex-col justify-between gap-4 rounded-xl border border-border bg-background p-4 sm:min-h-[130px] sm:flex-row sm:items-center sm:p-5">
            <div className="min-w-0"><div className="flex items-baseline gap-2"><span className="text-3xl font-bold tracking-[-.06em] text-foreground tabular-nums">{dueCount}</span><span className="text-xs text-muted">{dueCount === 1 ? "card due" : "cards due"}</span></div>
              <p className="mt-1 max-w-xl text-xs leading-5 text-muted">{dueCount > 0 ? "Practice these flashcards to strengthen your recall." : totalCards > 0 ? "You’re all caught up. Come back when your next flashcards are ready." : "Create a subject and flashcards to begin your first review."}</p></div>
            <div className="flex shrink-0 flex-col gap-2 min-[430px]:flex-row">{dueCount > 0 && <Link href="/review/setup?reviewFilter=due" className={`${action} bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active`}>Start Due Review <span aria-hidden="true">→</span></Link>}
              {totalCards > 0 ? <Link href="/review/setup" className={`${action} border border-border bg-surface text-primary hover:bg-secondary-surface`}>Custom Review</Link> : <Link href="/subjects" className={`${action} bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active`}><Plus className="h-4 w-4" />Add Study Materials</Link>}</div>
          </div>
        </section></ScrollReveal>
        <ScrollReveal className="min-w-0 xl:col-span-4" delay={0.12}><section className={`${panel} h-full`} aria-labelledby="weekly-activity-heading">
          <Heading id="weekly-activity-heading" title="Weekly Activity" />
          <div className="flex min-h-[140px] items-center sm:min-h-[130px]"><div className="grid w-full grid-cols-7 gap-1.5" aria-label="Study activity for the last seven days">{lastSevenDays.map(({ completed, label }, index) => <div key={`${label}-${index}`} className="flex min-w-0 flex-col items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] ${completed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-transparent"}`} aria-label={completed ? "Studied" : "No study recorded"}>{completed ? "✓" : "·"}</span><span className="text-[10px] font-medium text-muted">{label}</span></div>)}</div></div>
        </section></ScrollReveal>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-12">
        <section aria-labelledby="subjects-heading" className={`${panel} xl:col-span-8`}><Heading id="subjects-heading" title="My Subjects" href="/subjects" label="View all" />
          {subjects.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-background px-5 py-7 text-center"><BookOpen aria-hidden="true" className="mx-auto h-8 w-8 text-primary"/><h3 className="mt-3 text-sm font-semibold text-foreground">Your study library starts here</h3><p className="mt-1.5 text-xs leading-5 text-muted">Add a subject, then create flashcards for the topics you want to remember.</p><Link href="/subjects" className={`${action} mt-4 bg-primary text-primary-foreground hover:bg-primary-hover`}><Plus className="h-4 w-4"/>Add Subject</Link></div> : <StaggerContainer as="ul" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">{shownSubjects.map((subject, index) => <StaggerItem as="li" index={index} key={subject.id}><Link href={`/subjects/${subject.id}`} className="block h-full min-w-0 rounded-xl border border-border p-3.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"><span className="block break-words text-xs font-semibold text-foreground">{subject.name}</span><span className="mt-1 block text-[10px] text-muted">{subject.flashcardCount} {subject.flashcardCount === 1 ? "flashcard" : "flashcards"}</span><div className="mt-3"><MasteryProgressBar label="Mastery" ariaLabel={`${subject.name} mastery progress`} progress={subject.progress}/></div></Link></StaggerItem>)}</StaggerContainer>}</section>
        <ScrollReveal className="min-w-0 xl:col-span-4"><FeaturedBadgesStream surface="dashboard" userId={userId} /></ScrollReveal>
      </div>
    </>}
  </div>;
}
