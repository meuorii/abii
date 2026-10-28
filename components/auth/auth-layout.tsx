import type { ReactNode } from "react";

type AuthLayoutProps = {
  mode: "login" | "register";
  children: ReactNode;
};

export function AuthLayout({ mode, children }: AuthLayoutProps) {
  const isRegister = mode === "register";

  return (
    <main className="min-h-dvh w-full overflow-x-clip bg-white text-[#29252B]">
      {/* Tinanggal ang max-w at mx-auto para maging full width ang grid */}
      <div className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
        
        {/* Left Panel: Full height & width image mascot container */}
        <section className="relative hidden h-full w-full min-h-0 overflow-hidden lg:block">
          <img
            src={isRegister ? "/auth/register.png" : "/auth/login.png"}
            alt={
              isRegister
                ? "Abii the pink otter welcoming you to start studying"
                : "Abii the pink otter welcoming you back"
            }
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          
          {/* Gradient overlay para manatiling nababasa ang text sa ibabaw ng image */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#442337]/75 via-transparent to-transparent" />
          
          {/* Mascot Text Overlay */}
          <div className="absolute inset-x-0 bottom-0 z-10 p-8 text-white xl:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/90">
              Your little study buddy
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.045em] xl:text-4xl 2xl:text-5xl">
              {isRegister ? "Small steps start big things." : "Good to see you again."}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/90 xl:text-base">
              {isRegister
                ? "Make a little space for learning, one remembered answer at a time."
                : "Take a breath, pick up where you left off, and keep those little wins coming."}
            </p>
          </div>
        </section>

        {/* Right Panel: Form area */}
        <section className="relative flex h-full min-h-0 items-center justify-center overflow-y-auto px-5 py-8 sm:px-10 lg:overflow-hidden lg:px-12 xl:px-16">
          <div className="w-full max-w-[410px]">
            {/* Small brand header for mobile view only */}
            <div className="mb-7 flex items-center gap-2 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center bg-transparent text-2xl text-[#C65380]">
                ♡
              </span>
              <span className="text-xl font-extrabold tracking-[-0.07em]">
                abii<span className="text-[#C65380]">.</span>
              </span>
            </div>

            <p className="text-sm font-semibold text-[#C65380]">
              {isRegister ? "A fresh start" : "Your study space awaits"}
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.055em] sm:text-[2.35rem]">
              {isRegister ? "Create your account." : "Welcome back."}
            </h1>
            <p className="mb-7 mt-2 text-sm leading-6 text-[#77717A]">
              {isRegister
                ? "Let’s make remembering a little easier."
                : "Sign in to continue your learning journey."}
            </p>

            {children}

            <p className="mt-7 text-center text-xs text-[#99919A]">
              A gentle nudge toward what you want to remember.
            </p>

            <div className="mt-5 text-center text-xs text-[#8C6C7A] lg:hidden">
              Learn a little, remember a lot.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
