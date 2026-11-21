"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { safeAdminPath } from "@/lib/auth/redirect";

export function AdminMfaForm({ next }: { next: string }) {
  const field = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/admin-mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: field.current?.value.trim(), next }) });
      const result = await response.json();
      if (response.ok) { window.location.replace(safeAdminPath(result.redirectTo)); return; }
      setMessage(result.message || "Verification failed. Please try again.");
    } catch { setMessage("Could not connect. Please try again."); }
    finally { setBusy(false); field.current?.select(); field.current?.focus(); }
  }
  return <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
    <label className="block text-sm font-semibold" htmlFor="admin-code">Authenticator code</label>
    <input ref={field} id="admin-code" name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" aria-describedby={message ? "verification-error" : undefined} className="block min-h-12 w-full rounded-xl border border-border px-4 py-3 tracking-widest focus-visible:ring-2 focus-visible:ring-pink-primary" />
    {message && <p id="verification-error" role="alert" className="text-sm text-error">{message}</p>}
    <button disabled={busy} className="min-h-12 w-full rounded-xl bg-[#C65380] font-semibold text-white disabled:opacity-60">{busy ? "Verifying…" : "Verify code"}</button>
    <Link href="/login" className="block text-center text-sm text-[#B74672] underline">Return to sign in</Link>
  </form>;
}
