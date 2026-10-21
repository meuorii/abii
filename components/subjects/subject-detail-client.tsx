"use client";

import Image from "next/image";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TypeProgress } from "@/lib/quiz/types";
import { MasteryPills } from "@/components/review/review-setup";
import { useToast } from "@/components/ui/toast-provider";

type FlashcardItem = { id: string; question: string; answer: string; hint: string; favorite: boolean; reviewed: boolean };
export type SubjectDetailData = {
  id: string; name: string; flashcardCount: number; reviewedCount: number; masteredCount: number; dueCount: number;
  progress: number; typeMastery: TypeProgress; correctCount: number; wrongCount: number; cards: FlashcardItem[];
};
type Tab = "flashcards" | "progress" | "settings";

function AddFlashcardModal({ subjectName, onClose, onCreated }: { subjectName: string; onClose: () => void; onCreated: (card: FlashcardItem) => void }) {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || !answer.trim()) {
      setError("Add both a question and an answer to continue.");
      toast({ kind: "error", title: "Question and answer required", message: "Fill in both fields before saving this flashcard." });
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/subjects/${encodeURIComponent(window.location.pathname.split("/").at(-1) || "")}/flashcards`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, hint }),
      });
      const result = await response.json() as { card?: FlashcardItem; error?: string };
      if (!response.ok || !result.card) { const message = result.error || "We couldn’t save your flashcard."; setError(message); toast({ kind: "error", title: "Couldn’t save flashcard", message }); return; }
      onCreated(result.card);
    } catch { setError("You seem to be offline. Check your connection and try again."); toast({ kind: "error", title: "Connection problem", message: "Your flashcard wasn’t saved. Check your connection and try again." }); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#2F2930]/40 p-3 backdrop-blur-[3px] sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="add-flashcard-title" className="my-auto w-full max-w-[590px] overflow-hidden rounded-[24px] border border-[#F0DCE3] bg-white shadow-[0_24px_80px_rgba(47,41,48,0.22)]">
        <div className="relative overflow-hidden border-b border-[#F4E7EC] bg-[#FFF7F9] px-5 py-5 sm:px-7 sm:py-6">
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close dialog" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#756B72] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">×</button>
          <div className="relative z-10 max-w-[72%]">
            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#C65380]">BUILD YOUR KNOWLEDGE</p>
            <h2 id="add-flashcard-title" className="mt-1.5 text-2xl font-bold tracking-[-0.045em] text-[#2F2930]">Add a flashcard</h2>
            <p className="mt-1.5 text-sm leading-5 text-[#756B72]">Create a question for <span className="font-semibold text-[#4A3B43]">{subjectName}</span> and practice recalling the answer.</p>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-2 right-2 h-[116px] w-[116px] opacity-90 sm:h-[138px] sm:w-[138px]">
            <Image src="/dashboard-hero/my-subjects.png" alt="" fill sizes="138px" className="object-contain object-bottom" />
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5 sm:space-y-5 sm:p-7">
          <div>
            <label htmlFor="flashcard-question" className="mb-1.5 block text-sm font-semibold text-[#2F2930]">Question <span className="text-[#E9577D]">*</span></label>
            <textarea ref={questionRef} autoFocus id="flashcard-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={3} placeholder="Write a question you want to remember..." className="w-full resize-y rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-3 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A79AA1] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20" required />
            <p className="mt-1 text-right text-[11px] text-[#9A8C93]">{question.length}/2000</p>
          </div>
          <div>
            <label htmlFor="flashcard-answer" className="mb-1.5 block text-sm font-semibold text-[#2F2930]">Answer <span className="text-[#E9577D]">*</span></label>
            <textarea id="flashcard-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={5000} rows={3} placeholder="Write the correct answer..." className="w-full resize-y rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-3 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A79AA1] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20" required />
          </div>
          <div>
            <label htmlFor="flashcard-hint" className="mb-1.5 block text-sm font-semibold text-[#2F2930]">Hint <span className="font-normal text-[#9A8C93]">(optional)</span></label>
            <input id="flashcard-hint" value={hint} onChange={(event) => setHint(event.target.value)} maxLength={1000} placeholder="Add a small clue to help you recall..." className="h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A79AA1] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20" />
          </div>
          {error && <p role="alert" className="rounded-xl border border-[#F0C7D3] bg-[#FFF1F1] px-3.5 py-3 text-sm text-[#A43E5C]">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#F1E8EC] pt-4 sm:flex-row sm:justify-end">
            <button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-full border border-[#E8E2E5] px-5 text-sm font-semibold text-[#756B72] transition-colors hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="min-h-11 rounded-full bg-[#FF6F96] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{saving ? "Saving..." : "Save Flashcard"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function IconCircle({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-lg font-semibold text-[#E9577D]">{children}</span>;
}

export function SubjectDetailClient({ initialData }: { initialData: SubjectDetailData }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>("flashcards");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [newName, setNewName] = useState(initialData.name);
  const [savingSettings, setSavingSettings] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const filteredCards = useMemo(() => data.cards.filter((card) => `${card.question} ${card.hint}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [data.cards, query]);

  function created(card: FlashcardItem) {
    setData((current) => ({ ...current, cards: [card, ...current.cards], flashcardCount: current.flashcardCount + 1, dueCount: current.dueCount + 1 }));
    setModalOpen(false);
    setNotice("Flashcard added to your subject.");
    toast({ kind: "success", title: "Flashcard created", message: "Your new question has been added to this subject." });
    setQuery("");
    router.refresh();
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) { setError("Subject name can’t be empty."); toast({ kind: "error", title: "Subject name required", message: "Enter a subject name before saving." }); return; }
    setSavingSettings(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/subjects/${data.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() }) });
      const result = await response.json() as { name?: string; error?: string };
      if (!response.ok || !result.name) { const message = result.error || "Could not update the subject."; setError(message); toast({ kind: "error", title: "Couldn’t update subject", message }); return; }
      setData((current) => ({ ...current, name: result.name! }));
      setNewName(result.name);
      setNotice("Subject name updated.");
      toast({ kind: "success", title: "Subject updated", message: "Your subject name has been saved." });
      router.refresh();
    } catch { setError("Could not connect. Please try again."); toast({ kind: "error", title: "Connection problem", message: "Your changes weren’t saved. Please try again." }); }
    finally { setSavingSettings(false); }
  }

  async function deleteSubject() {
    const confirmed = window.confirm(`Delete “${data.name}” and its flashcards? This cannot be undone.`);
    if (!confirmed) return;
    setSavingSettings(true); setError("");
    try {
      const response = await fetch(`/api/subjects/${data.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) { const message = result.error || "Could not delete the subject."; setError(message); toast({ kind: "error", title: "Couldn’t delete subject", message }); return; }
      toast({ kind: "success", title: "Subject deleted", message: `${data.name} and its flashcards were deleted.` });
      router.push("/subjects");
      router.refresh();
    } catch { setError("Could not connect. Please try again."); toast({ kind: "error", title: "Connection problem", message: "The subject wasn’t deleted. Please try again." }); }
    finally { setSavingSettings(false); }
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#E8E2E5]" role="tablist" aria-label="Subject sections">
        {([ ["flashcards", "▤", "Flashcards"], ["progress", "⌁", "Study Progress"], ["settings", "⚙", "Settings"] ] as const).map(([value, icon, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setError(""); setNotice(""); }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${tab === value ? "border-[#E9577D] text-[#E9577D]" : "border-transparent text-[#71869A] hover:text-[#2F2930]"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E9577D]`}><span aria-hidden="true" className="text-base">{icon}</span>{label}</button>
        ))}
      </div>

      {notice && <p role="status" className="rounded-xl border border-[#CFE8D8] bg-[#EAF8F0] px-4 py-3 text-sm text-[#35664B]">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-[#F0C7D3] bg-[#FFF1F1] px-4 py-3 text-sm text-[#A43E5C]">{error}</p>}

      {tab === "flashcards" && <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_245px] xl:grid-cols-[minmax(0,1fr)_265px] 2xl:grid-cols-[minmax(0,1fr)_285px]">
        <section className="min-w-0" aria-labelledby="flashcards-heading">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 id="flashcards-heading" className="text-lg font-bold tracking-[-0.035em] text-[#173B52]">Flashcards <span className="ml-1 text-sm font-medium text-[#8192A1]">{data.flashcardCount}</span></h2><p className="mt-1 text-xs text-[#8192A1]">Practice recalling answers before revealing them.</p></div>
            <button type="button" onClick={() => { setNotice(""); setError(""); setModalOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#FF6F96] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:text-sm"><span aria-hidden="true">＋</span> Add Flashcard</button>
          </div>
          <div className="mb-3 relative">
            <label htmlFor="flashcard-search" className="sr-only">Search flashcards</label><span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B9BAA]">⌕</span>
            <input id="flashcard-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search flashcards..." className="h-10 w-full rounded-full border border-[#E8E2E5] bg-white pl-10 pr-4 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A79AA1] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20" />
          </div>
          {data.cards.length === 0 ? <div className="rounded-[20px] border border-dashed border-[#E8C8D3] bg-[#FFFCFD] px-5 py-8 text-center sm:py-10">
            <div className="relative mx-auto h-28 w-28"><Image src="/dashboard-hero/my-subjects.png" alt="Abii is ready to help you get started" fill sizes="112px" className="object-contain" /></div>
            <h3 className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#2F2930]">Your first flashcard starts here.</h3><p className="mt-1.5 text-sm text-[#756B72]">Add a question and start building your knowledge.</p>
            <button type="button" onClick={() => setModalOpen(true)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6F96] px-5 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">＋ Add Flashcard</button>
          </div> : filteredCards.length === 0 ? <div className="rounded-2xl border border-dashed border-[#E8E2E5] bg-white px-5 py-10 text-center"><p className="font-semibold text-[#2F2930]">No flashcards match “{query.trim()}”.</p><p className="mt-1 text-sm text-[#756B72]">Try another search or clear the field.</p><button type="button" onClick={() => setQuery("")} className="mt-3 text-sm font-semibold text-[#C65380] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Clear search</button></div> : <ul className="overflow-hidden rounded-[17px] border border-[#E8E2E5] bg-white">
            {filteredCards.map((card, index) => <li key={card.id} className={`flex min-w-0 items-center gap-3 px-3 py-3 sm:gap-3.5 sm:px-4 ${index ? "border-t border-[#F0EDF0]" : ""}`}>
              <IconCircle>{"Aa"}</IconCircle><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-medium leading-5 text-[#294A60] sm:text-sm">{card.question}</p><p className="mt-1 text-[10px] text-[#8B9BAA]">Identification{card.reviewed ? " · Reviewed" : " · Not reviewed yet"}</p></div>
              <a href={`/review?subjectId=${data.id}&flashcardId=${card.id}`} className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-[#F7D9E3] bg-[#FFF7F9] px-3 text-[11px] font-semibold text-[#E9577D] transition-colors hover:bg-[#FFE8EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Review</a><a href={`/review?subjectId=${data.id}&flashcardId=${card.id}`} aria-label={`Review ${card.question}`} className="hidden text-lg text-[#8B9BAA] hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] sm:block">›</a>
            </li>)}
          </ul>}
        </section>

        <aside className="space-y-3">
          <section className="rounded-[17px] border border-[#E8E2E5] bg-white p-3.5 sm:p-4">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#173B52]">Subject Overview</h3><button type="button" onClick={() => setTab("settings")} className="text-xs font-semibold text-[#E9577D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Edit</button></div>
            <div className="mt-3 space-y-2">
              <StatRow icon="▤" value={String(data.flashcardCount)} label="Total Flashcards" />
              <StatRow icon="◷" value={String(data.dueCount)} label="Due for Review" />
              <div className="rounded-xl bg-[#FFF7F9] p-3"><div className="flex items-center gap-2"><IconCircle>✓</IconCircle><div><p className="text-sm font-bold text-[#2F2930]">{data.progress}%</p><p className="text-[11px] text-[#71869A]">Mastery Progress</p></div></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EDEFF2]"><div className="h-full rounded-full bg-[#E9577D]" style={{ width: `${data.progress}%` }} /></div><p className="mt-2 text-[10px] text-[#71869A]">{data.masteredCount}/{data.flashcardCount} cards mastered</p></div>
              <MasteryPills progress={data.typeMastery} className="flex flex-wrap gap-2" />
              
            </div>
          </section>
          <section className="rounded-[17px] border border-[#F5DDE5] bg-[#FFF5F8] p-4">
            <div className="flex items-start gap-3"><div className="relative h-12 w-12 shrink-0"><Image src="/dashboard-hero/my-subjects.png" alt="" fill sizes="48px" className="object-contain" /></div><div><h3 className="text-sm font-bold text-[#2F2930]">Review Reminder</h3><p className="mt-1 text-xs leading-5 text-[#71869A]">{data.dueCount ? `You have ${data.dueCount} ${data.dueCount === 1 ? "card" : "cards"} due. Keep up the great work!` : data.flashcardCount ? "You’re all caught up for now. Keep learning at your pace!" : "Add your first flashcard to begin reviewing."}</p></div></div>
            <a href={`/review?subjectId=${data.id}`} className="mt-3 flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#F05B87] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Start Review <span aria-hidden="true">→</span></a>
          </section>
        </aside>
      </div>}

      {tab === "progress" && <section aria-labelledby="progress-heading" className="space-y-4"><div><h2 id="progress-heading" className="text-lg font-bold tracking-[-0.035em] text-[#173B52]">Study Progress</h2><p className="mt-1 text-sm text-[#71869A]">A clear view of how much of this subject you’ve practiced.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Total flashcards" value={data.flashcardCount} detail="Cards in this subject"/><Metric title="Reviewed cards" value={data.reviewedCount} detail="Reviewed at least once"/><Metric title="Due for review" value={data.dueCount} detail="Ready for another practice"/><Metric title="Mastered cards" value={`${data.masteredCount}/${data.flashcardCount}`} detail="Every type + Random, 3 correct in a row"/></div>
        <div className="rounded-[18px] border border-[#E8E2E5] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold text-[#2F2930]">Mastery completion</h3><p className="mt-1 text-sm text-[#71869A]">{data.masteredCount} of {data.flashcardCount} cards mastered across every applicable question type and Mixed / Random.</p></div>{data.flashcardCount > 0 && data.masteredCount === data.flashcardCount && <span className="inline-flex items-center gap-1 rounded-full border border-[#F7C6D6] bg-[#FFF0F5] px-3 py-1.5 text-xs font-bold text-[#D94675]">✓ Mastered</span>}</div><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#F0F1F4]"><div className="h-full rounded-full bg-[#E9577D] transition-[width]" style={{ width: `${data.progress}%` }} /></div><MasteryPills progress={data.typeMastery} size="md" className="mt-4 flex flex-wrap gap-3" /><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#EAF8F0] p-4"><p className="text-xs text-[#4F7D62]">Correct review results</p><p className="mt-1 text-2xl font-bold text-[#35664B]">{data.correctCount}</p></div><div className="rounded-xl bg-[#FFF1F1] p-4"><p className="text-xs text-[#A45D6B]">Incorrect review results</p><p className="mt-1 text-2xl font-bold text-[#A43E5C]">{data.wrongCount}</p></div></div></div>
      </section>}

      {tab === "settings" && <section aria-labelledby="settings-heading" className="max-w-2xl space-y-4"><div><h2 id="settings-heading" className="text-lg font-bold tracking-[-0.035em] text-[#173B52]">Subject Settings</h2><p className="mt-1 text-sm text-[#71869A]">Manage the name and data for this subject.</p></div>
        <form onSubmit={saveName} className="rounded-[18px] border border-[#E8E2E5] bg-white p-5 sm:p-6"><label htmlFor="subject-name" className="block text-sm font-semibold text-[#2F2930]">Subject name</label><p className="mt-1 text-xs text-[#8192A1]">Use a clear name so it’s easy to find in your library.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="subject-name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={100} required className="h-11 min-w-0 flex-1 rounded-xl border border-[#E8E2E5] px-3.5 text-sm text-[#2F2930] outline-none focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20"/><button disabled={savingSettings} className="min-h-11 rounded-full bg-[#FF6F96] px-5 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">{savingSettings ? "Saving..." : "Save Changes"}</button></div></form>
        <div className="rounded-[18px] border border-[#F0C7D3] bg-white p-5 sm:p-6"><h3 className="font-bold text-[#9C3858]">Delete this subject</h3><p className="mt-1.5 text-sm leading-5 text-[#756B72]">This permanently deletes this subject, its flashcards, and their review history.</p><button type="button" disabled={savingSettings} onClick={deleteSubject} className="mt-4 min-h-10 rounded-full border border-[#E9B4C4] px-4 text-sm font-semibold text-[#B64162] transition-colors hover:bg-[#FFF1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">{savingSettings ? "Working..." : "Delete Subject"}</button></div>
      </section>}
      {modalOpen && <AddFlashcardModal subjectName={data.name} onClose={() => setModalOpen(false)} onCreated={created} />}
    </>
  );
}

function StatRow({ icon, value, label }: { icon: string; value: string; label: string }) {
  return <div className="flex items-center gap-2 rounded-xl bg-[#FFF7F9] p-2.5"><IconCircle>{icon}</IconCircle><div><p className="text-sm font-bold text-[#2F2930]">{value}</p><p className="text-[11px] text-[#71869A]">{label}</p></div></div>;
}
function Metric({ title, value, detail }: { title: string; value: number | string; detail: string }) {
  return <div className="rounded-[17px] border border-[#E8E2E5] bg-white p-4"><p className="text-xs font-medium text-[#71869A]">{title}</p><p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#173B52]">{value}</p><p className="mt-1 text-[11px] text-[#8192A1]">{detail}</p></div>;
}



