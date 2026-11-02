"use client";

import Image from "next/image";


export type PageLoadingVariant =
  | "dashboard"
  | "subjects"
  | "subject-detail"
  | "folder-detail"
  | "subject-folder-detail"
  | "topic-detail"
  | "review"
  | "quiz-setup"
  | "quiz"
  | "finish"
  | "progress"
  | "settings";

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-lg bg-[#F4E9ED] ${className}`} />;
}

function CardSkeleton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div aria-hidden="true" className={`rounded-2xl border border-[#F0E5E9] bg-white p-4 sm:p-5 ${className}`}>{children}</div>;
}

function Hero({ variant = "wide" }: { variant?: "wide" | "compact" }) {
  return (
    <div aria-hidden="true" className={`relative grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-2 overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF4F7] pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:block sm:p-7 ${variant === "wide" ? "min-h-[180px] sm:min-h-[250px]" : "sm:min-h-[170px]"}`}>
      <div className="relative z-10 min-w-0 max-w-full space-y-3 py-3 sm:max-w-[58%] sm:py-0">
        <Bar className="h-3 w-24 bg-[#F2DCE4]" />
        <Bar className="h-6 w-full max-w-[300px] bg-[#EED7E0] sm:h-9" />
        <Bar className="h-3 w-full max-w-[260px]" />
        <Bar className="h-3 w-4/5 max-w-[220px]" />
        {variant === "wide" && <Bar className="mt-4 h-10 w-32 rounded-full bg-[#F3D4DF]" />}
      </div>
      <div className="pointer-events-none relative col-start-2 row-start-1 min-h-[154px] min-w-0 min-[360px]:min-h-[158px] sm:absolute sm:inset-y-0 sm:right-0 sm:w-[42%]">
        <div className="absolute bottom-0 right-[5%] h-[76%] w-[85%] rounded-t-[48%] rounded-b-3xl bg-[#FFE6EE] sm:-bottom-8 sm:right-3 sm:h-36 sm:w-32" />
        <div className="absolute bottom-[43%] right-[28%] h-16 w-16 rounded-full bg-[#F7D5E0] sm:bottom-9 sm:right-16 sm:h-28 sm:w-28" />
      </div>
    </div>
  );
}

function MetricCards({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${count === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} className="min-h-[104px]">
          <Bar className="h-3 w-20" />
          <Bar className="mt-4 h-7 w-16" />
          <Bar className="mt-2 h-2.5 w-24" />
        </CardSkeleton>
      ))}
    </div>
  );
}

function FeaturedBadgesSkeleton() {
  return <CardSkeleton className="min-h-[150px] sm:min-h-[168px]">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><Bar className="h-9 w-9 rounded-xl bg-[#F8DCE5]"/><div><Bar className="h-4 w-36"/><Bar className="mt-2 h-3 w-52 max-w-full"/></div></div><Bar className="h-10 w-28 rounded-xl"/></div>
    <div className="mt-4 grid grid-cols-1 gap-2.5 min-[390px]:grid-cols-2 xl:grid-cols-3">{[0,1,2].map((item)=><div key={item} className="flex min-h-[88px] items-center gap-3 rounded-xl border border-[#F0E6EA] bg-[#FFFCFD] p-3"><Bar className="h-14 w-14 shrink-0 rounded-full bg-[#F8DCE5]"/><div className="min-w-0 flex-1"><Bar className="h-3 w-3/4"/><Bar className="mt-2 h-3 w-20"/><Bar className="mt-2 h-2.5 w-24"/></div></div>)}</div>
  </CardSkeleton>;
}

function SubjectCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <CardSkeleton key={index} className="min-h-[165px]">
          <div className="flex items-center gap-3">
            <Bar className="h-11 w-11 shrink-0 rounded-xl bg-[#F8DCE5]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bar className="h-4 w-3/4" />
              <Bar className="h-3 w-1/2" />
            </div>
          </div>
          <Bar className="mt-5 h-2.5 w-full rounded-full" />
          <div className="mt-4 flex gap-2">
            <Bar className="h-7 w-7 rounded-lg" />
            <Bar className="h-7 w-7 rounded-lg" />
            <Bar className="h-7 w-7 rounded-lg" />
            <Bar className="h-7 w-7 rounded-lg" />
          </div>
        </CardSkeleton>
      ))}
    </div>
  );
}

