import Image from "next/image";

export function BadgeHero() {
  return (
    <section className="relative mb-5 flex min-h-[310px] items-center overflow-hidden rounded-2xl border border-[#F8E6EC] bg-[#FFF0F4] px-5 py-7 sm:min-h-[230px] sm:px-8 sm:py-8 xl:min-h-[250px] xl:px-10">
      <div className="relative z-10 max-w-[58%] sm:max-w-[58%]">
        <p className="text-xs font-extrabold tracking-[.13em] text-[#D94E7B]">YOUR ACHIEVEMENTS</p>
        <h1 className="mt-2 max-w-[620px] text-[28px] font-extrabold leading-tight tracking-[-.035em] text-[#183653] sm:text-3xl xl:text-4xl">Every Milestone Matters!</h1>
        <p className="mt-3 max-w-[480px] text-sm leading-6 text-[#58718B] sm:text-base sm:leading-7">Celebrate your progress, collect achievements, and discover how far your learning journey has come.</p>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[39%] sm:w-[40%] xl:w-[38%]">
        <Image src="/dashboard-hero/badges.png" alt="Abii celebrating your learning achievements" fill priority sizes="(max-width: 640px) 43vw, 440px" className="object-contain object-bottom" />
      </div>
    </section>
  );
}
