"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { OtpInput } from "./otp-input";
import { Eye, EyeOff } from "lucide-react";
type Mode = "verify" | "forgot" | "reset";
const field = "mt-2 block min-h-12 w-full rounded-xl border border-[#E9DFE4] bg-white px-4 py-3 text-sm text-[#29252B] outline-none focus:border-[#C65380] focus:ring-4 focus:ring-[#FCE7F3]";
export function AuthFlowForm({ mode, nextPath = "/dashboard" }: { mode: Mode; nextPath?: string }) {
  const router = useRouter(), { toast } = useToast();
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">(mode === "verify" ? "code" : mode === "reset" ? "done" : "email");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [seconds, setSeconds] = useState(0), [show, setShow] = useState(false);
  useEffect(() => { if (mode === "verify") fetch("/api/auth/verify-email/pending").then(r => r.json()).then(v => { if (v.verified) router.replace("/dashboard"); else if (v.email) { setEmail(v.email); setSeconds(v.retryAfter || 0); } else setError("Your verification session expired. Please sign in again."); }).catch(() => setError("We couldn't load your verification session.")); }, [mode, router]);
  useEffect(() => { if (mode !== "verify" && step !== "code") return; if (seconds <= 0) return; const timer = setTimeout(() => setSeconds(s => s - 1), 1000); return () => clearTimeout(timer); }, [seconds, mode, step]);
  async function call(url: string, payload: unknown) { const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.message || "We couldn't complete that request."); return data; }
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try {
    if (mode === "verify") { if (code.length !== 6) throw new Error("Enter all six digits."); const result = await call("/api/auth/verify-email", { code, next: nextPath }); toast({ kind: "success", title: "Email verified", message: "You can now continue learning." }); router.replace(result.redirectTo || "/dashboard"); }
    else if (mode === "forgot" && step === "email") { await call("/api/auth/forgot-password", { email }); setStep("code"); setSeconds(60); }
    else if (mode === "forgot" && step === "code") { if (code.length !== 6) throw new Error("Enter all six digits."); await call("/api/auth/forgot-password/verify", { email, code }); router.push("/reset-password"); }
    else { await call("/api/auth/forgot-password/reset", { password, confirmPassword: confirm }); toast({ kind: "success", title: "Password updated", message: "Please sign in again." }); router.replace("/login"); }
  } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); } }
  async function resend() { setBusy(true); setError(""); try { await call(mode === "verify" ? "/api/auth/verify-email/resend" : "/api/auth/forgot-password/resend", mode === "verify" ? {} : { email }); setSeconds(60); setCode(""); toast({ kind: "success", title: "Code sent", message: "Check your inbox." }); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="space-y-5" noValidate>
    {mode === "verify" || (mode === "forgot" && step === "code") ? <>
      <p className="text-sm leading-6 text-[#756B72]">{mode === "verify" ? `We've sent a 6-digit verification code to ${email || "your email address"}.` : "Enter the 6-digit recovery code we sent to your email."}</p>
      <OtpInput value={code} onChange={setCode} disabled={busy} label={mode === "verify" ? "Verification code" : "Recovery code"} />
      <p className="text-center text-xs text-[#8B818A]">This code expires in 10 minutes.</p>
      {mode === "forgot" && <button type="button" onClick={() => setStep("email")} className="block mx-auto text-sm text-[#B74672] underline">Change email</button>}
    </> : mode === "forgot" ? <div><label htmlFor="email" className="text-sm font-semibold">Email address</label><input id="email" className={field} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div> : <>
      {([ ["password", "New password", password, setPassword], ["confirm", "Confirm new password", confirm, setConfirm] ] as const).map(([id,label,value,setter]) => <div key={id}><label htmlFor={id} className="text-sm font-semibold">{label}</label><div className="relative"><input id={id} type={show ? "text" : "password"} autoComplete="new-password" className={`${field} pr-12`} value={value} onChange={e => setter(e.target.value)} minLength={8} maxLength={128} required/><button type="button" onClick={() => setShow(x => !x)} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 w-12 text-[#827681]">{show ? <EyeOff className="mx-auto h-5 w-5"/> : <Eye className="mx-auto h-5 w-5"/>}</button></div></div>)}
    </>}
    {error && <p role="alert" aria-live="assertive" className="rounded-lg border border-[#F1C9D4] bg-[#FFF4F6] px-3.5 py-3 text-sm text-[#963A55]">{error}</p>}
    <button type="submit" disabled={busy || ((mode === "verify" || step === "code") && code.length !== 6)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C65380] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>}{busy ? "Please wait…" : mode === "verify" ? "Verify Email" : mode === "forgot" ? step === "email" ? "Send Code" : "Verify Code" : "Reset Password"}</button>
    {(mode === "verify" || (mode === "forgot" && step === "code")) && <div className="text-center"><button type="button" disabled={busy || seconds > 0} onClick={resend} className="text-sm font-semibold text-[#B74672] disabled:text-[#AAA1A8]">{seconds > 0 ? `Resend code in ${seconds}s` : "Resend Code"}</button></div>}
    <p className="text-center text-sm text-[#77717A]"><Link href="/login" className="font-semibold text-[#B74672] underline-offset-4 hover:underline">Back to Login</Link></p>
  </form>;
}
