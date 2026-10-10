export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <a href="/" className="flex items-center gap-3" aria-label="Abii home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFE8EF] text-2xl" aria-hidden="true">
            ♡
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-[#2F2930]">abii<span className="text-[#FF6F96]">.</span></span>
        </a>
        <span className="rounded-full border border-[#E8E2E5] px-4 py-2 text-sm font-medium text-[#756B72]">
          Your study space
        </span>
      </header>

      <section className="mx-auto grid min-h-[72vh] w-full max-w-6xl items-center gap-12 px-6 pb-16 pt-8 sm:px-10 md:grid-cols-[1.15fr_0.85fr]">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF7F9] px-4 py-2 text-sm font-semibold text-[#E9577D]">
            <span aria-hidden="true">✦</span> Small steps, stronger memory
          </span>
          <h1 className="mt-7 text-5xl font-extrabold leading-[1.08] tracking-tight text-[#2F2930] sm:text-6xl">
            Learn a little,
            <span className="block text-[#FF6F96]">remember a lot.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[#756B72]">
            Meet Abii, your cozy space for active recall. Make flashcards, test
            what you remember, and give tricky topics another try.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <span className="rounded-2xl bg-[#FF6F96] px-6 py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(255,111,150,0.22)]">
              Your learning journey starts here
            </span>
            <span className="text-sm text-[#756B72]">A little practice goes a long way.</span>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-sm items-center justify-center">
          <div className="absolute h-72 w-72 rounded-full bg-[#FFF7F9]" aria-hidden="true" />
          <div className="relative flex aspect-square w-full items-center justify-center rounded-[2.5rem] border border-[#F6E5EB] bg-[#FFFAFB] p-8 shadow-[0_20px_60px_rgba(233,87,125,0.08)]">
            <div className="text-center">
              <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-[2.75rem] bg-[#FFE8EF] text-7xl" aria-label="Temporary mascot placeholder" role="img">
                ♡
              </div>
              <p className="mt-6 text-xl font-extrabold text-[#2F2930]">Hi, I’m Abii!</p>
              <p className="mt-2 text-sm leading-6 text-[#756B72]">
                Your study buddy is getting ready.
              </p>
              <span className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#E9577D] ring-1 ring-[#F6D5E0]">
                Ready when you are
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#F3EDF0] px-6 py-5 text-center text-sm text-[#756B72]">
        Made for little learning wins <span aria-hidden="true">♡</span>
      </footer>
    </main>
  );
}
