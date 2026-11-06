import type { ReactNode } from "react";

type AuthLayoutProps = {
  mode: "login" | "register" | "verify" | "forgot" | "reset";
  children: ReactNode;
};

const content = {
  login: {
    eyebrow: "Your little study buddy",
    brandHeading: "Good to see you again.",
    brandDescription: "Pick up where you left off and keep those little wins coming.",
    formEyebrow: "Your study space awaits",
    heading: "Welcome back!",
    description: "Sign in to continue studying, review your flashcards, and pick up where you left off.",
  },
  register: {
    eyebrow: "Start your learning journey",
    brandHeading: "Small steps start big things.",
    brandDescription: "Build better study habits, one flashcard at a time.",
    formEyebrow: "A fresh start",
    heading: "Start learning with Abii",
    description: "Create your account to organize subjects, make flashcards, and practice active recall.",
  },
  verify: {
    eyebrow: "Your little study buddy",
    brandHeading: "One little step closer!",
    brandDescription: "Verify your email to get back to your study journey.",
    formEyebrow: "One quick step",
    heading: "Verify your email",
    description: "Enter the code we sent to your email address to continue to your study space.",
  },
  forgot: {
    eyebrow: "Your little study buddy",
    brandHeading: "We've got you.",
    brandDescription: "Let's help you get back to learning.",
    formEyebrow: "Account security",
    heading: "Forgot your password?",
    description: "Enter your email and we'll send you a recovery code.",
  },
  reset: {
    eyebrow: "Your little study buddy",
    brandHeading: "A fresh start awaits.",
    brandDescription: "Secure your account and continue your learning journey.",
    formEyebrow: "Account security",
    heading: "Create a new password",
    description: "Choose a secure password for your Abii account.",
  },
} as const;

export function AuthLayout({ mode, children }: AuthLayoutProps) {
  const copy = content[mode];
  const isFlowPage = mode !== "login" && mode !== "register";
  const artwork = mode === "register" ? "register" : "login";

  return (
    <main className="auth-page">
      <div className="auth-card">
        <section className="auth-brand-panel" aria-label="About Abii">
          <picture className="auth-brand-art abii-enter-art">
            <source media="(min-width: 1024px)" srcSet={`/auth/${artwork}.png`} />
            {/* The browser selects only the artwork suited to the current layout. */}
            <img src={`/auth/${artwork}-mobile.png`} alt="" width="1536" height="1024" />
          </picture>
          <div className="auth-brand-copy auth-brand-enter">
            <div className="auth-brand-header">
              <div className="auth-wordmark font-brand">abii<span>.</span></div>
              <p className="auth-brand-descriptor">Your active recall companion</p>
            </div>
            <div className="auth-brand-message">
              <p className="auth-brand-eyebrow">{copy.eyebrow}</p>
              <h2>{copy.brandHeading}</h2>
              <p className="auth-brand-description">{copy.brandDescription}</p>
            </div>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="w-full max-w-[410px]">
            <p className={`text-sm font-semibold text-[#B74672] ${isFlowPage ? "abii-enter abii-enter-1" : "abii-enter"}`}>
              {copy.formEyebrow}
            </p>
            <h1 className={`mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.055em] sm:text-[2.15rem] ${isFlowPage ? "abii-enter abii-enter-2" : "abii-enter abii-enter-1"}`}>
              {copy.heading}
            </h1>
            <p className={`mb-7 mt-2 text-sm leading-6 text-[var(--muted)] ${isFlowPage ? "abii-enter abii-enter-3" : "abii-enter abii-enter-2"}`}>
              {copy.description}
            </p>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
