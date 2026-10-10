"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally { setBusy(false); }
  }
  return <button type="button" onClick={logout} disabled={busy} className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-pink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active disabled:opacity-60">{busy ? "Signing out…" : "Log out"}</button>;
}