function QuizSessionHeroSkeleton({ className = "" }: { className?: string }) {
  return <section aria-hidden="true" className={`relative isolate grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-2 overflow-hidden rounded-[1.4rem] border border-[#F5DDE5] bg-[#FFF1F5] pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:flex sm:min-h-[210px] sm:items-center sm:gap-0 sm:px-0 sm:py-0 ${className}`}>
    <div className="relative z-10 flex min-w-0 flex-col justify-center gap-2 py-3 sm:max-w-[59%] sm:gap-0 sm:px-7 sm:py-6">
      <div className="flex min-w-0 items-center gap-3">
        <Bar className="h-10 w-10 shrink-0 rounded-xl bg-[#FFE0E9] sm:h-11 sm:w-11" />
        <div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-4/5 sm:h-5" /><Bar className="h-3 w-3/4" /></div>
      </div>
      <div className="flex w-full max-w-[220px] items-center gap-2 sm:mt-2"><Bar className="h-1.5 min-w-0 flex-1 rounded-full" /><Bar className="h-3 w-8 shrink-0" /></div>
      <Bar className="h-6 w-3/4 max-w-[230px] bg-[#EED7E0] sm:mt-2 sm:h-8" />
      <div className="space-y-1 sm:mt-1"><Bar className="h-3 w-full max-w-[230px]" /><Bar className="h-3 w-4/5 max-w-[190px]" /></div>
    </div>
    <div aria-hidden="true" className="pointer-events-none relative col-start-2 row-start-1 flex min-h-[154px] min-w-0 items-end justify-center min-[360px]:min-h-[158px] sm:absolute sm:inset-y-0 sm:right-0 sm:min-h-0 sm:w-[38%] lg:w-[37%]">
      <Bar className="absolute bottom-0 right-[6%] h-[72%] w-[84%] rounded-t-[48%] rounded-b-3xl bg-[#FFE6EE]" />
      <Bar className="absolute bottom-[44%] right-[26%] h-[46%] w-[54%] rounded-full bg-[#F7D5E0]" />
      <Bar className="absolute bottom-[72%] right-[64%] h-5 w-5 rounded-full bg-[#F7D5E0]" />
      <Bar className="absolute bottom-[72%] right-[15%] h-5 w-5 rounded-full bg-[#F7D5E0]" />
    </div>
  </section>;
}

function SettingsSections() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
      <div className="space-y-4">
        {[0, 1, 2].map((item) => (
          <CardSkeleton key={item}>
            <Bar className="h-4 w-40" />
            <Bar className="mt-2 h-3 w-64 max-w-full" />
            <div className="mt-5 space-y-3">
              <Bar className="h-10 w-full rounded-xl" />
              <Bar className="h-10 w-full rounded-xl" />
            </div>
          </CardSkeleton>
        ))}
      </div>
      <div className="space-y-4">
        {[0, 1].map((item) => (
          <CardSkeleton key={item}>
            <Bar className="h-4 w-36" />
            <Bar className="mt-2 h-3 w-56 max-w-full" />
            <Bar className="mt-5 h-24 w-full rounded-xl" />
            <Bar className="mt-4 h-10 w-32 rounded-full" />
          </CardSkeleton>
        ))}
      </div>
    </div>
  );
}

const finishGridClass = "grid min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] [&>*]:min-w-0";

