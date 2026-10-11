import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Create cards",
    description: "Turn important information into clear study questions and answers.",
  },
  {
    number: "02",
    title: "Recall answers",
    description: "Try to answer from memory before you reveal what’s on the other side.",
  },
  {
    number: "03",
    title: "Check results",
    description: "See what you know and spot the questions that need another look.",
  },
  {
    number: "04",
    title: "Review again",
    description: "Return to your cards and strengthen what you’ve learned over time.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh overflow-x-clip bg-white text-[#2F2930]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label="Abii home"
          className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-4"
        >
          <span aria-hidden="true" className="text-[1.7rem] leading-none text-[#E9577D]">♡</span>
          <span className="text-[1.65rem] font-extrabold tracking-[-0.075em]">
            abii<span className="text-[#FF6F96]">.</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#625760] transition-colors hover:text-[#C94B76] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] sm:px-4"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:px-5"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[min(720px,calc(100dvh-80px))] w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-14 pt-8 sm:px-8 sm:pb-16 md:gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-12 lg:pb-20 lg:pt-6">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#C65380] sm:text-sm">
            <span className="h-px w-7 bg-[#FF9FBA]" aria-hidden="true" />
            Your little study buddy
          </p>
          <h1 className="max-w-[12ch] text-[clamp(2.8rem,6.1vw,5.4rem)] font-semibold leading-[0.99] tracking-[-0.065em]">
            Study smarter.
            <span className="mt-1 block text-[#C65380]">Remember longer.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#756B72] sm:text-lg sm:leading-8">
            Turn your study materials into flashcards, test what you remember, reveal the answers, and revisit the questions that need more practice.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#FF6F96] px-6 py-3 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(201,75,118,0.14)] transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#E9577D] hover:shadow-[0_8px_18px_rgba(201,75,118,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"
            >
              Get Started <span aria-hidden="true">↗</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#E8E2E5] bg-white px-6 py-3 text-sm font-semibold text-[#51464E] transition-colors hover:border-[#E9A6BC] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"
            >
              Log in
            </Link>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#8C7F87]">
            A calmer way to make learning stick, one question at a time.
          </p>
        </div>

        <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center lg:justify-end">
          <div className="relative aspect-[0.98/1] w-full max-w-[530px] overflow-hidden rounded-[2rem] bg-[#FFF7F9] sm:rounded-[2.5rem]">
            <div className="absolute inset-x-0 top-0 h-px bg-[#F5D9E2]" aria-hidden="true" />
            <img
              src="/mascot/welcome.png"
              alt="Abii, the soft pastel-pink otter mascot, waving hello"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-contain object-center p-3 sm:p-5"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-[#FFF7F9]/85 to-transparent" aria-hidden="true" />
            <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 sm:right-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C65380]">Learn a little,</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[#2F2930] sm:text-2xl">remember a lot.</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="border-t border-[#F0E8EC] bg-[#FFFCFD]">
        <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
          <div className="mb-9 flex flex-col justify-between gap-3 sm:mb-11 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C65380]">A simple study rhythm</p>
              <h2 id="how-it-works" className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.055em] sm:text-4xl">
                Four small steps. <span className="text-[#8C7F87]">Stronger recall.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#756B72]">
              Active Recall helps you practise bringing information to mind—not just reading it again.
            </p>
          </div>

          <ol className="grid grid-cols-1 divide-y divide-[#E8E2E5] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            {steps.map((step, index) => (
              <li key={step.number} className={`py-5 sm:px-5 sm:py-4 lg:px-6 ${index === 0 ? "sm:pl-0" : ""} ${index === 3 ? "sm:pr-0" : ""}`}>
                <span className="text-xs font-bold tracking-[0.14em] text-[#C65380]">{step.number}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.025em]">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[#756B72]">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-[#F0E8EC] bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-[#8C7F87] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <Link href="/" className="w-fit font-extrabold tracking-[-0.06em] text-[#2F2930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">
            abii<span className="text-[#FF6F96]">.</span>
          </Link>
          <p>Learn a little, remember a lot.</p>
        </div>
      </footer>
    </main>
  );
}
