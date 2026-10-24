"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, FolderOpen, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Modal, modalCancelClass, modalDangerClass, modalPrimaryClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";

export type TopicItem = { id: string; subjectId: string; name: string; description: string; position: number; createdAt: string; updatedAt: string; flashcardCount: number; metrics?: { flashcardCount: number } };
type Editor = { mode: "create" | "edit"; topic?: TopicItem } | null;

function TopicForm({ subjectId, editor, onClose, onSaved }: { subjectId: string; editor: Editor; onClose: () => void; onSaved: (topic: TopicItem) => void }) {
  const [name, setName] = useState(editor?.topic?.name ?? "");
  const [description, setDescription] = useState(editor?.topic?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (!trimmed) return setError("Enter a topic name.");
    if (trimmed.length > 100) return setError("Topic names can be up to 100 characters.");
    if (description.length > 500) return setError("Descriptions can be up to 500 characters.");
    setSaving(true); setError("");
    try {
      const current = editor?.topic;
      const response = await fetch(current ? `/api/subjects/${subjectId}/topics/${current.id}` : `/api/subjects/${subjectId}/topics`, {
        method: current ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(current ? { "If-Match": `"${current.updatedAt}"` } : {}) },
        body: JSON.stringify({ name: trimmed, description: description.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.topic) throw new Error(data.error || "Could not save this topic.");
      onSaved(data.topic as TopicItem);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect. Please try again."); }
    finally { setSaving(false); }
  }
  return <Modal open onClose={onClose} action={editor?.mode === "edit" ? "update" : "create"} title={editor?.mode === "edit" ? "Edit topic" : "Create a topic"} description="Keep related flashcards together in this subject." busy={saving} footer={<><button type="button" disabled={saving} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="submit" form="topic-editor" disabled={saving} className={modalPrimaryClass}>{saving ? "Saving…" : editor?.mode === "edit" ? "Save changes" : "Create topic"}</button></>}>
    <form id="topic-editor" onSubmit={submit} className="space-y-4">
      <label htmlFor="topic-name" className="block text-sm font-semibold text-[#153B56]">Topic name <span className="text-[#E9577D]">*</span>
        <input id="topic-name" autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Cell biology" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 text-sm outline-none focus:border-[#FF6F96] focus:ring-4 focus:ring-[#FF6F96]/15" />
      </label>
      <label htmlFor="topic-description" className="block text-sm font-semibold text-[#153B56]">Description <span className="font-normal text-[#8A7E85]">(optional)</span>
        <textarea id="topic-description" maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will you study in this topic?" className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#FF6F96] focus:ring-4 focus:ring-[#FF6F96]/15" />
        <span className="mt-1 block text-right text-xs font-normal text-[#8A7E85]">{description.length}/500</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-[#FFF1F1] p-3 text-sm text-[#A43E5C]">{error}</p>}
    </form>
  </Modal>;
}

function DeleteTopicDialog({ subjectId, topic, otherTopics, onClose, onDeleted }: { subjectId: string; topic: TopicItem; otherTopics: TopicItem[]; onClose: () => void; onDeleted: (moved: number) => void }) {
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function remove() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/subjects/${subjectId}/topics/${topic.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "If-Match": `"${topic.updatedAt}"` },
        body: JSON.stringify({ confirm: true, ...(destination ? { destinationTopicId: destination } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete this topic.");
      onDeleted(Number(data.movedFlashcardCount ?? 0));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect. Please try again."); }
    finally { setSaving(false); }
  }
  const populated = topic.flashcardCount > 0;
  return <Modal open onClose={onClose} action="delete" alert title="Delete this topic?" description={populated ? `This topic has ${topic.flashcardCount} ${topic.flashcardCount === 1 ? "flashcard" : "flashcards"}. Choose another topic to keep them organized.` : "This empty topic will be removed. Your subject will stay as it is."} busy={saving} footer={<><button type="button" disabled={saving} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="button" disabled={saving || (populated && !destination)} onClick={remove} className={modalDangerClass}>{saving ? "Deleting…" : populated ? "Move cards and delete" : "Delete topic"}</button></>}>
    <div className="space-y-4">
      {populated ? <label htmlFor="topic-destination" className="block text-sm font-semibold text-[#153B56]">Move flashcards to
        <select id="topic-destination" value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3 text-sm">
          <option value="">Choose a topic…</option>{otherTopics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {!otherTopics.length && <span className="mt-2 block text-xs font-normal text-[#A43E5C]">Create another topic first. Flashcards cannot be deleted from this dialog.</span>}
      </label> : <p className="rounded-xl bg-[#FFF7F9] p-3 text-sm leading-6 text-[#756B72]">There are no flashcards to move. Only the topic will be deleted.</p>}
      {error && <p role="alert" className="rounded-xl bg-[#FFF1F1] p-3 text-sm text-[#A43E5C]">{error}</p>}
    </div>
  </Modal>;
}

function TopicCard({ topic, onEdit, onDelete }: { topic: TopicItem; onEdit: () => void; onDelete: () => void }) {
  return <article className="group min-w-0 rounded-2xl border border-[#F0E5E9] bg-white p-4 shadow-[0_2px_10px_rgba(92,49,66,.025)] transition hover:border-[#F3C4D3] hover:shadow-[0_8px_28px_rgba(92,49,66,.07)] sm:p-5">
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF0F5] text-[#E9577D]"><FolderOpen className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><h3 className="break-words font-bold text-[#153B56]">{topic.name}</h3>{topic.description && <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-[#756B72]">{topic.description}</p>}</div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F5EEF1] pt-3">
      <p className="text-sm font-medium text-[#756B72]">{topic.flashcardCount} {topic.flashcardCount === 1 ? "flashcard" : "flashcards"}</p>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Edit ${topic.name}`} onClick={onEdit} className="grid h-10 w-10 place-items-center rounded-lg text-[#8A6171] hover:bg-[#FFF0F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"><Pencil className="h-4 w-4" /></button>
        <button type="button" aria-label={`Delete ${topic.name}`} onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-lg text-[#A43E5C] hover:bg-[#FFF1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"><Trash2 className="h-4 w-4" /></button>
        <Link href={`/subjects/${topic.subjectId}/topics/${topic.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#FFF7F9] px-3 text-sm font-semibold text-[#C65380] transition hover:bg-[#FFE9F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">View topic <ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
      </div>
    </div>
  </article>;
}

export function TopicsSection({ subjectId }: { subjectId: string }) {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<TopicItem | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch(`/api/subjects/${subjectId}/topics`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.topics)) throw new Error(data.error || "Topics could not be loaded.");
      setTopics(data.topics as TopicItem[]);
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Topics could not be loaded."); }
    finally { setLoading(false); }
  }, [subjectId]);
  useEffect(() => { void load(); }, [load]);
  function saved(topic: TopicItem) {
    setTopics((current) => editor?.mode === "edit" ? current.map((item) => item.id === topic.id ? topic : item) : [...current, topic].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)));
    toast({ kind: "success", title: editor?.mode === "edit" ? "Topic updated" : "Topic created", message: `“${topic.name}” is ready.` });
    setEditor(null); router.refresh();
  }
  function removed(moved: number) {
    toast({ kind: "success", title: "Topic deleted", message: moved ? `${moved} flashcards were moved safely.` : "The empty topic was removed." });
    setDeleting(null); void load(); router.refresh();
  }
  return <section aria-labelledby="topics-heading" className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="topics-heading" className="text-lg font-bold tracking-[-0.035em] text-[#153B56]">Topics <span className="ml-1 text-sm font-medium text-[#8192A1]">{loading ? "…" : topics.length}</span></h2><p className="mt-1 text-sm text-[#71869A]">Group related flashcards to make each subject easier to explore.</p></div>
      <button type="button" onClick={() => setEditor({ mode: "create" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FF6F96] px-4 text-sm font-semibold text-white transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"><Plus aria-hidden="true" className="h-4 w-4" />Add topic</button>
    </div>
    {loading ? <div role="status" aria-label="Loading topics" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} aria-hidden="true" className="h-36 animate-pulse rounded-2xl border border-[#F0E5E9] bg-white p-5"><div className="h-10 w-10 rounded-xl bg-[#FFF0F5]"/><div className="mt-4 h-4 w-2/3 rounded bg-[#F4E9ED]"/><div className="mt-3 h-3 w-1/3 rounded bg-[#F4E9ED]"/></div>)}</div>
      : loadError ? <div role="alert" className="rounded-2xl border border-[#F0C7D3] bg-white p-6 text-center"><p className="font-semibold text-[#153B56]">Topics couldn’t load.</p><p className="mt-1 text-sm text-[#756B72]">{loadError}</p><button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#F0D5DE] px-4 text-sm font-semibold text-[#C65380] hover:bg-[#FFF7F9]"><RefreshCw aria-hidden="true" className="h-4 w-4" />Try again</button></div>
      : topics.length ? <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{topics.map((topic) => <TopicCard key={topic.id} topic={topic} onEdit={() => setEditor({ mode: "edit", topic })} onDelete={() => setDeleting(topic)} />)}</div>
      : <div className="rounded-2xl border border-dashed border-[#E8D7DE] bg-[#FFFCFD] px-5 py-10 text-center"><span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF0F5] text-[#E9577D]"><BookOpen className="h-7 w-7" /></span><h3 className="mt-4 font-bold text-[#153B56]">A new way to organize this subject</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#756B72]">Create a topic for a chapter or idea, then add flashcards right inside it. Your existing subject cards remain under All Flashcards.</p><button type="button" onClick={() => setEditor({ mode: "create" })} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FF6F96] px-4 text-sm font-semibold text-white hover:bg-[#E9577D]"><Plus aria-hidden="true" className="h-4 w-4" />Create your first topic</button></div>}
    {editor && <TopicForm subjectId={subjectId} editor={editor} onClose={() => setEditor(null)} onSaved={saved} />}
    {deleting && <DeleteTopicDialog subjectId={subjectId} topic={deleting} otherTopics={topics.filter((item) => item.id !== deleting.id)} onClose={() => setDeleting(null)} onDeleted={removed} />}
  </section>;
}
