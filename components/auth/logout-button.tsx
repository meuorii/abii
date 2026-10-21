"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

export function LogoutButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      toast({ kind: "success", title: "Signed out", message: "You’ve safely signed out of Abii." });
      router.replace("/login");
      router.refresh();
    } catch {
      toast({ kind: "error", title: "Couldn’t sign out", message: "Please try again." });
    } finally { setBusy(false); }
  }
  return <button type="button" onClick={logout} disabled={busy} className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-pink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active disabled:opacity-60">{busy ? "Signing out…" : "Log out"}</button>;
}
