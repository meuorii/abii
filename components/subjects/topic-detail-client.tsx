"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Eye, Info, Layers3, ListOrdered, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { FlashcardEditorModal, type EditableFlashcard, type FlashcardTopicOption } from "@/components/subjects/flashcard-editor-modal";
import { Modal, modalCancelClass, modalDangerClass } from "@/components/ui/modal";
import { ModalButtonContent } from "@/components/ui/modal-button-content";
import { useToast } from "@/components/ui/toast-provider";
import { StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";
import { MasteryPills } from "@/components/review/review-setup";
import type { MasteryStats, TypeProgress } from "@/lib/quiz/types";
import { StudyStatistics } from "@/components/subjects/study-statistics";
import { Button, buttonClassNames } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import { parseEnumeration } from "@/lib/quiz/normalize";

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
  useEffect(() => setCards(initialCards), [initialCards]);
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
    <StudyStatistics label={`${topic.name} flashcard statistics`} columns={4} variant="topic-detail" items={[
      { label: "Total Flashcards", value: cards.length, detail: "Cards in this topic", icon: CreditCard },
      { label: "Standard", value: cards.filter(card => card.flashcardType === "standard").length, detail: "Single answers", icon: Layers3 },
      { label: "Enumeration", value: cards.filter(card => card.flashcardType === "items").length, detail: "Multiple items", icon: ListOrdered },
      { label: "Topic Mastery", value: `${mastery.progress}%`, detail: `${mastery.mastered} mastered`, progress: mastery.progress, headerAction: <details role="group" aria-label="Topic mastery details" className="group relative shrink-0">
        <summary aria-label="Show mastery statistics" title="Show mastery statistics" className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg text-primary hover:bg-secondary-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"><Info aria-hidden="true" className="h-[18px] w-[18px]" /></summary>
        <dl className="absolute right-0 top-full z-20 mt-1 grid w-[min(18rem,calc(100vw-2rem))] grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-border bg-surface p-3 text-xs leading-4 shadow-lg">
          <dt className="text-muted">Reviewed</dt><dd className="text-right font-medium text-foreground">{mastery.reviewed} / {mastery.total}</dd>
          <dt className="text-muted">Due</dt><dd className="text-right font-medium text-foreground">{mastery.due}</dd>
          <dt className="text-muted">Correct attempts</dt><dd className="text-right font-medium text-foreground">{mastery.correct}</dd>
          <dt className="text-muted">Incorrect attempts</dt><dd className="text-right font-medium text-foreground">{mastery.incorrect}</dd>
        </dl>
      </details>, supplementary: <MasteryPills progress={typeMastery} showUnavailable className="mt-2 flex flex-wrap gap-1" /> },
    ]} />
    <h2 id="topic-cards-heading" className="text-lg font-bold text-foreground">Flashcard Studio</h2>
    <div data-testid="topic-flashcard-toolbar" className="grid min-w-0 grid-cols-4 gap-3 sm:grid-cols-12">
      <label className="relative col-span-4 block min-w-0 sm:col-span-6"><span className="sr-only">Search topic flashcards</span><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search flashcards…" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-hover/15"/></label>
      <Link data-button-variant="outline" href={`/review/setup?subjectId=${encodeURIComponent(subjectId)}&topicId=${encodeURIComponent(topic.id)}`} className={`${buttonClassNames({ variant: "outline" })} col-span-2 min-w-0 whitespace-nowrap px-2 text-xs sm:col-span-3 sm:px-4 sm:text-sm`}>Study Topic <Link2 aria-hidden="true" className="h-4 w-4 shrink-0"/></Link>
      <Button data-button-variant="primary" type="button" onClick={() => setEditor("create")} className="col-span-2 min-w-0 whitespace-nowrap px-2 text-xs sm:col-span-3 sm:px-4 sm:text-sm"><Plus aria-hidden="true" className="h-4 w-4 shrink-0"/>Add Flashcard</Button>
    </div>
    <div role="group" aria-label="Filter flashcards by type" className="flex flex-wrap gap-2">{([ ["all", "All", cards.length], ["standard", "Standard", cards.filter(card => card.flashcardType === "standard").length], ["items", "Enumeration", cards.filter(card => card.flashcardType === "items").length] ] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${kind === value ? "border-primary bg-secondary-surface text-primary" : "border-border bg-surface text-muted hover:bg-background"}`}>{label} · {count}</button>)}</div>
    {cards.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center"><span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-secondary-surface text-primary"><Layers3 className="h-5 w-5"/></span><h3 className="mt-3 font-bold text-foreground">No flashcards in this topic yet</h3><p className="mt-1 text-sm text-muted">Add a card here to keep it with “{topic.name}”.</p><button type="button" onClick={() => setEditor("create")} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"><Plus aria-hidden="true" className="h-4 w-4"/>Add flashcard</button></div>
      : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-9 text-center"><p className="font-semibold text-foreground">No flashcards match these filters.</p><button type="button" onClick={() => { setQuery(""); setKind("all"); }} className="mt-2 min-h-10 text-sm font-semibold text-primary underline">Clear search and filters</button></div>
      : <StaggerContainer as="ul" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">{filtered.map((card, index) => <StaggerItem key={card.id} as="li" index={index} className={`flex min-w-0 flex-wrap items-center gap-2.5 px-3 py-3 sm:flex-nowrap sm:gap-3 sm:px-4 ${index ? "border-t border-border" : ""}`}>
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-surface text-primary">{card.flashcardType === "items" ? <ListOrdered className="h-4 w-4"/> : <Layers3 className="h-4 w-4"/>}</span>
        <div className="min-w-0 flex-1"><p className="line-clamp-2 break-words text-sm font-medium leading-5 text-foreground">{card.question}</p><p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted">{card.answer}</p><p className="mt-1 text-xs text-muted">{card.flashcardType === "items" ? "Enumeration" : "Standard"}{card.reviewed ? " · Reviewed" : " · Not reviewed yet"}</p></div>
        <div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={`View ${card.question}`} onClick={() => setViewing(card)} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-secondary-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"><Eye aria-hidden="true" className="h-4 w-4"/></button><button type="button" aria-label={`Edit ${card.question}`} onClick={() => setEditor(card)} className="grid h-10 w-10 place-items-center rounded-lg text-primary hover:bg-secondary-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"><Pencil aria-hidden="true" className="h-4 w-4"/></button><button type="button" aria-label={`Delete ${card.question}`} onClick={() => setDeleting(card)} className="grid h-10 w-10 place-items-center rounded-lg text-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"><Trash2 aria-hidden="true" className="h-4 w-4"/></button></div>
      </StaggerItem>)}</StaggerContainer>}
    {editor && <FlashcardEditorModal key={typeof editor === "string" ? "new" : editor.id} subjectId={subjectId} subjectName={subjectName} topicId={topic.id} topicOptions={topicOptions} initial={typeof editor === "string" ? undefined : editor} onClose={() => setEditor(null)} onSaved={(card) => saved(card)} />}
    {viewing && <Modal open onClose={() => setViewing(null)} action="view" title="Flashcard Details" description="Review this flashcard's type, question, answer, and hint."><div className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-wide text-muted">Flashcard Type</p><p className="mt-1 text-sm text-foreground">{viewing.flashcardType === "items" ? "Enumeration" : "Standard"}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted">Topic</p><p className="mt-1 text-sm text-foreground">{viewing.topicName ?? topic.name}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted">Question</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{viewing.question}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted">{viewing.flashcardType === "items" ? "Enumeration Answers" : "Answer"}</p>{viewing.flashcardType === "items" ? <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6 text-foreground">{parseEnumeration(viewing.answer).map((item,index)=><li key={index} className="break-words">{item}</li>)}</ol> : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{viewing.answer}</p>}</div>{viewing.hint && <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Hint</p><p className="mt-1 break-words text-sm text-muted">{viewing.hint}</p></div>}</div></Modal>}
    {deleting && <Modal open onClose={() => !busy && setDeleting(null)} action="delete" alert title="Delete this flashcard?" description="Its saved review history and active quiz questions will also be removed." busy={busy} footer={<><button type="button" disabled={busy} onClick={() => setDeleting(null)} className={modalCancelClass}>Cancel</button><button type="button" disabled={busy} onClick={() => void removeCard()} className={modalDangerClass}><ModalButtonContent loading={busy} label="Delete flashcard" loadingLabel="Deleting…" /></button></>}><p className="break-words rounded-xl bg-background p-3 text-sm text-muted">{deleting.question}</p></Modal>}
  </section>;
}
