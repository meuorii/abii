"use client";

import { AppShell } from "@/components/app-shell";

export type PageLoadingVariant =
  | "dashboard"
  | "subjects"
  | "subject-detail"
  | "review"
  | "quiz-setup"
  | "quiz"
  | "finish"
  | "progress"
  | "settings";

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-[#F4E9ED] ${className}`} />;
}

function CardSkeleton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div aria-hidden="true" className={`rounded-2xl border border-[#F0E5E9] bg-white p-4 sm:p-5 ${className}`}>{children}</div>;
}

function Hero({ variant = "wide" }: { variant?: "wide" | "compact" }) {
  return (
    <div aria-hidden="true" className={`relative overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF4F7] p-5 sm:p-7 ${variant === "wide" ? "min-h-[220px] sm:min-h-[250px]" : "min-h-[150px] sm:min-h-[170px]"}`}>
      <div className="relative z-10 max-w-[62%] space-y-3 sm:max-w-[58%]">
        <Bar className="h-3 w-24 bg-[#F2DCE4]" />
        <Bar className="h-7 w-full max-w-[300px] bg-[#EED7E0] sm:h-9" />
        <Bar className="h-3 w-full max-w-[260px]" />
        <Bar className="h-3 w-4/5 max-w-[220px]" />
        {variant === "wide" && <Bar className="mt-4 h-10 w-32 rounded-full bg-[#F3D4DF]" />}
      </div>
      <div className="absolute -bottom-8 right-3 h-36 w-32 rounded-t-[48%] rounded-b-3xl bg-[#FFE6EE] sm:right-8 sm:h-48 sm:w-44" />
      <div className="absolute bottom-7 right-9 h-20 w-20 rounded-full bg-[#F7D5E0] sm:bottom-9 sm:right-16 sm:h-28 sm:w-28" />
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

function Content({ variant }: { variant: PageLoadingVariant }) {
  switch (variant) {
    case "dashboard":
      return <div className="space-y-5"><Hero /><MetricCards count={4} /><div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><CardSkeleton className="min-h-[240px]"><Bar className="h-4 w-36" /><Bar className="mt-6 h-36 w-full rounded-xl" /></CardSkeleton><CardSkeleton className="min-h-[240px]"><Bar className="h-4 w-32" /><div className="mt-5 space-y-4">{[0, 1, 2, 3].map((n) => <div key={n} className="flex gap-3"><Bar className="h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><Bar className="h-3 w-3/4" /><Bar className="h-2.5 w-1/2" /></div></div>)}</div></CardSkeleton></div></div>;
    case "subjects":
      return <div className="space-y-5"><Hero /><div className="flex items-center justify-between gap-3"><Bar className="h-5 w-36" /><Bar className="h-10 w-32 rounded-full" /></div><SubjectCards /></div>;
    case "subject-detail":
      return <div className="space-y-5"><Bar className="h-4 w-44" /><Hero /><MetricCards count={4} /><div className="flex items-center justify-between"><Bar className="h-5 w-40" /><Bar className="h-9 w-28 rounded-full" /></div><div className="grid gap-3 md:grid-cols-2"><CardSkeleton className="min-h-[150px]"><Bar className="h-3 w-24" /><Bar className="mt-5 h-4 w-full" /><Bar className="mt-3 h-3 w-2/3" /></CardSkeleton><CardSkeleton className="min-h-[150px]"><Bar className="h-3 w-24" /><Bar className="mt-5 h-4 w-full" /><Bar className="mt-3 h-3 w-2/3" /></CardSkeleton></div></div>;
    case "review":
      return <div className="space-y-5"><Hero /><MetricCards count={3} /><CardSkeleton><Bar className="h-5 w-44" /><div className="mt-5 space-y-3">{[0, 1, 2].map((n) => <div key={n} className="flex items-center gap-3 rounded-xl border border-[#F4E9ED] p-3"><Bar className="h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><Bar className="h-3 w-2/3" /><Bar className="h-2.5 w-1/3" /></div><Bar className="h-9 w-24 rounded-full" /></div>)}</div></CardSkeleton></div>;
    case "quiz-setup":
      return <div className="space-y-5"><Hero variant="compact" /><div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]"><CardSkeleton><Bar className="h-5 w-44" /><Bar className="mt-2 h-3 w-60 max-w-full" /><div className="mt-5 grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((n) => <Bar key={n} className="h-20 rounded-xl" />)}</div><Bar className="mt-5 h-11 w-40 rounded-full" /></CardSkeleton><CardSkeleton><Bar className="h-5 w-36" /><MetricCards count={3} /><Bar className="mt-4 h-24 w-full rounded-xl" /></CardSkeleton></div></div>;
    case "quiz":
      return <div className="space-y-4"><div className="flex items-center justify-between"><Bar className="h-4 w-28" /><Bar className="h-4 w-20" /></div><Bar className="h-2.5 w-full rounded-full" /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"><CardSkeleton className="min-h-[390px] sm:p-7"><div className="flex items-center justify-between"><Bar className="h-7 w-28 rounded-full" /><Bar className="h-3 w-24" /></div><Bar className="mt-8 h-6 w-4/5" /><Bar className="mt-3 h-6 w-2/3" /><div className="mt-8 grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((n) => <Bar key={n} className="h-14 rounded-xl" />)}</div><Bar className="mt-8 h-11 w-36 rounded-full" /></CardSkeleton><CardSkeleton className="hidden min-h-[300px] lg:block"><Bar className="h-4 w-32" /><Bar className="mt-5 h-24 w-24 rounded-full mx-auto" />{[0, 1, 2, 3].map((n) => <Bar key={n} className="mt-4 h-3 w-full" />)}</CardSkeleton></div></div>;
    case "finish":
      return <div className="space-y-5"><CardSkeleton className="bg-[#FFF7F9] p-5 sm:p-8"><div className="flex flex-col items-center gap-6 md:flex-row"><Bar className="h-36 w-32 rounded-[40%] bg-[#F8DCE5]" /><div className="w-full flex-1 space-y-3"><Bar className="h-3 w-28" /><Bar className="h-8 w-4/5" /><Bar className="h-3 w-2/3" /><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((n) => <Bar key={n} className="h-20 rounded-xl" />)}</div><div className="mt-5 flex flex-wrap gap-2"><Bar className="h-11 w-32 rounded-full" /><Bar className="h-11 w-36 rounded-full" /></div></div></div></CardSkeleton></div>;
    case "progress":
      return <div className="space-y-5"><Hero variant="compact" /><MetricCards count={4} /><div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]"><CardSkeleton className="min-h-[300px]"><Bar className="h-4 w-40" /><Bar className="mt-6 h-52 w-full rounded-xl" /></CardSkeleton><CardSkeleton className="min-h-[300px]"><Bar className="h-4 w-36" /><div className="mt-6 space-y-5">{[0, 1, 2, 3, 4].map((n) => <Bar key={n} className="h-5 w-full" />)}</div></CardSkeleton></div></div>;
    case "settings":
      return <div className="space-y-5"><Hero variant="compact" /><SettingsSections /></div>;
  }
}

export function PageLoadingSkeleton({ variant, withShell = true }: { variant: PageLoadingVariant; withShell?: boolean }) {
  const content = (
    <div role="status" aria-live="polite" aria-label={`Loading ${variant.replace("-", " ")} page`} className="min-h-full">
      <span className="sr-only">Loading page content…</span>
      <div className="space-y-5 p-4 pb-24 sm:p-5 xl:p-6">
        <Content variant={variant} />
      </div>
    </div>
  );

  if (!withShell) return content;
  return <AppShell userName="Abii learner">{content}</AppShell>;
}
