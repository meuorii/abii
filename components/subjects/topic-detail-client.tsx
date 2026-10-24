"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Layers3, ListOrdered, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { FlashcardEditorModal, type EditableFlashcard, type FlashcardTopicOption } from "@/components/subjects/flashcard-editor-modal";
import { Modal, modalCancelClass, modalDangerClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";
import { MasteryPills } from "@/components/review/review-setup";
import type { MasteryStats, TypeProgress } from "@/lib/quiz/types";

type Card = EditableFlashcard;
type KindFilter = "all" | "standard" | "items";

export function TopicDetailClient({ subjectId, subjectName, topic, mastery, typeMastery, topicOptions, initialCards }: { subjectId: string; subjectName: string; topic: { id: string; name: string; count: number }; mastery: MasteryStats; typeMastery: TypeProgress; topicOptions: FlashcardTopicOption[]; initialCards: Card[] }) {
  const [cards, setCards] = useState(initialCards);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [editor, setEditor] = useState<"create" | Card | null>(null);
  const [viewing, setViewing] = useState<Card | null>(null);
  const [deleting, setDeleting] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const filtered = useMemo(() => cards.filter((card) => {
    const textMatches = `${card.question} ${card.answer} ${card.hint}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return textMatches && (kind === "all" || card.flashcardType === kind);
  }), [cards, kind, query]);
  function saved(card: Card) {
    if (card.topicId !== topic.id) {
      setCards((current) => current.filter((row) => row.id !== card.id));
    } else {
      setCards((current) => current.some((row) => row.id === card.id) ? current.map((row) => row.id === card.id ? card : row) : [card, ...current]);
    }
    setEditor(null); router.refresh();
  }
  async function removeCard() {
    if (!deleting) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/subjects/${subjectId}/flashcards/${deleting.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not delete this flashcard.");
      setCards((current) => current.filter((row) => row.id !== deleting.id));
      toast({ kind: "success", title: "Flashcard deleted", message: "Its review history was also removed." });
      setDeleting(null); router.refresh();
    } catch (cause) { toast({ kind: "error", title: "Could not delete flashcard", message: cause instanceof Error ? cause.message : "Please try again." }); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="topic-cards-heading" className="min-w-0 space-y-4">
    <section aria-label={`${topic.name} mastery summary`} className="rounded-2xl border border-[#F0E5E9] bg-white p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div><h2 className="text-sm font-bold text-[#153B56]">Topic mastery</h2><p className="mt-1 text-xs text-[#71869A]">A card is mastered after the required correct streak in every applicable mode and Mixed / Random.</p><div className="mt-3"><MasteryProgressBar label={`${topic.name} mastery progress`} mastered={mastery.mastered} total={mastery.total} usable={mastery.usable} progress={mastery.progress} size="md" /></div></div>
        <div className="sm:min-w-44"><p className="text-xs text-[#71869A]">Reviewed {mastery.reviewed}/{mastery.total} · Due {mastery.due}</p><p className="mt-1 text-xs text-[#71869A]">Correct answers {mastery.correct} · Incorrect {mastery.incorrect}</p></div>
      </div>
      <MasteryPills progress={typeMastery} className="mt-3 flex flex-wrap gap-1" />
    </section>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="topic-cards-heading" className="text-lg font-bold text-[#153B56]">Flashcards <span className="ml-1 text-sm font-medium text-[#8192A1]">{cards.length}</span></h2><p className="mt-1 text-sm text-[#71869A]">Search and manage cards in this topic.</p></div>
      <button type="button" onClick={() => setEditor("create")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FF6F96] px-4 text-sm font-semibold text-white transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"><Plus aria-hidden="true" className="h-4 w-4"/>Add flashcard</button>
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
      <label className="relative block min-w-0"><span className="sr-only">Search topic flashcards</span><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B9BAA]"/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search flashcards…" className="min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/15"/></label>
      <label className="sr-only" htmlFor="topic-card-filter">Filter flashcards</label><select id="topic-card-filter" value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} className="min-h-11 min-w-0 rounded-xl border border-[#E8E2E5] bg-white px-3 text-sm text-[#153B56] focus:border-[#E9577D] focus:outline-none focus:ring-4 focus:ring-[#FF9FBA]/15"><option value="all">All types</option><option value="standard">Standard</option><option value="items">Enumeration</option></select>
    </div>
    {cards.length === 0 ? <div className="rounded-2xl border border-dashed border-[#E8D7DE] bg-[#FFFCFD] px-5 py-10 text-center"><span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#FFF0F5] text-[#E9577D]"><Layers3 className="h-5 w-5"/></span><h3 className="mt-3 font-bold text-[#153B56]">No flashcards in this topic yet</h3><p className="mt-1 text-sm text-[#756B72]">Add a card here to keep it with “{topic.name}”.</p><button type="button" onClick={() => setEditor("create")} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FF6F96] px-4 text-sm font-semibold text-white hover:bg-[#E9577D]"><Plus aria-hidden="true" className="h-4 w-4"/>Add flashcard</button></div>
      : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-[#E8E2E5] bg-white px-4 py-9 text-center"><p className="font-semibold text-[#153B56]">No flashcards match these filters.</p><button type="button" onClick={() => { setQuery(""); setKind("all"); }} className="mt-2 min-h-10 text-sm font-semibold text-[#C65380] underline">Clear search and filters</button></div>
      : <ul className="min-w-0 overflow-hidden rounded-2xl border border-[#E8E2E5] bg-white">{filtered.map((card, index) => <li key={card.id} className={`flex min-w-0 flex-wrap items-center gap-2.5 px-3 py-3 sm:flex-nowrap sm:gap-3 sm:px-4 ${index ? "border-t border-[#F0EDF0]" : ""}`}>
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0F5] text-[#E9577D]">{card.flashcardType === "items" ? <ListOrdered className="h-4 w-4"/> : <Layers3 className="h-4 w-4"/>}</span>
        <div className="min-w-0 flex-1"><p className="line-clamp-2 break-words text-sm font-medium leading-5 text-[#294A60]">{card.question}</p><p className="mt-1 text-xs text-[#8B9BAA]">{card.flashcardType === "items" ? "Enumeration" : "Standard"}{card.reviewed ? " · Reviewed" : " · Not reviewed yet"}</p></div>
        <div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={`View ${card.question}`} onClick={() => setViewing(card)} className="grid h-10 w-10 place-items-center rounded-lg text-[#71869A] hover:bg-[#FFF0F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"><Eye aria-hidden="true" className="h-4 w-4"/></button><button type="button" aria-label={`Edit ${card.question}`} onClick={() => setEditor(card)} className="grid h-10 w-10 place-items-center rounded-lg text-[#C65380] hover:bg-[#FFF0F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"><Pencil aria-hidden="true" className="h-4 w-4"/></button><button type="button" aria-label={`Delete ${card.question}`} onClick={() => setDeleting(card)} className="grid h-10 w-10 place-items-center rounded-lg text-[#A43E5C] hover:bg-[#FFF1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"><Trash2 aria-hidden="true" className="h-4 w-4"/></button></div>
      </li>)}</ul>}
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F5DDE5] bg-[#FFF7F9] p-4"><div className="min-w-0"><h3 className="font-semibold text-[#153B56]">Ready to review?</h3><p className="mt-1 text-sm leading-5 text-[#71869A]">Topic-specific review is coming soon. Your subject review is available now.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled title="Topic-specific review is not available yet" className="inline-flex min-h-10 cursor-not-allowed items-center rounded-xl border border-[#F0CCD8] px-4 text-sm font-semibold text-[#9E8790] disabled:opacity-75">Review this topic</button><a href={`/review?subjectId=${subjectId}`} className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-[#F05B87] px-4 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Review subject</a></div></section>
    {editor && <FlashcardEditorModal key={typeof editor === "string" ? "new" : editor.id} subjectId={subjectId} subjectName={subjectName} topicId={typeof editor === "string" ? topic.id : undefined} topicOptions={topicOptions} initial={typeof editor === "string" ? undefined : editor} onClose={() => setEditor(null)} onSaved={(card) => saved(card)} />}
    {viewing && <Modal open onClose={() => setViewing(null)} action="view" title="Flashcard" description={viewing.flashcardType === "items" ? "Enumeration" : "Standard"} footer={<button type="button" onClick={() => setViewing(null)} className={modalCancelClass}>Close</button>}><div className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[#8A7E85]">Question</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#153B56]">{viewing.question}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-[#8A7E85]">Answer</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#153B56]">{viewing.answer}</p></div>{viewing.hint && <div><p className="text-xs font-bold uppercase tracking-wide text-[#8A7E85]">Hint</p><p className="mt-1 break-words text-sm text-[#526F83]">{viewing.hint}</p></div>}</div></Modal>}
    {deleting && <Modal open onClose={() => !busy && setDeleting(null)} action="delete" alert title="Delete this flashcard?" description="Its saved review history and active quiz questions will also be removed." busy={busy} footer={<><button type="button" disabled={busy} onClick={() => setDeleting(null)} className={modalCancelClass}>Cancel</button><button type="button" disabled={busy} onClick={() => void removeCard()} className={modalDangerClass}>{busy ? "Deleting…" : "Delete flashcard"}</button></>}><p className="break-words rounded-xl bg-[#FFF7F9] p-3 text-sm text-[#526F83]">{deleting.question}</p></Modal>}
  </section>;
}