function FinishHero() {
  return (
    <section aria-hidden="true" className="relative isolate grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-2 overflow-hidden rounded-[24px] border border-[#F8E5EC] bg-[#FFF2F6] pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:block sm:min-h-[250px] sm:px-8 sm:py-8 lg:min-h-[280px] lg:px-10">
      <div className="relative z-10 min-w-0 max-w-full space-y-3 sm:max-w-[62%] lg:max-w-[58%]">
        <Bar className="h-7 w-full max-w-[410px] rounded-md bg-[#EED7E0] sm:h-10 lg:h-12" />
        <Bar className="h-7 w-3/4 max-w-[300px] rounded-md bg-[#EED7E0] sm:h-10 lg:h-12" />
        <div className="space-y-2 pt-1 sm:pt-2"><Bar className="h-3 w-full max-w-[420px]" /><Bar className="h-3 w-4/5 max-w-[350px]" /></div>
        <Bar className="h-3 w-2/3 max-w-[280px]" />
      </div>
      <div className="pointer-events-none relative col-start-2 row-start-1 min-h-[154px] min-w-0 min-[360px]:min-h-[158px] sm:absolute sm:-bottom-1 sm:right-5 sm:h-[85%] sm:w-[40%] lg:right-10 lg:w-[37%]">
        <Bar className="absolute bottom-0 right-[8%] h-[72%] w-[78%] rounded-t-[48%] rounded-b-[2rem] bg-[#FFE6EE] sm:h-[78%]" />
        <Bar className="absolute bottom-[43%] right-[22%] h-[55%] w-[55%] rounded-full bg-[#F7D5E0] sm:bottom-[42%]" />
        <Bar className="absolute bottom-[26%] right-[64%] h-5 w-5 rounded-full bg-[#F7D5E0] sm:h-8 sm:w-8" />
        <Bar className="absolute bottom-[26%] right-[10%] h-5 w-5 rounded-full bg-[#F7D5E0] sm:h-8 sm:w-8" />
      </div>
    </section>
  );
}

function FinishResults() {
  return (
    <div className={finishGridClass}>
      <CardSkeleton className="rounded-[18px] border-[#E8E2E5] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2"><Bar className="h-5 w-44 max-w-[65%]" /><Bar className="h-7 w-24 rounded-full" /></div>
        <div className="mt-3 grid gap-4 rounded-2xl border border-[#EAEFF3] p-4 sm:grid-cols-[minmax(180px,.8fr)_1.2fr] sm:items-center sm:p-5">
          <div className="flex min-w-0 flex-col items-center"><Bar className="mb-2 h-4 w-full" /><div className="relative grid h-[176px] w-[176px] max-w-full shrink-0 place-items-center rounded-full bg-[#F4E9ED] p-3 motion-safe:animate-pulse"><div className="grid h-full w-full place-content-center rounded-full bg-white"><Bar className="h-8 w-20" /><Bar className="mt-3 h-3 w-28 max-w-full" /></div></div></div>
          <div className="min-w-0">
            <Bar className="h-3 w-full" /><Bar className="mt-2 h-3 w-4/5" />
            <div className="mt-4 grid grid-cols-2 gap-2.5">{[0, 1].map((item) => <div key={item} className={`rounded-2xl border p-3 ${item === 0 ? "border-[#DDF2E7] bg-[#F6FCF8]" : "border-[#F8DCE4] bg-[#FFF8FA]"}`}><div className="flex items-center gap-2"><Bar className="h-8 w-8 shrink-0 rounded-full" /><Bar className="h-7 w-12" /></div><Bar className="mt-2 h-2.5 w-24 max-w-full" /></div>)}</div>
            <div className="mt-3 grid grid-cols-3 gap-2">{[0, 1, 2].map((item) => <div key={item} className="rounded-xl bg-[#FAF8F9] px-2 py-2"><Bar className="mx-auto h-4 w-10" /><Bar className="mx-auto mt-2 h-2 w-full" /></div>)}</div>
          </div>
        </div>
      </CardSkeleton>

      <CardSkeleton className="rounded-[18px] border-[#E8E2E5] p-4 sm:p-5">
        <Bar className="h-5 w-56 max-w-full" />
        <div className="mt-3 space-y-2">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="flex min-h-[58px] min-w-0 items-center gap-2 rounded-2xl border border-[#EAEFF3] px-2.5 py-2 sm:gap-3 sm:px-3"><Bar className="h-9 w-9 shrink-0 rounded-full bg-[#F8DCE5]" /><div className="min-w-0 flex-1"><Bar className="h-3 w-3/4 max-w-[150px]" /><Bar className="mt-2 h-2 w-full rounded-full" /></div><Bar className="h-3 w-8 shrink-0" /><Bar className="h-3 w-8 shrink-0" /><Bar className="h-4 w-4 shrink-0 rounded-full" /></div>)}</div>
      </CardSkeleton>
    </div>
  );
}

