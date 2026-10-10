"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setErrors({});
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "Something went wrong. Please try again.");
        setErrors(result.errors || {});
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch {
      setMessage("We couldn't connect just now. Please try again.");
    } finally { setBusy(false); }
  }

  const fieldClass = "mt-1 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm outline-none transition focus:border-pink-active focus:ring-2 focus:ring-pink/60";
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {isRegister && <div>
        <label htmlFor="name" className="text-sm font-medium">Your name</label>
        <input id="name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={fieldClass} maxLength={80} required aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} />
        {errors.name && <p id="name-error" className="mt-1 text-sm text-red-700">{errors.name}</p>}
      </div>}
      <div>
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} maxLength={254} required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
        {errors.email && <p id="email-error" className="mt-1 text-sm text-red-700">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} className={fieldClass} minLength={isRegister ? 8 : undefined} maxLength={128} required aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : isRegister ? "password-help" : undefined} />
        {isRegister && <p id="password-help" className="mt-1 text-xs text-muted">Use 8–128 characters.</p>}
        {errors.password && <p id="password-error" className="mt-1 text-sm text-red-700">{errors.password}</p>}
      </div>
      {message && <p role="alert" className="rounded-xl bg-error px-3 py-2 text-sm text-red-800">{message}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-pink-primary px-4 py-3 font-semibold text-[#2F2930] transition hover:bg-pink-active hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-muted">
        {isRegister ? "Already have an account? " : "New to Abii? "}
        <Link className="font-semibold text-pink-active underline-offset-4 hover:underline" href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}
