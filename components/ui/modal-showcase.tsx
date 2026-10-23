"use client";
import { useState } from "react";
import { Modal, modalCancelClass, modalDangerClass, modalPrimaryClass, type ModalAction } from "@/components/ui/modal";

const examples: { action: ModalAction; title: string; description: string }[] = [
  { action: "create", title: "Create a subject", description: "Give your study materials a place to belong." },
  { action: "view", title: "Flashcard details", description: "Review the saved question, answer, and hint." },
  { action: "update", title: "Update this subject", description: "Make changes to keep your study space up to date." },
  { action: "delete", title: "Delete this subject?", description: "This action cannot be undone." },
  { action: "logout", title: "Leaving already?", description: "Are you sure you want to log out of Abii?" },
  { action: "information", title: "Your data, your choice", description: "A clear explanation of your available data controls." },
];
export function ModalShowcase() {
  const [active, setActive] = useState<(typeof examples)[number] | null>(null);
  return <section className="mt-12 space-y-5" aria-labelledby="modal-system-heading"><div><h2 id="modal-system-heading" className="text-xl font-bold text-foreground">Global Modal System</h2><p className="mt-1 text-sm text-muted">Thoughtful interactions, made a little friendlier.</p></div><div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-white p-5">{examples.map((item) => <button key={item.action} type="button" onClick={() => setActive(item)} className="rounded-xl border border-[#E8E2E5] bg-white px-4 py-2.5 text-sm font-semibold text-[#51464D] hover:bg-[#FFF7F9]">{item.action === "logout" ? "Logout confirmation" : `${item.action[0].toUpperCase()}${item.action.slice(1)} modal`}</button>)}</div><Modal open={active !== null} onClose={() => setActive(null)} action={active?.action ?? "information"} title={active?.title ?? "Example"} description={active?.description} alert={active?.action === "delete" || active?.action === "logout"} footer={<><button type="button" onClick={() => setActive(null)} className={modalCancelClass}>{active?.action === "information" || active?.action === "view" ? "Close" : "Cancel"}</button><button type="button" onClick={() => setActive(null)} className={active?.action === "delete" ? modalDangerClass : modalPrimaryClass}>{active?.action === "create" ? "Create Subject" : active?.action === "update" ? "Save Changes" : active?.action === "delete" ? "Delete Subject" : active?.action === "logout" ? "Log Out" : active?.action === "view" ? "Edit Flashcard" : "Got it"}</button></>}><div className="rounded-xl bg-[#FFF7F9] p-4 text-sm leading-6 text-[#756B72]">This is a visual example. It does not submit data or perform an application action.</div></Modal></section>;
}
