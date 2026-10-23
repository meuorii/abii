"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { Modal, modalCancelClass, modalPrimaryClass } from "@/components/ui/modal";

export function LogoutButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);


  function closeConfirmation() { if (!busy) setConfirmOpen(false); }

  async function logout() {
    if (busy) return;

    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");

      setConfirmOpen(false);
      toast({
        kind: "success",
        title: "Signed out",
        message: "You’ve safely signed out of Abii.",
      });
      router.replace("/login");
    } catch {
      toast({
        kind: "error",
        title: "Couldn’t sign out",
        message: "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-pink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active disabled:opacity-60"
      >
        Log out
      </button>

      <Modal open={confirmOpen} onClose={closeConfirmation} action="logout" title="Leaving already?" description="Are you sure you want to log out of Abii?" busy={busy} alert footer={<><button type="button" disabled={busy} onClick={closeConfirmation} className={modalCancelClass}>Cancel</button><button type="button" disabled={busy} onClick={logout} className={modalPrimaryClass}>{busy ? "Logging out?" : "Log Out"}</button></>}><p className="text-sm leading-6 text-[#756B72]">Your study progress is saved. You can sign in again anytime to continue learning.</p></Modal>
    </>
  );
}
