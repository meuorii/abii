"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

export function LogoutButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmOpen) return;

    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        setConfirmOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmOpen, busy]);

  function closeConfirmation() {
    if (busy) return;
    setConfirmOpen(false);
    window.requestAnimationFrame(() => logoutButtonRef.current?.focus());
  }

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
      router.refresh();
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
        ref={logoutButtonRef}
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-pink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-active disabled:opacity-60"
      >
        Log out
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#21151B]/45 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            // Keep the confirmation open when clicking the backdrop.
            if (event.target === event.currentTarget) event.preventDefault();
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            aria-describedby="logout-dialog-description"
            className="w-full max-w-[420px] rounded-[24px] border border-[#F3DDE5] bg-white p-6 shadow-[0_24px_80px_rgba(53,28,39,0.2)] sm:p-7"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0F4] text-2xl text-[#E9577D]" aria-hidden="true">
              ↪
            </div>

            <h2
              id="logout-dialog-title"
              className="mt-5 text-center text-xl font-bold tracking-tight text-[#2F2930]"
            >
              Log out of Abii?
            </h2>
            <p
              id="logout-dialog-description"
              className="mx-auto mt-2 max-w-[310px] text-center text-sm leading-6 text-[#756B72]"
            >
              Are you sure you want to end your current session? You’ll need to log in again to continue studying.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={closeConfirmation}
                disabled={busy}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#E8E2E5] bg-white px-4 py-2.5 text-sm font-semibold text-[#625760] transition hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Stay logged in
              </button>
              <button
                type="button"
                onClick={logout}
                disabled={busy}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E9577D] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#D94870] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy && (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                )}
                {busy ? "Signing out…" : "Yes, log out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