function RecentQuestions() {
  return (
    <CardSkeleton className="rounded-[18px] border-[#E8E2E5] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><Bar className="h-5 w-44 max-w-[60%]" /><Bar className="h-4 w-28 shrink-0" /></div>
      <div className="mt-5 divide-y divide-[#F0EAED] rounded-xl border border-[#F0EAED] px-3">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="flex min-h-[52px] min-w-0 items-center gap-2 py-2.5"><Bar className="h-7 w-7 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-4/5" /><Bar className="h-2.5 w-1/2" /></div><Bar className="h-6 w-[62px] shrink-0 rounded-full" /><Bar className="h-4 w-4 shrink-0 rounded-full" /></div>)}</div>
    </CardSkeleton>
  );
}

function NextActions() {
  return (
    <CardSkeleton className="rounded-[18px] border-[#E8E2E5] p-4 sm:p-5">
      <Bar className="h-5 w-36" />
      <div className="mt-3 space-y-2">{[0, 1, 2].map((item) => <div key={item} className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-[#F1E7EB] bg-[#FFF9FB] px-3.5 py-3"><Bar className="h-10 w-10 shrink-0 rounded-full bg-[#FFE3EC]" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-3/4" /><Bar className="h-2.5 w-full" /></div><Bar className="h-4 w-4 shrink-0 rounded-full" /></div>)}<Bar className="mx-auto h-4 w-28" /></div>
    </CardSkeleton>
  );
}

function FinishSkeleton() {
  return <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-3"><div className="flex min-h-10 items-center px-2"><Bar className="h-3 w-28" /></div><FinishHero /><FinishResults /><div className={finishGridClass}><RecentQuestions /><NextActions /></div></div>;
}

function TopicDetailSkeleton() {
  return <div className="min-w-0 space-y-5">
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:text-sm"><Bar className="h-3 w-20"/><Bar className="h-4 w-4 rounded-full"/><Bar className="h-3 w-28 max-w-[30vw]"/><Bar className="h-4 w-4 rounded-full"/><Bar className="h-3 w-24 max-w-[30vw]"/></nav>
    <section aria-hidden="true" className="relative isolate overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[285px] lg:min-h-[300px]">
      <div className="relative z-10 grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-2 pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:flex sm:min-h-[285px] sm:items-center sm:gap-0 sm:px-0 sm:py-0 lg:min-h-[300px]"><div className="relative z-10 min-w-0 px-0 py-3 sm:max-w-[62%] sm:px-7 sm:py-8 lg:max-w-[60%] lg:px-8">
        <Bar className="h-11 w-11 rounded-2xl bg-[#FFE0E9] sm:h-12 sm:w-12"/><Bar className="mt-3 h-7 w-full max-w-[340px] bg-[#EED7E0] sm:h-9"/><Bar className="mt-2 h-4 w-40 max-w-full"/><Bar className="mt-3 h-4 w-full max-w-[440px]"/><Bar className="mt-2 h-4 w-4/5 max-w-[360px]"/><Bar className="mt-4 h-4 w-28 bg-[#F2DCE4]"/>
      </div>
      <div aria-hidden="true" className="pointer-events-none relative col-start-2 row-start-1 flex min-h-[154px] min-w-0 items-end justify-center min-[360px]:min-h-[158px] sm:absolute sm:inset-y-0 sm:right-0 sm:min-h-0 sm:w-[40%] lg:w-[39%]"><Image src="/dashboard-hero/my-subjects.png" alt="" fill priority sizes="(max-width: 640px) 38vw, 420px" className="object-contain object-bottom"/></div>
      </div>
    </section>
    <section aria-hidden="true" className="rounded-2xl border border-[#F0E5E9] bg-white p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><Bar className="h-4 w-full rounded-full"/><div className="mt-2 flex justify-between"><Bar className="h-3 w-20"/><Bar className="h-3 w-10"/></div></div><div className="space-y-2 sm:min-w-44"><Bar className="h-3 w-36 max-w-full"/><Bar className="h-3 w-40 max-w-full"/></div></div>
      <div className="mt-3 flex flex-wrap gap-1">{[0,1,2,3,4].map(n=><Bar key={n} className="h-6 w-16 rounded-full"/>)}</div>
    </section>
    <section aria-hidden="true" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-2"><Bar className="h-5 w-32"/><Bar className="h-4 w-60 max-w-[70vw]"/></div><Bar className="h-11 w-36 rounded-xl"/></div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_190px]"><Bar className="h-11 w-full rounded-xl"/><Bar className="h-11 w-full rounded-xl"/></div>
      <ul className="min-w-0 overflow-hidden rounded-2xl border border-[#E8E2E5] bg-white" aria-label="Loading flashcards">{[0,1,2,3].map(n=><li key={n} className={`flex min-w-0 flex-wrap items-center gap-2.5 px-3 py-3 sm:flex-nowrap sm:gap-3 sm:px-4 ${n ? "border-t border-[#F0EDF0]" : ""}`}><Bar className="h-10 w-10 shrink-0 rounded-xl bg-[#FFF0F5]"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-4/5"/><Bar className="h-3 w-28"/></div><div className="flex shrink-0 items-center gap-1"><Bar className="h-10 w-10 rounded-lg"/><Bar className="h-10 w-10 rounded-lg"/><Bar className="h-10 w-10 rounded-lg"/></div></li>)}</ul>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F5DDE5] bg-[#FFF7F9] p-4"><div className="min-w-0 space-y-2"><Bar className="h-4 w-32"/><Bar className="h-4 w-64 max-w-[70vw]"/></div><div className="flex flex-wrap gap-2"><Bar className="h-10 w-36 rounded-xl"/><Bar className="h-10 w-32 rounded-xl"/></div></div>
    </section>
  </div>;
}

function FolderDetailSkeleton() {
  return <div className="min-w-0 space-y-4">
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs sm:gap-2 sm:text-sm">
      <Bar className="h-3 w-16 shrink-0"/><Bar className="h-4 w-4 shrink-0 rounded-full"/><Bar className="h-3 w-28 min-w-0 max-w-[32vw]"/><Bar className="h-4 w-4 shrink-0 rounded-full"/><Bar className="h-3 w-24 min-w-0 max-w-[28vw]"/>
    </nav>
    <section aria-hidden="true" className="relative isolate overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[285px] lg:min-h-[300px]">
      <div className="relative z-10 grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-2 pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:flex sm:min-h-[285px] sm:items-center sm:gap-0 sm:px-0 sm:py-0 lg:min-h-[300px]">
        <div className="relative z-10 min-w-0 px-0 py-3 sm:max-w-[62%] sm:px-7 sm:py-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Bar className="h-11 w-11 shrink-0 rounded-2xl bg-[#FFE0E9] sm:h-12 sm:w-12"/>
            <div className="min-w-0 flex-1"><Bar className="h-6 w-full max-w-[260px] bg-[#EED7E0] sm:h-7"/><Bar className="mt-2 h-3 w-36 max-w-full"/></div>
          </div>
          <Bar className="mt-5 h-7 w-full max-w-[380px] bg-[#EED7E0] sm:h-9"/><Bar className="mt-1 h-7 w-4/5 max-w-[300px] bg-[#EED7E0] sm:h-9"/>
          <Bar className="mt-2 h-3 w-full max-w-[340px]"/><Bar className="mt-1.5 h-3 w-4/5 max-w-[280px]"/><Bar className="mt-4 h-10 w-32 rounded-full bg-[#F3D4DF] sm:h-11"/>
        </div>
      <div aria-hidden="true" className="pointer-events-none relative col-start-2 row-start-1 flex min-h-[154px] min-w-0 items-end justify-center min-[360px]:min-h-[158px] sm:absolute sm:inset-y-0 sm:right-0 sm:min-h-0 sm:w-[40%]">
        <Bar className="absolute bottom-0 right-[7%] h-[65%] w-[76%] rounded-t-[48%] rounded-b-[2rem] bg-[#FFE6EE] sm:h-[72%]"/>
        <Bar className="absolute bottom-[42%] right-[20%] h-[44%] w-[58%] rounded-full bg-[#F7D5E0]"/>
        <Bar className="absolute bottom-[62%] right-[62%] h-5 w-5 rounded-full bg-[#F7D5E0] sm:h-7 sm:w-7"/>
        <Bar className="absolute bottom-[62%] right-[9%] h-5 w-5 rounded-full bg-[#F7D5E0] sm:h-7 sm:w-7"/>
      </div></div>
    </section>
    <section aria-hidden="true" className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2"><Bar className="h-5 w-28"/><Bar className="h-4 w-72 max-w-[80vw]"/></div><Bar className="h-11 w-32 rounded-xl"/>
      </div>
      <Bar className="h-11 w-full rounded-xl"/>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0,1,2].map(n=><CardSkeleton key={n} className="min-w-0"><div className="flex min-w-0 items-start gap-3"><Bar className="h-11 w-11 shrink-0 rounded-xl bg-[#FFF0F5]"/><div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-4/5"/><Bar className="h-3 w-full"/><Bar className="h-3 w-2/3"/></div></div><Bar className="mt-4 h-3 w-28"/><Bar className="mt-3 h-3 w-20"/><Bar className="mt-2 h-2.5 w-full rounded-full"/><div className="mt-4 flex flex-wrap gap-1"><Bar className="h-10 w-10 rounded-lg"/><Bar className="h-10 w-10 rounded-lg"/><Bar className="h-10 w-10 rounded-lg"/><Bar className="h-10 w-28 rounded-xl"/></div></CardSkeleton>)}
      </div>
    </section>
  </div>;
}

function SubjectFolderDetailSkeleton() {
  return <div className="min-w-0 space-y-5">
    <nav aria-label="Breadcrumb" className="flex items-center gap-2"><Bar className="h-3 w-20"/><Bar className="h-4 w-4 rounded-full"/><Bar className="h-3 w-40"/></nav>
    <section aria-hidden="true" className="relative isolate overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[280px]">
      <div className="relative z-10 grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-2 pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:flex sm:min-h-[280px] sm:items-center sm:gap-0 sm:px-0 sm:py-0"><div className="relative z-10 min-w-0 space-y-3 px-0 py-3 sm:max-w-[62%] sm:px-8 sm:py-6"><Bar className="h-7 w-full max-w-[270px] bg-[#EED7E0]"/><Bar className="h-3 w-44"/><Bar className="mt-4 h-8 w-full max-w-[380px] bg-[#EED7E0]"/><Bar className="h-8 w-4/5 max-w-[300px] bg-[#EED7E0]"/><Bar className="mt-2 h-3 w-full max-w-[360px]"/><Bar className="h-3 w-4/5 max-w-[280px]"/><Bar className="mt-2 h-11 w-32 rounded-xl bg-[#F3D4DF]"/></div>
      <div aria-hidden="true" className="pointer-events-none relative col-start-2 row-start-1 flex min-h-[154px] min-w-0 items-end justify-center min-[360px]:min-h-[158px] sm:absolute sm:inset-y-0 sm:right-0 sm:min-h-0 sm:w-[36%]"><Bar className="absolute bottom-0 right-[8%] h-[66%] w-[76%] rounded-t-[48%] rounded-b-[2rem] bg-[#FFE6EE]"/><Bar className="absolute bottom-[42%] right-[19%] h-[48%] w-[58%] rounded-full bg-[#F7D5E0]"/><Bar className="absolute bottom-[63%] right-[62%] h-6 w-6 rounded-full bg-[#F7D5E0]"/><Bar className="absolute bottom-[63%] right-[9%] h-6 w-6 rounded-full bg-[#F7D5E0]"/></div>
      </div>
    </section>
    <section className="space-y-4" aria-hidden="true"><div className="flex flex-wrap items-center justify-between gap-3"><div className="space-y-2"><Bar className="h-5 w-32"/><Bar className="h-3 w-64 max-w-[75vw]"/></div><Bar className="h-11 w-32 rounded-xl"/></div><Bar className="h-11 w-full max-w-xl rounded-xl"/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0,1,2,3,4,5].map(i=><CardSkeleton key={i} className="min-h-[170px]"><div className="flex gap-3"><Bar className="h-11 w-11 shrink-0 rounded-xl bg-[#FFF0F5]"/><div className="flex-1 space-y-2"><Bar className="h-4 w-4/5"/><Bar className="h-3 w-2/3"/></div></div><Bar className="mt-5 h-2.5 w-full rounded-full"/><div className="mt-4 flex gap-2"><Bar className="h-8 w-8 rounded-full"/><Bar className="h-8 w-8 rounded-full"/><Bar className="h-8 w-8 rounded-full"/><Bar className="h-8 w-8 rounded-full"/></div></CardSkeleton>)}</div></section>
  </div>;
}

function Content({ variant }: { variant: PageLoadingVariant }) {
  switch (variant) {
    case "dashboard":
      return <div className="space-y-5"><Hero /><MetricCards count={4} /><div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><CardSkeleton className="min-h-[240px]"><Bar className="h-4 w-36" /><Bar className="mt-6 h-36 w-full rounded-xl" /></CardSkeleton><CardSkeleton className="min-h-[240px]"><Bar className="h-4 w-32" /><div className="mt-5 space-y-4">{[0, 1, 2, 3].map((n) => <div key={n} className="flex gap-3"><Bar className="h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><Bar className="h-3 w-3/4" /><Bar className="h-2.5 w-1/2" /></div></div>)}</div></CardSkeleton></div><FeaturedBadgesSkeleton /></div>;
    case "subjects":
      return <div className="space-y-5"><Hero variant="compact" /><div className="flex items-center justify-between gap-3"><Bar className="h-5 w-36" /><Bar className="h-10 w-32 rounded-full" /></div><SubjectCards /></div>;
    case "subject-detail":
      return <div className="space-y-5"><Bar className="h-4 w-44" /><Hero /><MetricCards count={4} /><div className="flex items-center justify-between"><Bar className="h-5 w-40" /><Bar className="h-9 w-28 rounded-full" /></div><div className="grid gap-3 md:grid-cols-2"><CardSkeleton className="min-h-[150px]"><Bar className="h-3 w-24" /><Bar className="mt-5 h-4 w-full" /><Bar className="mt-3 h-3 w-2/3" /></CardSkeleton><CardSkeleton className="min-h-[150px]"><Bar className="h-3 w-24" /><Bar className="mt-5 h-4 w-full" /><Bar className="mt-3 h-3 w-2/3" /></CardSkeleton></div></div>;
    case "folder-detail":
      return <FolderDetailSkeleton />;
    case "subject-folder-detail":
      return <SubjectFolderDetailSkeleton />;
    case "topic-detail":
      return <TopicDetailSkeleton />;
    case "review":
      return <div className="space-y-5"><Hero /><MetricCards count={3} /><CardSkeleton><Bar className="h-5 w-44" /><div className="mt-5 space-y-3">{[0, 1, 2].map((n) => <div key={n} className="flex items-center gap-3 rounded-xl border border-[#F4E9ED] p-3"><Bar className="h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><Bar className="h-3 w-2/3" /><Bar className="h-2.5 w-1/3" /></div><Bar className="h-9 w-24 rounded-full" /></div>)}</div></CardSkeleton></div>;
    case "quiz-setup":
      return <div className="space-y-5"><Hero variant="compact" /><div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]"><CardSkeleton><Bar className="h-5 w-44" /><Bar className="mt-2 h-3 w-60 max-w-full" /><div className="mt-5 grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((n) => <Bar key={n} className="h-20 rounded-xl" />)}</div><Bar className="mt-5 h-11 w-40 rounded-full" /></CardSkeleton><CardSkeleton><Bar className="h-5 w-36" /><MetricCards count={3} /><Bar className="mt-4 h-24 w-full rounded-xl" /></CardSkeleton></div></div>;
    case "quiz":
      return <div className="space-y-4">
        <div className="flex min-h-9 items-center gap-2"><Bar className="h-3 w-16"/><Bar className="h-3 w-4 rounded-full"/><Bar className="h-3 w-28 max-w-[30vw]"/><Bar className="ml-auto h-9 w-24 rounded-full"/></div>
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_290px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <QuizSessionHeroSkeleton className="order-1 lg:col-start-1 lg:row-start-1" />
          <CardSkeleton className="order-2 min-h-[390px] sm:p-7 lg:col-start-1 lg:row-start-2">
            <div className="flex flex-wrap items-center gap-2"><Bar className="h-4 w-28"/><Bar className="h-5 w-24 rounded-full"/></div>
            <Bar className="mt-8 h-6 w-4/5"/><Bar className="mt-3 h-6 w-2/3"/>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((n) => <Bar key={n} className="h-14 rounded-xl" />)}</div>
            <Bar className="mt-8 h-11 w-36 rounded-full"/>
          </CardSkeleton>
          <CardSkeleton className="order-3 min-h-[260px] lg:col-start-2 lg:row-start-1">
            <Bar className="h-4 w-32"/><div className="mt-5 flex items-center gap-4 lg:flex-col xl:flex-row">
              <Bar className="h-[84px] w-[84px] shrink-0 rounded-full bg-[#F8DCE5]"/>
              <div className="min-w-0 flex-1 space-y-3">{[0, 1, 2, 3].map((n) => <div key={n} className="flex justify-between gap-3"><Bar className="h-3 w-24"/><Bar className="h-3 w-8"/></div>)}</div>
            </div><div className="mt-4 flex items-center gap-3 rounded-xl bg-[#FFF7F9] p-3"><Bar className="h-12 w-12 shrink-0 rounded-full bg-[#FFE6EE]"/><Bar className="h-3 w-3/4"/></div>
          </CardSkeleton>
        </div>
      </div>;
    case "finish":
      return <FinishSkeleton />;
    case "progress":
      return <div className="space-y-5"><Hero variant="compact" /><MetricCards count={4} /><FeaturedBadgesSkeleton /><div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]"><CardSkeleton className="min-h-[300px]"><Bar className="h-4 w-40" /><Bar className="mt-6 h-52 w-full rounded-xl" /></CardSkeleton><CardSkeleton className="min-h-[300px]"><Bar className="h-4 w-36" /><div className="mt-6 space-y-5">{[0, 1, 2, 3, 4].map((n) => <Bar key={n} className="h-5 w-full" />)}</div></CardSkeleton></div></div>;
    case "settings":
      return <div className="space-y-5"><Hero variant="compact" /><SettingsSections /></div>;
  }
}

export function PageLoadingSkeleton({ variant }: { variant: PageLoadingVariant }) {
  const pageSpacing = variant === "folder-detail" || variant === "subject-folder-detail"
    ? "min-w-0 space-y-4 p-4 pb-24 sm:p-5 xl:p-6"
    : variant === "finish"
    ? "w-full px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 lg:px-7 lg:pb-7"
    : variant === "topic-detail"
      ? "min-w-0 space-y-5 p-4 pb-24 sm:p-6 xl:p-7"
      : "space-y-5 p-4 pb-24 sm:p-5 xl:p-6";
  const content = (
    <div role="status" aria-live="polite" aria-label={`Loading ${variant.replace("-", " ")} page`} className="min-h-full">
      <span className="sr-only">Loading page content…</span>
      <div className={pageSpacing}>
        <Content variant={variant} />
      </div>
    </div>
  );

  return content;
}
