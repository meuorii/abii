"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.3 2.4-2.7 3.7M6.2 6.2C3.8 7.7 2.7 10.3 2.5 12c1 2.5 4.5 7 9.5 7 1.1 0 2.1-.2 3-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/></svg>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";
  const fieldClass = "mt-2 block min-h-12 w-full rounded-xl border border-[#E9DFE4] bg-white px-4 py-3 text-sm text-[#29252B] outline-none transition placeholder:text-[#AAA1A8] hover:border-[#DCC8D1] focus:border-[#C65380] focus:ring-4 focus:ring-[#FCE7F3]";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setErrors({});
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrors({ email: "Enter a valid email address." }); setBusy(false); return;
    }
    if (isRegister && name.trim().length < 2) {
      setErrors({ name: "Please enter your name (at least 2 characters)." }); setBusy(false); return;
    }
    if (password.length < (isRegister ? 8 : 1)) {
      setErrors({ password: isRegister ? "Use at least 8 characters." : "Enter your password." }); setBusy(false); return;
    }
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.message || "We couldn't sign you in just now. Check your details and try again.");
        setErrors(result.errors || {}); return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch {
      setMessage("We couldn't connect just now. Please try again in a moment.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {isRegister && <div>
        <label htmlFor="name" className="text-sm font-semibold text-[#39323A]">Your name</label>
        <input id="name" name="name" autoComplete="name" placeholder="What should we call you?" value={name} onChange={e => setName(e.target.value)} className={fieldClass} maxLength={80} required aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} />
        {errors.name && <p id="name-error" className="mt-1.5 text-sm text-[#B42345]">{errors.name}</p>}
      </div>}
      <div>
        <label htmlFor="email" className="text-sm font-semibold text-[#39323A]">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} maxLength={254} required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
        {errors.email && <p id="email-error" className="mt-1.5 text-sm text-[#B42345]">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-semibold text-[#39323A]">Password</label>
        <div className="relative mt-2">
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "At least 8 characters" : "Enter your password"} value={password} onChange={e => setPassword(e.target.value)} className={`${fieldClass} mt-0 pr-12`} minLength={isRegister ? 8 : undefined} maxLength={128} required aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} />
          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#827681] transition hover:text-[#C65380] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C65380]" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}><EyeIcon visible={showPassword} /></button>
        </div>
        {errors.password && <p id="password-error" className="mt-1.5 text-sm text-[#B42345]">{errors.password}</p>}
        {isRegister && <p className="mt-2 text-xs text-[#8B818A]">Use 8–128 characters.</p>}
      </div>
      {message && <p role="alert" className="rounded-lg border border-[#F1C9D4] bg-[#FFF4F6] px-3.5 py-3 text-sm leading-5 text-[#963A55]">{message}</p>}
      <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C65380] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#AA416B] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F4C4D7] disabled:cursor-not-allowed disabled:opacity-65">
        {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
        {busy ? (isRegister ? "Creating your account…" : "Signing you in…") : (isRegister ? "Create account" : "Sign in")}
      </button>
      <p className="pt-1 text-center text-sm text-[#77717A]">
        {isRegister ? "Already have an account? " : "New to Abii? "}
        <Link className="font-semibold text-[#B74672] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C65380]" href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}
