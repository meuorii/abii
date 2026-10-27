import { AppShell } from "@/components/app-shell";

function Block({ className = "" }: { className?: string }) { return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-[#F2EDF0] ${className}`} />; }

export function BadgesPageSkeleton({ userName = "Abii learner" }: { userName?: string }) {
  return <AppShell userName={userName}>
    <div role="status" aria-live="polite" aria-label="Loading badges page" className="w-full min-w-0 space-y-5 p-4 pb-24 sm:p-6 xl:p-7">
      <span className="sr-only">Loading badge collection…</span>
      <section className="relative min-h-[310px] overflow-hidden rounded-2xl border border-[#F8E6EC] bg-[#FFF5F8] p-5 sm:min-h-[230px] sm:p-8"><Block className="h-3 w-32"/><Block className="mt-4 h-8 w-3/5 max-w-[440px]"/><Block className="mt-3 h-4 w-1/2 max-w-[450px]"/><Block className="mt-2 h-4 w-2/5 max-w-[380px]"/><Block className="absolute bottom-0 right-4 h-[88%] w-[32%] rounded-t-full"/></section>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0,1,2,3].map((n)=><div key={n} className="rounded-2xl border border-[#E8E2E5] p-4"><Block className="h-4 w-24"/><Block className="mt-3 h-8 w-14"/><Block className="mt-2 h-3 w-28"/></div>)}</section>
      <section className="rounded-2xl border border-[#F3E5EA] bg-[#FFF8FA] p-4 sm:p-5"><Block className="h-5 w-48"/><Block className="mt-4 h-3 w-full rounded-full"/></section>
      <section className="rounded-2xl border border-[#E8E2E5] p-4"><Block className="h-5 w-40"/><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[0,1,2,3].map((n)=><Block key={n} className="h-10"/>)}</div></section>
      <section><Block className="h-7 w-56"/><Block className="mt-4 h-28 w-full"/><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">{[0,1,2,3,4,5,6,7].map((n)=><div key={n} className="rounded-2xl border border-[#E8E2E5] p-3 sm:p-4"><div className="flex justify-between"><Block className="h-6 w-16"/><Block className="h-6 w-20"/></div><Block className="mx-auto mt-3 aspect-square w-full max-w-[150px]"/><Block className="mx-auto mt-3 h-4 w-3/4"/><Block className="mt-4 h-2 w-full"/></div>)}</div></section>
    </div>
  </AppShell>;
}
