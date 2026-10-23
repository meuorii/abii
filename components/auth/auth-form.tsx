"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { safeNextPath } from "@/lib/auth/redirect";
import { Eye, EyeOff } from "lucide-react";

type Mode = "login" | "register";
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

function EyeIcon({ visible }: { visible: boolean }) {
  const Icon = visible ? EyeOff : Eye;
  return <Icon aria-hidden="true" className="h-5 w-5" />;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { toast } = useToast();
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
      setErrors({ email: "Enter a valid email address." }); toast({ kind: "error", title: "Check your email", message: "Enter a valid email address to continue." }); setBusy(false); return;
    }
    if (isRegister && name.trim().length < 2) {
      setErrors({ name: "Please enter your name (at least 2 characters)." }); toast({ kind: "error", title: "Name needed", message: "Enter your name using at least 2 characters." }); setBusy(false); return;
    }
    if (password.length < (isRegister ? 8 : 1)) {
      setErrors({ password: isRegister ? "Use at least 8 characters." : "Enter your password." }); toast({ kind: "error", title: "Check your password", message: isRegister ? "Use at least 8 characters." : "Enter your password to sign in." }); setBusy(false); return;
    }
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.message || "We couldn't sign you in just now. Check your details and try again.");
        setErrors(result.errors || {});
        toast({ kind: "error", title: isRegister ? "Account not created" : "Sign-in failed", message: result.message || "Please check your details and try again." });
        return;
      }
      toast({ kind: "success", title: isRegister ? "Welcome to Abii!" : "Welcome back!", message: isRegister ? "Your account is ready. Let’s start learning." : "You’ve signed in successfully." });
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNextPath(next));
    } catch {
      setMessage("We couldn't connect just now. Please try again in a moment.");
      toast({ kind: "error", title: "Connection problem", message: "Please check your connection and try again." });
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

