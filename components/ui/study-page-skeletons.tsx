import Image from "next/image";
import { SkeletonBlock, SkeletonCard } from "@/components/ui/skeleton";
import { UnknownCollectionPlaceholder } from "@/components/ui/skeleton-collection";
import { QUIZ_MODES } from "@/lib/quiz/types";
import { getLearnerHeroMascotFrame } from "@/components/ui/abii-page-hero";

function HeroMascotSkeleton({ src = "/dashboard-hero/my-subjects.png" }: { src?: string }) {
  const frame = getLearnerHeroMascotFrame(src);
  return <div className="pointer-events-none absolute inset-y-0 left-[60%] right-3 flex items-end justify-end sm:right-6 lg:right-8"><div className="relative h-[88%] w-auto max-w-full overflow-hidden sm:h-[90%] sm:max-w-none" style={{ aspectRatio: frame.aspectRatio }}><Image src={src} alt="" width={frame.width} height={frame.height} sizes="(max-width: 639px) 40vw, 420px" className={`absolute max-w-none ${frame.fit === "contain" ? "object-contain object-bottom" : "object-cover object-bottom"}`} style={frame.imageStyle} /></div></div>;
}

function Bar({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`rounded-lg ${className}`} />;
}

function Panel({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <SkeletonCard className={className}>{children}</SkeletonCard>;
}

function StudyHero({ kind = "detail" }: { kind?: "detail" | "folder" | "topic" }) {
  return <section data-skeleton-section="hero" aria-hidden="true" className="relative isolate grid min-h-[180px] grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch overflow-hidden rounded-2xl border border-border bg-secondary-surface sm:min-h-[240px] sm:rounded-[20px] lg:min-h-[280px]">
    <div className="relative z-10 flex min-w-0 flex-col justify-center py-4 pl-4 pr-7 sm:py-6 sm:pl-6 sm:pr-8 lg:py-8 lg:pl-8">
      {kind !== "detail" && <Bar className="h-3 w-24" />}
      <Bar className="h-7 w-4/5 max-w-[300px] bg-border sm:h-9" />
      <Bar className="h-3 w-full max-w-[360px]" />
      {kind === "detail" && <Bar className="h-3 w-2/3 max-w-[240px]" />}
    </div>
    <HeroMascotSkeleton />
  </section>;
}

function Breadcrumb({ count = 3 }: { count?: number }) {
  return <div aria-hidden="true" data-skeleton-section="breadcrumb" className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs sm:gap-2 sm:text-sm">
    {Array.from({ length: count }, (_, index) => <span key={index} className="flex min-w-0 items-center gap-1.5 sm:gap-2">{index > 0 && <Bar className="h-4 w-4 shrink-0 rounded-full" />}<Bar className={`h-3 ${index === count - 1 ? "w-24 max-w-[28vw]" : "w-20 max-w-[32vw]"}`} /></span>)}
  </div>;
}

export function SubjectDetailSkeleton() {
  return <div className="min-w-0 space-y-3 sm:space-y-4">
    <Breadcrumb count={2} />
    <StudyHero />
    <section data-skeleton-section="overview" aria-hidden="true" className="rounded-2xl border border-border bg-surface p-4"><Bar className="h-3 w-40" /><Bar className="mt-3 h-2 w-full max-w-[320px] rounded-full" /><div className="mt-3 flex gap-2"><Bar className="h-6 w-20 rounded-full" /><Bar className="h-6 w-20 rounded-full" /></div></section>
    <div data-skeleton-section="tabs" aria-hidden="true" className="flex min-w-0 gap-1 overflow-hidden border-b border-border">{[0, 1, 2, 3].map((tab) => <Bar key={tab} className="h-11 w-24 shrink-0 rounded-none" />)}</div>
    <section data-skeleton-section="topic-folders" aria-hidden="true" className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-2"><Bar className="h-5 w-28" /><Bar className="h-4 w-72 max-w-[80vw]" /></div><div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Bar className="h-11 w-full rounded-xl sm:w-32" /><Bar className="h-11 w-full rounded-xl sm:w-32" /></div></div>
      <Bar className="h-11 w-full max-w-xl rounded-xl" />
      <UnknownCollectionPlaceholder className="rounded-2xl border border-border bg-surface p-4 sm:p-5" />
    </section>
    <section data-skeleton-section="topics" aria-hidden="true" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Panel className="min-h-[168px] border-dashed"><Bar className="h-10 w-10 rounded-xl" /><Bar className="mt-4 h-4 w-3/5" /><Bar className="mt-3 h-3 w-1/2" /><Bar className="mt-4 h-4 w-28" /></Panel>
      <div className="hidden sm:block"><UnknownCollectionPlaceholder className="min-h-[168px] rounded-2xl border border-border bg-surface p-4" /></div>
    </section>
  </div>;
}

export function SubjectFolderDetailSkeleton() {
  return <div className="min-w-0 space-y-5">
    <Breadcrumb count={2} />
    <StudyHero kind="folder" />
    <section data-skeleton-section="subject-controls" aria-hidden="true" className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-2"><Bar className="h-5 w-32" /><Bar className="h-4 w-72 max-w-[80vw]" /></div><div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Bar className="h-11 w-full rounded-xl sm:w-32" /><Bar className="h-11 w-full rounded-xl sm:w-32" /></div></div>
      <Bar className="h-11 w-full max-w-xl rounded-xl" />
      <div className="flex justify-end gap-2"><Bar className="h-9 w-9 rounded-lg" /><Bar className="h-9 w-9 rounded-lg" /></div>
    </section>
    <section data-skeleton-section="subjects" aria-hidden="true"><UnknownCollectionPlaceholder className="min-h-32 rounded-2xl border border-border bg-surface p-4 sm:p-5" /></section>
  </div>;
}

export function TopicFolderDetailSkeleton() {
  return <div className="min-w-0 space-y-4">
    <Breadcrumb count={3} />
    <StudyHero kind="topic" />
    <section data-skeleton-section="topic-actions" aria-hidden="true" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 space-y-2"><Bar className="h-5 w-28" /><Bar className="h-4 w-72 max-w-[80vw]" /></div><Bar className="h-11 w-36 rounded-xl" /></div>
      <Bar className="h-11 w-full rounded-xl" />
    </section>
    <section data-skeleton-section="topics" aria-hidden="true"><UnknownCollectionPlaceholder className="min-h-32 rounded-2xl border border-border bg-surface p-4 sm:p-5" /></section>
  </div>;
}

export function TopicDetailSkeleton() {
  return <div className="min-w-0 space-y-5">
    <Breadcrumb count={3} />
    <StudyHero kind="topic" />
    <section data-skeleton-section="mastery" aria-hidden="true" className="rounded-2xl border border-border bg-surface p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><Bar className="h-3 w-full rounded-full" /><div className="mt-2 flex justify-between"><Bar className="h-3 w-20" /><Bar className="h-3 w-10" /></div></div><div className="space-y-2 sm:min-w-44"><Bar className="h-3 w-36 max-w-full" /><Bar className="h-3 w-40 max-w-full" /></div></div><div className="mt-3 flex flex-wrap gap-1">{[0, 1, 2, 3].map((item) => <Bar key={item} className="h-6 w-16 rounded-full" />)}</div></section>
    <section data-skeleton-section="flashcard-controls" aria-hidden="true" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-2"><Bar className="h-5 w-32" /><Bar className="h-4 w-60 max-w-[70vw]" /></div><Bar className="h-11 w-36 rounded-xl" /></div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_190px]"><Bar className="h-11 w-full rounded-xl" /><Bar className="h-11 w-full rounded-xl" /></div>
    </section>
    <section data-skeleton-section="flashcards" aria-hidden="true"><UnknownCollectionPlaceholder className="min-h-32 rounded-2xl border border-border bg-surface p-4 sm:p-5" /></section>
    <section data-skeleton-section="review-actions" aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4"><div className="min-w-0 space-y-2"><Bar className="h-4 w-32" /><Bar className="h-4 w-64 max-w-[70vw]" /></div><div className="flex flex-wrap gap-2"><Bar className="h-10 w-36 rounded-xl" /><Bar className="h-10 w-32 rounded-xl" /></div></section>
  </div>;
}

export function ReviewSetupSkeleton() {
  return <div className="min-w-0 space-y-5">
    <div data-skeleton-section="breadcrumb" aria-hidden="true" className="flex items-center gap-2 text-xs sm:text-sm"><Bar className="h-3 w-16" /><Bar className="h-4 w-4 rounded-full" /><Bar className="h-3 w-24" /></div>
    <StudyHero kind="topic" />
    <section data-skeleton-section="review-filter" aria-hidden="true" className="rounded-2xl border border-border bg-surface p-4 sm:p-5"><Bar className="h-5 w-64 max-w-full" /><div className="mt-3 grid gap-2 sm:grid-cols-2">{[0, 1].map((filter) => <div key={filter} data-skeleton-filter className="flex min-h-[76px] items-start gap-3 rounded-xl border border-border p-3"><Bar className="mt-0.5 h-4 w-4 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Bar className="h-4 w-40 max-w-full" /><Bar className="h-3 w-full" /><Bar className="h-3 w-2/3" /></div></div>)}</div></section>
    <section data-skeleton-section="scope" aria-hidden="true" className="space-y-3"><Bar className="h-5 w-48" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[0, 1, 2].map((scope) => <div key={scope} data-skeleton-scope className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-3.5"><Bar className="h-10 w-10 shrink-0 rounded-full" /><Bar className="h-4 w-3/4" /></div>)}</div><UnknownCollectionPlaceholder className="rounded-xl border border-border bg-surface px-4" /></section>
    <section data-skeleton-section="quiz-modes" aria-hidden="true"><Bar className="h-5 w-48" /><div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{QUIZ_MODES.map((mode) => <Panel key={mode} className="min-h-[132px]"><div className="flex w-full items-center justify-between"><Bar className="h-11 w-11 rounded-full" /><Bar className="h-6 w-20 rounded-full" /></div><Bar className="mt-2 h-4 w-36 max-w-full" /><Bar className="mt-2 h-3 w-full" /><Bar className="h-3 w-4/5" /></Panel>)}</div></section>
    <section data-skeleton-section="summary" aria-hidden="true" className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-32" /><Bar className="h-3 w-full max-w-[480px]" /><Bar className="h-3 w-3/4 max-w-[360px]" /></div><Bar className="h-12 w-40 shrink-0 rounded-full" /></section>
  </div>;
}

function SessionProgressSkeleton() {
  return <section data-skeleton-section="review-progress" aria-hidden="true" className="order-3 min-w-0 lg:order-none lg:col-start-2 lg:row-start-1"><Panel className="min-h-[260px]"><Bar className="h-4 w-32" /><div className="mt-4 flex items-center gap-4 lg:flex-col lg:items-stretch xl:flex-row"><Bar className="h-[84px] w-[84px] shrink-0 rounded-full bg-secondary-surface" /><div className="min-w-0 flex-1 space-y-3">{[0, 1, 2, 3].map((row) => <div key={row} className="flex justify-between gap-3"><Bar className="h-3 w-24" /><Bar className="h-3 w-8" /></div>)}</div></div><div className="mt-4 flex items-center gap-3 rounded-xl bg-background p-3"><Bar className="h-12 w-12 shrink-0 rounded-full bg-secondary-surface" /><Bar className="h-3 w-3/4" /></div></Panel></section>;
}

export function QuizSessionSkeleton() {
  return <div className="min-w-0 space-y-4">
    <div data-skeleton-section="session-nav" aria-hidden="true" className="flex min-h-9 min-w-0 items-center gap-2"><Bar className="h-3 w-16 shrink-0" /><Bar className="h-4 w-4 shrink-0 rounded-full" /><Bar className="h-3 w-28 max-w-[30vw]" /><Bar className="ml-auto h-9 w-24 shrink-0 rounded-full" /></div>
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_290px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <section data-skeleton-section="session-hero" aria-hidden="true" className="relative isolate order-1 grid min-h-[180px] grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch overflow-hidden rounded-2xl border border-border bg-secondary-surface sm:min-h-[240px] sm:rounded-[20px] lg:min-h-[280px] lg:row-start-1"><div className="relative z-10 flex min-w-0 flex-col justify-center py-4 pl-4 pr-7 sm:py-6 sm:pl-6 sm:pr-8 lg:py-8 lg:pl-8"><Bar className="h-3 w-28"/><Bar className="h-7 w-4/5 max-w-[260px] bg-border sm:h-9"/><Bar className="h-3 w-full max-w-[220px]"/></div><HeroMascotSkeleton /></section>
      <SessionProgressSkeleton />
      <section data-skeleton-section="question" aria-hidden="true" className="order-2 min-w-0 lg:order-none lg:col-start-1 lg:row-start-2"><Panel className="min-h-[390px] sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><Bar className="h-4 w-28" /><Bar className="h-5 w-24 rounded-full" /><Bar className="h-4 w-20 rounded-full" /></div>
        <Bar className="mt-7 h-6 w-4/5" /><Bar className="mt-3 h-6 w-2/3" />
        <div aria-hidden="true" className="mt-7 min-h-[128px] rounded-2xl border border-border bg-background p-4"><UnknownCollectionPlaceholder className="h-full" /></div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-3"><Bar className="h-4 w-24" /><Bar className="h-4 w-36 max-w-full" /></div>
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><Bar className="h-10 w-28 rounded-full" /><Bar className="h-11 w-36 rounded-full" /></div>
      </Panel></section>
      <section data-skeleton-section="next-up" aria-hidden="true" className="hidden min-w-0 lg:col-start-2 lg:row-start-2 lg:block"><Panel className="min-h-[180px]"><Bar className="h-4 w-20" /><UnknownCollectionPlaceholder className="mt-2" /></Panel></section>
    </div>
  </div>;
}

const finishGridClass = "grid min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] [&>*]:min-w-0";

function CompletionHero() {
  return <section data-skeleton-section="completion-hero" aria-hidden="true" className="relative isolate grid min-h-[180px] grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch overflow-hidden rounded-2xl border border-border bg-secondary-surface sm:min-h-[240px] sm:rounded-[20px] lg:min-h-[280px]"><div className="relative z-10 flex min-w-0 flex-col justify-center py-4 pl-4 pr-7 sm:py-6 sm:pl-6 sm:pr-8 lg:py-8 lg:pl-8"><Bar className="h-7 w-4/5 max-w-[340px] bg-border sm:h-10"/><Bar className="h-3 w-full max-w-[360px]"/><Bar className="h-3 w-2/3 max-w-[280px]"/></div><HeroMascotSkeleton src="/dashboard-hero/complete.png" /></section>;
}

function ResultPanel() {
  return <section data-skeleton-section="results" aria-hidden="true"><Panel className="rounded-[18px] border-border p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><Bar className="h-5 w-44 max-w-[65%]" /><Bar className="h-7 w-24 rounded-full" /></div><div className="mt-3 grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-[minmax(180px,.8fr)_1.2fr] sm:items-center sm:p-5"><div className="flex min-w-0 flex-col items-center"><Bar className="mb-2 h-4 w-full" /><div className="grid h-[176px] w-[176px] max-w-full place-items-center rounded-full bg-surface p-3"><Bar className="h-full w-full rounded-full" /></div></div><div className="min-w-0 space-y-3"><Bar className="h-3 w-full" /><Bar className="h-3 w-4/5" /><div className="grid grid-cols-2 gap-2.5"><Bar className="h-[76px] rounded-2xl" /><Bar className="h-[76px] rounded-2xl" /></div><div className="grid grid-cols-3 gap-2"><Bar className="h-14 rounded-xl" /><Bar className="h-14 rounded-xl" /><Bar className="h-14 rounded-xl" /></div></div></div></Panel></section>;
}

export function QuizCompletionSkeleton({ knownQuestionCount = 0 }: { knownQuestionCount?: number }) {
  const recentCount = Math.min(5, Math.max(0, Math.floor(knownQuestionCount)));
  return <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-3">
    <div className="flex min-h-10 items-center px-2"><Bar className="h-3 w-28" /></div>
    <CompletionHero />
    <div className={finishGridClass}>
      <ResultPanel />
      <section data-skeleton-section="performance" aria-hidden="true"><Panel className="rounded-[18px] border-border p-4 sm:p-5"><Bar className="h-5 w-56 max-w-full" /><div className="mt-3 space-y-2">{[0, 1, 2, 3].map((row) => <div key={row} className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-border px-3 py-2"><Bar className="h-9 w-9 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-3/4" /><Bar className="h-2 w-full rounded-full" /></div><Bar className="h-3 w-10 shrink-0" /></div>)}</div></Panel></section>
    </div>
    <div className={finishGridClass}>
      <section data-skeleton-section="recent-questions" aria-hidden="true"><Panel className="rounded-[18px] border-border p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><Bar className="h-5 w-44 max-w-[60%]" /><Bar className="h-4 w-28 shrink-0" /></div>{recentCount > 0 ? <div className="mt-5 divide-y divide-border rounded-xl border border-border px-3">{Array.from({ length: recentCount }, (_, row) => <div key={row} className="flex min-h-[52px] min-w-0 items-center gap-2 py-2.5"><Bar className="h-7 w-7 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-4/5" /><Bar className="h-2.5 w-1/2" /></div><Bar className="h-6 w-[62px] shrink-0 rounded-full" /><Bar className="h-4 w-4 shrink-0 rounded-full" /></div>)}</div> : <UnknownCollectionPlaceholder className="mt-2" />}</Panel></section>
      <section data-skeleton-section="next-actions" aria-hidden="true"><Panel className="rounded-[18px] border-border p-4 sm:p-5"><Bar className="h-5 w-36" /><div className="mt-3 space-y-2">{[0, 1, 2].map((row) => <div key={row} className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-background px-3.5 py-3"><Bar className="h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-3/4" /><Bar className="h-2.5 w-full" /></div><Bar className="h-4 w-4 shrink-0 rounded-full" /></div>)}<Bar className="mx-auto h-4 w-28" /></div></Panel></section>
    </div>
  </div>;
}
