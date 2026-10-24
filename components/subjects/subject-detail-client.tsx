"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TypeProgress } from "@/lib/quiz/types";
import { MasteryPills } from "@/components/review/review-setup";
import { useToast } from "@/components/ui/toast-provider";
import { Modal, modalCancelClass, modalPrimaryClass, modalDangerClass } from "@/components/ui/modal";
import { FlashcardEditorModal, type EditableFlashcard } from "@/components/subjects/flashcard-editor-modal";
import { Eye, Pencil, Trash2, Search, Layers3, ListOrdered, Plus, BookOpen, Clock3, ArrowRight, ChartNoAxesColumn, Settings } from "lucide-react";
import { parseEnumeration } from "@/lib/quiz/normalize";
import { TopicsSection } from "@/components/subjects/topics-section";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";

type FlashcardItem = EditableFlashcard;
export type SubjectDetailData = {
  id: string; name: string; flashcardCount: number; reviewedCount: number; masteredCount: number; dueCount: number;
  progress: number; usableCount: number; completedRequirements: number; totalRequirements: number; typeMastery: TypeProgress; correctCount: number; wrongCount: number; cards: FlashcardItem[]; topics: { id: string; name: string }[];
};
type Tab = "topics" | "flashcards" | "progress" | "settings";


function IconCircle({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-lg font-semibold text-[#E9577D]">{children}</span>;
}

export function SubjectDetailClient({ initialData }: { initialData: SubjectDetailData }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>("topics");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardItem | null>(null);
  const [viewingCard, setViewingCard] = useState<FlashcardItem | null>(null);
  const [deletingCard, setDeletingCard] = useState<FlashcardItem | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [newName, setNewName] = useState(initialData.name);
  const [savingSettings, setSavingSettings] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => { setData(initialData); setNewName(initialData.name); }, [initialData]);

  const filteredCards = useMemo(() => data.cards.filter((card) => {
    const matchesText = `${card.question} ${card.answer} ${card.hint} ${card.topicName ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matchesText && (topicFilter === "all" || (topicFilter === "unassigned" ? !card.topicId : card.topicId === topicFilter));
  }), [data.cards, query, topicFilter]);

  function savedCard(card: FlashcardItem, resetMastery: boolean) {
    const exists = data.cards.some((current) => current.id === card.id);
    setData((current) => ({ ...current, cards: exists ? current.cards.map((item) => item.id === card.id ? card : item) : [card, ...current.cards], flashcardCount: exists ? current.flashcardCount : current.flashcardCount + 1, reviewedCount: resetMastery ? Math.max(0, current.reviewedCount - 1) : current.reviewedCount }));
    setModalOpen(false); setEditingCard(null); setQuery(""); router.refresh();
  }

  async function deleteFlashcard() {
    if (!deletingCard) return;
    setSavingSettings(true);
    try {
      const response = await fetch(`/api/subjects/${data.id}/flashcards/${deletingCard.id}`, { method: "DELETE" });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not delete flashcard.");
      setData((current) => ({ ...current, cards: current.cards.filter((card) => card.id !== deletingCard.id), flashcardCount: Math.max(0, current.flashcardCount - 1), reviewedCount: deletingCard.reviewed ? Math.max(0, current.reviewedCount - 1) : current.reviewedCount }));
      toast({ kind: "success", title: "Flashcard deleted", message: "Its review history was also removed." }); setDeletingCard(null); router.refresh();
    } catch (cause) { toast({ kind: "error", title: "Could not delete flashcard", message: cause instanceof Error ? cause.message : "Please try again." }); }
    finally { setSavingSettings(false); }
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
      setUpdateOpen(false);
      setNotice("Subject name updated.");
      toast({ kind: "success", title: "Subject updated", message: "Your subject name has been saved." });
      router.refresh();
    } catch { setError("Could not connect. Please try again."); toast({ kind: "error", title: "Connection problem", message: "Your changes weren’t saved. Please try again." }); }
    finally { setSavingSettings(false); }
  }

  async function deleteSubject() {
setSavingSettings(true); setError("");
    try {
      const response = await fetch(`/api/subjects/${data.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) { const message = result.error || "Could not delete the subject."; setError(message); toast({ kind: "error", title: "Couldn’t delete subject", message }); return; }
      setDeleteOpen(false);
      toast({ kind: "success", title: "Subject deleted", message: `${data.name} and its flashcards were deleted.` });
      router.push("/subjects");
      router.refresh();
    } catch { setError("Could not connect. Please try again."); toast({ kind: "error", title: "Connection problem", message: "The subject wasn’t deleted. Please try again." }); }
    finally { setSavingSettings(false); }
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#E8E2E5]" role="tablist" aria-label="Subject sections">
        {([ ["topics", BookOpen, "Topics"], ["flashcards", Layers3, "All Flashcards"], ["progress", ChartNoAxesColumn, "Progress"], ["settings", Settings, "Settings"] ] as const).map(([value, Icon, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setError(""); setNotice(""); }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${tab === value ? "border-[#E9577D] text-[#E9577D]" : "border-transparent text-[#71869A] hover:text-[#2F2930]"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E9577D]`}><Icon aria-hidden="true" className="h-4 w-4" />{label}</button>
        ))}
      </div>

      {tab === "topics" && <TopicsSection subjectId={data.id} />}

      {notice && <p role="status" className="rounded-xl border border-[#CFE8D8] bg-[#EAF8F0] px-4 py-3 text-sm text-[#35664B]">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-[#F0C7D3] bg-[#FFF1F1] px-4 py-3 text-sm text-[#A43E5C]">{error}</p>}

      {tab === "flashcards" && <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_245px] xl:grid-cols-[minmax(0,1fr)_265px] 2xl:grid-cols-[minmax(0,1fr)_285px]">
        <section className="min-w-0" aria-labelledby="flashcards-heading">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 id="flashcards-heading" className="text-lg font-bold tracking-[-0.035em] text-[#173B52]">Flashcards <span className="ml-1 text-sm font-medium text-[#8192A1]">{data.flashcardCount}</span></h2><p className="mt-1 text-xs text-[#8192A1]">Practice recalling answers before revealing them.</p></div>
            <button type="button" onClick={() => { setNotice(""); setError(""); if (data.topics.length) setModalOpen(true); else setTab("topics"); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#FF6F96] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:text-sm"><Plus className="h-4 w-4"/> {data.topics.length ? "Add Flashcard" : "Create a topic first"}</button>
          </div>
          <div className="mb-3 relative">
            <label htmlFor="flashcard-search" className="sr-only">Search flashcards</label><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B9BAA]" />
            <input id="flashcard-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search flashcards..." className="h-10 w-full rounded-full border border-[#E8E2E5] bg-white pl-10 pr-4 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A79AA1] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20" />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2"><label htmlFor="flashcard-topic-filter" className="text-xs font-semibold text-[#71869A]">Topic</label><select id="flashcard-topic-filter" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#E8E2E5] bg-white px-3 text-sm text-[#153B56] focus:border-[#E9577D] focus:outline-none focus:ring-2 focus:ring-[#FF9FBA]/20 sm:flex-none sm:min-w-48"><option value="all">All topics</option>{data.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}{data.cards.some((card) => !card.topicId) && <option value="unassigned">Unassigned (legacy)</option>}</select></div>
          {data.cards.length === 0 ? <div className="rounded-[20px] border border-dashed border-[#E8C8D3] bg-[#FFFCFD] px-5 py-8 text-center sm:py-10">
            <div className="relative mx-auto h-28 w-28"><Image src="/dashboard-hero/my-subjects.png" alt="Abii is ready to help you get started" fill sizes="112px" className="object-contain" /></div>
            <h3 className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#2F2930]">Your first flashcard starts here.</h3><p className="mt-1.5 text-sm text-[#756B72]">Add a question and start building your knowledge.</p>
            <button type="button" onClick={() => setModalOpen(true)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6F96] px-5 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">＋ Add Flashcard</button>
          </div> : filteredCards.length === 0 ? <div className="rounded-2xl border border-dashed border-[#E8E2E5] bg-white px-5 py-10 text-center"><p className="font-semibold text-[#2F2930]">No flashcards match “{query.trim()}”.</p><p className="mt-1 text-sm text-[#756B72]">Try another search or clear the field.</p><button type="button" onClick={() => setQuery("")} className="mt-3 text-sm font-semibold text-[#C65380] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Clear search</button></div> : <ul className="overflow-hidden rounded-[17px] border border-[#E8E2E5] bg-white">
            {filteredCards.map((card, index) => <li key={card.id} className={`flex min-w-0 flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:gap-3.5 sm:px-4 ${index ? "border-t border-[#F0EDF0]" : ""}`}>
              <IconCircle>{card.flashcardType === "items" ? <ListOrdered className="h-5 w-5"/> : <Layers3 className="h-5 w-5"/>}</IconCircle><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-medium leading-5 text-[#294A60] sm:text-sm">{card.question}</p><p className="mt-1 break-words text-[10px] text-[#8B9BAA]">{card.flashcardType === "items" ? "Enumeration" : "Standard"} · {card.topicName ?? "Unassigned (legacy)"}{card.reviewed ? " · Reviewed" : " · Not reviewed yet"}</p></div>
              <div className="flex gap-1"><button type="button" aria-label={`View ${card.question}`} onClick={() => setViewingCard(card)} className="rounded-lg p-2 text-[#7B6E76] hover:bg-[#FFF0F5]"><Eye className="h-4 w-4"/></button><button type="button" aria-label={`Edit ${card.question}`} onClick={() => setEditingCard(card)} className="rounded-lg p-2 text-[#D85E86] hover:bg-[#FFF0F5]"><Pencil className="h-4 w-4"/></button><button type="button" aria-label={`Delete ${card.question}`} onClick={() => setDeletingCard(card)} className="rounded-lg p-2 text-[#B8435D] hover:bg-[#FFF1F1]"><Trash2 className="h-4 w-4"/></button></div><a href={`/review?subjectId=${data.id}&flashcardId=${card.id}`} className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-[#F7D9E3] bg-[#FFF7F9] px-3 text-[11px] font-semibold text-[#E9577D]">Review</a>
            </li>)}
          </ul>}
        </section>

        <aside className="space-y-3">
          <section className="rounded-[17px] border border-[#E8E2E5] bg-white p-3.5 sm:p-4">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#173B52]">Subject Overview</h3><button type="button" onClick={() => setTab("settings")} className="text-xs font-semibold text-[#E9577D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Edit</button></div>
            <div className="mt-3 space-y-2">
              <StatRow icon={<BookOpen className="h-4 w-4"/>} value={String(data.flashcardCount)} label="Total Flashcards" />
              <StatRow icon={<Clock3 className="h-4 w-4"/>} value={String(data.dueCount)} label="Due for Review" />
              <div className="rounded-xl bg-[#FFF7F9] p-3"><MasteryProgressBar label={`${data.name} mastery progress`} mastered={data.masteredCount} total={data.flashcardCount} completedRequirements={data.completedRequirements} totalRequirements={data.totalRequirements} usable={data.usableCount} progress={data.progress} /></div>
              <MasteryPills progress={data.typeMastery} className="flex flex-wrap gap-2" />
              
            </div>
          </section>
          <section className="rounded-[17px] border border-[#F5DDE5] bg-[#FFF5F8] p-4">
            <div className="flex items-start gap-3"><div className="relative h-12 w-12 shrink-0"><Image src="/dashboard-hero/my-subjects.png" alt="" fill sizes="48px" className="object-contain" /></div><div><h3 className="text-sm font-bold text-[#2F2930]">Review Reminder</h3><p className="mt-1 text-xs leading-5 text-[#71869A]">{data.dueCount ? `You have ${data.dueCount} ${data.dueCount === 1 ? "card" : "cards"} due. Keep up the great work!` : data.flashcardCount ? "You’re all caught up for now. Keep learning at your pace!" : "Add your first flashcard to begin reviewing."}</p></div></div>
            <a href={`/review?subjectId=${data.id}`} className="mt-3 flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#F05B87] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Start Review <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
          </section>
        </aside>
      </div>}

      {tab === "progress" && <section aria-labelledby="progress-heading" className="space-y-4"><div><h2 id="progress-heading" className="text-lg font-bold tracking-[-0.035em] text-[#173B52]">Study Progress</h2><p className="mt-1 text-sm text-[#71869A]">A clear view of how much of this subject you’ve practiced.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Total flashcards" value={data.flashcardCount} detail="Cards in this subject"/><Metric title="Reviewed cards" value={data.reviewedCount} detail="Reviewed at least once"/><Metric title="Due for review" value={data.dueCount} detail="Ready for another practice"/><Metric title="Mastered cards" value={`${data.masteredCount}/${data.flashcardCount}`} detail="Every type + Random, 3 correct in a row"/></div>
        <div className="rounded-[18px] border border-[#E8E2E5] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold text-[#2F2930]">Mastery completion</h3><p className="mt-1 text-sm text-[#71869A]">{data.masteredCount} of {data.flashcardCount} cards mastered across every applicable question type and Mixed / Random.</p></div>{data.flashcardCount > 0 && data.masteredCount === data.flashcardCount && <span className="inline-flex items-center gap-1 rounded-full border border-[#F7C6D6] bg-[#FFF0F5] px-3 py-1.5 text-xs font-bold text-[#D94675]">✓ Mastered</span>}</div><div className="mt-4"><MasteryProgressBar label={`${data.name} mastery completion`} mastered={data.masteredCount} total={data.flashcardCount} usable={data.usableCount} progress={data.progress} size="md" /></div><MasteryPills progress={data.typeMastery} size="md" className="mt-4 flex flex-wrap gap-3" /><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#EAF8F0] p-4"><p className="text-xs text-[#4F7D62]">Correct review results</p><p className="mt-1 text-2xl font-bold text-[#35664B]">{data.correctCount}</p></div><div className="rounded-xl bg-[#FFF1F1] p-4"><p className="text-xs text-[#A45D6B]">Incorrect review results</p><p className="mt-1 text-2xl font-bold text-[#A43E5C]">{data.wrongCount}</p></div></div></div>
      </section>}

      {tab === "settings" && <section aria-labelledby="settings-heading" className="max-w-2xl space-y-4"><div><h2 id="settings-heading" className="text-lg font-bold tracking-[-0.035em] text-[#173B52]">Subject Settings</h2><p className="mt-1 text-sm text-[#71869A]">Manage the name and data for this subject.</p></div>
        <div className="rounded-[18px] border border-[#E8E2E5] bg-white p-5 sm:p-6"><p className="text-sm font-semibold text-[#2F2930]">{data.name}</p><button type="button" onClick={() => { setNewName(data.name); setUpdateOpen(true); }} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF6F96] px-4 text-sm font-semibold text-white"><Pencil className="h-4 w-4"/>Rename Subject</button></div>
        <div className="rounded-[18px] border border-[#F0C7D3] bg-white p-5 sm:p-6"><h3 className="font-bold text-[#9C3858]">Delete this subject</h3><p className="mt-1.5 text-sm leading-5 text-[#756B72]">This permanently deletes this subject, its flashcards, and their review history.</p><button type="button" disabled={savingSettings} onClick={() => setDeleteOpen(true)} className="mt-4 min-h-10 rounded-full border border-[#E9B4C4] px-4 text-sm font-semibold text-[#B64162] transition-colors hover:bg-[#FFF1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">{savingSettings ? "Working..." : "Delete Subject"}</button></div>
      </section>}
      <Modal open={updateOpen} onClose={() => { if (!savingSettings) setUpdateOpen(false); }} action="update" title="Update this subject" description="Make changes to the name of your study space." busy={savingSettings} footer={<><button type="button" disabled={savingSettings} onClick={() => setUpdateOpen(false)} className={modalCancelClass}>Cancel</button><button type="submit" form="update-subject-form" disabled={savingSettings} className={modalPrimaryClass}>{savingSettings ? "Saving..." : "Save Changes"}</button></>}><form id="update-subject-form" onSubmit={saveName}><label htmlFor="subject-name" className="block text-[13px] font-semibold">Subject Name *</label><input id="subject-name" value={newName} onChange={e=>setNewName(e.target.value)} maxLength={100} required className="mt-1.5 h-11 w-full rounded-xl border border-[#E8E2E5] px-3.5 text-sm"/>{error&&<p role="alert" className="mt-2 text-sm text-[#A43E5C]">{error}</p>}</form></Modal>
      {deleteOpen && <Modal open onClose={() => { if (!savingSettings) setDeleteOpen(false); }} action="delete" title="Delete this subject?" description="This action cannot be undone." busy={savingSettings} alert footer={<><button type="button" disabled={savingSettings} onClick={() => setDeleteOpen(false)} className={modalCancelClass}>Cancel</button><button type="button" disabled={savingSettings} onClick={() => void deleteSubject()} className={modalDangerClass}>{savingSettings ? "Deleting?" : "Delete Subject"}</button></>}><div className="space-y-3"><div className="rounded-xl bg-[#FFF7F9] p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#9A8C93]">Subject</p><p className="mt-1 font-semibold text-[#2F2930]">{data.name}</p><p className="mt-1 text-sm text-[#756B72]">{data.flashcardCount} {data.flashcardCount === 1 ? "flashcard" : "flashcards"}</p></div><p className="text-sm leading-6 text-[#756B72]">Deleting this subject also removes its topics, flashcards, review records, and active quiz sessions. Completed quiz history is kept.</p></div></Modal>}
      {modalOpen && <FlashcardEditorModal subjectId={data.id} subjectName={data.name} topicOptions={data.topics} onCreateTopic={() => { setModalOpen(false); setTab("topics"); }} onClose={() => setModalOpen(false)} onSaved={savedCard} />}
      {editingCard && <FlashcardEditorModal subjectId={data.id} subjectName={data.name} topicOptions={data.topics} onCreateTopic={() => { setEditingCard(null); setTab("topics"); }} initial={editingCard} onClose={() => setEditingCard(null)} onSaved={savedCard} />}
      <Modal open={Boolean(viewingCard)} onClose={() => setViewingCard(null)} action="view" title="Flashcard details" description="Review the full details of this flashcard." footer={<><button type="button" onClick={() => setViewingCard(null)} className={modalCancelClass}>Close</button><button type="button" onClick={() => { setEditingCard(viewingCard); setViewingCard(null); }} className="bg-[#FF6F96] text-white hover:bg-[#E9577D]">Edit Flashcard</button></>}>
        {viewingCard && <div className="space-y-3"><div className="rounded-xl bg-[#FFF7F9] p-4"><p className="text-xs font-semibold">Question</p><p className="mt-1 text-sm">{viewingCard.question}</p></div><div className="rounded-xl bg-[#FFF7F9] p-4"><p className="text-xs font-semibold">{viewingCard.flashcardType === "items" ? "Enumeration Answers" : "Answer"}</p>{viewingCard.flashcardType === "items" ? <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{parseEnumeration(viewingCard.answer).map((item,index)=><li key={index}>{item}</li>)}</ol> : <p className="mt-1 whitespace-pre-wrap text-sm">{viewingCard.answer}</p>}</div>{viewingCard.hint && <div className="rounded-xl border border-[#E8E2E5] p-4"><p className="text-xs font-semibold">Hint</p><p className="mt-1 whitespace-pre-wrap text-sm">{viewingCard.hint}</p></div>}<p className="text-xs text-[#756B72]">Type: {viewingCard.flashcardType === "items" ? "Enumeration" : "Standard"}</p></div>}
      </Modal>
      <Modal open={Boolean(deletingCard)} onClose={() => { if (!savingSettings) setDeletingCard(null); }} action="delete" title="Delete this flashcard?" description="This action cannot be undone." alert busy={savingSettings} footer={<><button type="button" disabled={savingSettings} onClick={() => setDeletingCard(null)} className={modalCancelClass}>Cancel</button><button type="button" disabled={savingSettings} onClick={() => void deleteFlashcard()} className={modalDangerClass}>{savingSettings ? "Deleting…" : "Delete Flashcard"}</button></>}><div className="rounded-xl bg-[#FFF7F9] p-4"><p className="text-xs font-semibold">Question</p><p className="mt-1 text-sm">{deletingCard?.question}</p><p className="mt-3 text-sm text-[#756B72]">The flashcard’s review history will also be removed.</p></div></Modal>
    </>
  );
}

function StatRow({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="flex items-center gap-2 rounded-xl bg-[#FFF7F9] p-2.5"><IconCircle>{icon}</IconCircle><div><p className="text-sm font-bold text-[#2F2930]">{value}</p><p className="text-[11px] text-[#71869A]">{label}</p></div></div>;
}
function Metric({ title, value, detail }: { title: string; value: number | string; detail: string }) {
  return <div className="rounded-[17px] border border-[#E8E2E5] bg-white p-4"><p className="text-xs font-medium text-[#71869A]">{title}</p><p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#173B52]">{value}</p><p className="mt-1 text-[11px] text-[#8192A1]">{detail}</p></div>;
}



