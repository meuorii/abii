"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { OtpInput } from "./otp-input";
import { Eye, EyeOff } from "lucide-react";

type Mode = "verify" | "forgot" | "reset";
const field = "mt-2 block min-h-12 w-full rounded-xl border border-[#E9DFE4] bg-white px-4 py-3 text-sm text-[#29252B] outline-none transition-[border-color,box-shadow,background-color] duration-200 focus:border-[#C65380] focus:ring-4 focus:ring-[#FCE7F3]";

export function AuthFlowForm({ mode, nextPath = "/dashboard" }: { mode: Mode; nextPath?: string }) {
  const router = useRouter(), { toast } = useToast();
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">(mode === "verify" ? "code" : mode === "reset" ? "done" : "email");
  const [stepChanged, setStepChanged] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [seconds, setSeconds] = useState(0), [show, setShow] = useState(false);

  useEffect(() => {
    if (mode !== "verify") return;
    fetch("/api/auth/verify-email/pending").then(r => r.json()).then(v => {
      if (v.verified) router.replace("/dashboard");
      else if (v.email) { setEmail(v.email); setSeconds(v.retryAfter || 0); }
      else setError("Your verification session expired. Please sign in again.");
    }).catch(() => setError("We couldn't load your verification session."));
  }, [mode, router]);

  useEffect(() => {
    if (mode === "forgot" && new URLSearchParams(window.location.search).get("expired") === "1") {
      setError("Your reset session expired or is invalid. Please request a new recovery code.");
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "forgot" && stepChanged && step === "email") emailInput.current?.focus();
  }, [mode, step, stepChanged]);

  useEffect(() => {
    if (mode !== "verify" && step !== "code") return;
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, mode, step]);

  async function call(url: string, payload: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "We couldn't complete that request.");
    return data;
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "verify") {
        if (code.length !== 6) throw new Error("Enter all six digits.");
        const result = await call("/api/auth/verify-email", { code, next: nextPath });
        toast({ kind: "success", title: "Email verified", message: "You can now continue learning." });
        router.replace(result.redirectTo || "/dashboard");
      } else if (mode === "forgot" && step === "email") {
        setCode("");
        await call("/api/auth/forgot-password", { email });
        setStep("code"); setStepChanged(true); setSeconds(60);
      } else if (mode === "forgot" && step === "code") {
        if (code.length !== 6) throw new Error("Enter all six digits.");
        await call("/api/auth/forgot-password/verify", { email, code });
        router.push("/reset-password");
      } else {
        await call("/api/auth/forgot-password/reset", { password, confirmPassword: confirm });
        toast({ kind: "success", title: "Password updated", message: "Please sign in again." });
        router.replace("/login");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError("");
    try {
      await call(mode === "verify" ? "/api/auth/verify-email/resend" : "/api/auth/forgot-password/resend", mode === "verify" ? {} : { email });
      setSeconds(60); setCode("");
      toast({ kind: "success", title: "Code sent", message: "Check your inbox." });
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }

  function changeEmail() { setCode(""); setError(""); setSeconds(0); setStep("email"); setStepChanged(true); }

  const stepKey = mode === "forgot" ? step : mode;
  const recoveryTransition = mode === "forgot" && stepChanged;
  const formStageClass = recoveryTransition ? "auth-flow-step-enter" : "";

  return <form onSubmit={submit} className={`auth-flow-form ${mode === "forgot" ? "min-h-[260px]" : ""}`} noValidate>
    <div key={stepKey} className={`space-y-5 ${formStageClass}`}>
      {mode === "verify" || (mode === "forgot" && step === "code") ? <>
        <p className={`text-sm leading-6 text-[#756B72] ${recoveryTransition ? "" : "abii-enter abii-enter-4"}`}>
          {mode === "verify" ? `We've sent a 6-digit verification code to ${email || "your email address"}.` : "Enter the 6-digit recovery code we sent to your email."}
        </p>
        <OtpInput value={code} onChange={setCode} disabled={busy} label={mode === "verify" ? "Verification code" : "Recovery code"} hasError={!!error} autoFocus={recoveryTransition} className={recoveryTransition ? "" : "auth-otp-enter"} />
        <p className={`text-center text-xs text-[#8B818A] ${recoveryTransition ? "" : "abii-enter auth-enter-5"}`}>This code expires in 10 minutes.</p>
        {mode === "forgot" && <button type="button" disabled={busy} onClick={changeEmail} className={`mx-auto block text-sm text-[#B74672] underline transition-colors duration-150 hover:text-[#923557] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C65380] disabled:opacity-60 ${recoveryTransition ? "" : "abii-enter auth-enter-6"}`}>Change email</button>}
      </> : mode === "forgot" ? <div className={`${recoveryTransition ? "" : "abii-enter abii-enter-4"}`}>
        <label htmlFor="email" className="text-sm font-semibold">Email address</label>
        <input ref={emailInput} id="email" className={field} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} required />
      </div> : <>
        <div className="abii-enter abii-enter-4">
          <label htmlFor="password" className="text-sm font-semibold">New password</label>
          <div className="relative">
            <input id="password" type={show ? "text" : "password"} autoComplete="new-password" className={`${field} pr-12`} value={password} onChange={e => setPassword(e.target.value)} minLength={8} maxLength={128} required />
            <button type="button" onClick={() => setShow(x => !x)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#827681] transition-colors duration-150 hover:text-[#C65380] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C65380]">
              <span key={show ? "visible" : "hidden"} className="auth-icon-swap">{show ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}</span>
            </button>
          </div>
        </div>
        <div className="abii-enter auth-enter-5">
          <label htmlFor="confirm" className="text-sm font-semibold">Confirm new password</label>
          <div className="relative">
            <input id="confirm" type={show ? "text" : "password"} autoComplete="new-password" className={`${field} pr-12`} value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} maxLength={128} required />
            <button type="button" onClick={() => setShow(x => !x)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#827681] transition-colors duration-150 hover:text-[#C65380] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C65380]">
              <span key={show ? "visible" : "hidden"} className="auth-icon-swap">{show ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}</span>
            </button>
          </div>
        </div>
      </>}

      {error && <p role="alert" aria-live="assertive" className="auth-error-enter rounded-lg border border-[#F1C9D4] bg-[#FFF4F6] px-3.5 py-3 text-sm text-[#963A55]">{error}</p>}
      <button type="submit" disabled={busy || ((mode === "verify" || step === "code") && code.length !== 6)} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C65380] px-5 py-3 text-sm font-bold text-white transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#AA416B] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F4C4D7] disabled:cursor-not-allowed disabled:opacity-60 ${recoveryTransition ? "" : mode === "forgot" ? "abii-enter auth-enter-5" : mode === "reset" ? "abii-enter auth-enter-6" : "abii-enter auth-enter-5"}`}>
        {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
        <span>{busy ? "Please wait…" : mode === "verify" ? "Verify Email" : mode === "forgot" ? step === "email" ? "Send Code" : "Verify Code" : "Reset Password"}</span>
      </button>
      {(mode === "verify" || (mode === "forgot" && step === "code")) && <div className={`text-center ${recoveryTransition ? "" : "abii-enter auth-enter-6"}`}>
        <button type="button" disabled={busy || seconds > 0} onClick={resend} className="text-sm font-semibold text-[#B74672] transition-colors duration-150 hover:text-[#923557] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C65380] disabled:text-[#AAA1A8]">
          {seconds > 0 ? `Resend code in ${seconds}s` : "Resend Code"}
        </button>
      </div>}
      <p className={`text-center text-sm text-[#77717A] ${recoveryTransition ? "" : mode === "forgot" ? "abii-enter auth-enter-6" : mode === "reset" ? "abii-enter auth-enter-7" : "abii-enter auth-enter-6"}`}>
        <Link href="/login" className="font-semibold text-[#B74672] underline-offset-4 transition-colors duration-150 hover:text-[#923557] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C65380]">Back to Login</Link>
      </p>
    </div>
  </form>;
}
