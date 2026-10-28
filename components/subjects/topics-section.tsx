"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Ellipsis, FolderInput, FolderOpen, FolderPlus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Modal, modalCancelClass, modalDangerClass, modalPrimaryClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";

export type TopicItem = { id: string; subjectId: string; folderId?: string | null; name: string; description: string; position: number; createdAt: string; updatedAt: string; flashcardCount: number; usableFlashcardCount?: number; masteredCount?: number; completedRequirements?: number; totalRequirements?: number; progress?: number; metrics?: { flashcardCount: number; usableFlashcardCount?: number; reviewedFlashcardCount?: number; masteredFlashcardCount?: number; dueFlashcardCount?: number; correctAnswerCount?: number; incorrectAnswerCount?: number; completedRequirements?: number; totalRequirements?: number; masteryPercentage?: number } };
export type FolderItem = { id: string; name: string; description: string; position: number; updatedAt: string; topicCount: number; flashcardCount: number };
type Editor = { mode: "create" | "edit"; topic?: TopicItem; folderId?: string } | null;

function TopicForm({ subjectId, editor, folders, onClose, onSaved }: { subjectId: string; editor: Editor; folders: FolderItem[]; onClose: () => void; onSaved: (topic: TopicItem) => void }) {
  const [name, setName] = useState(editor?.topic?.name ?? "");
  const [description, setDescription] = useState(editor?.topic?.description ?? "");
  const [folderId, setFolderId] = useState(editor?.topic?.folderId ?? editor?.folderId ?? "");
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
        body: JSON.stringify({ name: trimmed, description: description.trim(), folderId: folderId || null }),
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
      <label htmlFor="topic-folder" className="block text-sm font-semibold text-[#153B56]">Folder (Optional)<select id="topic-folder" value={folderId} onChange={event => setFolderId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3 text-sm"><option value="">Unfiled Topics</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
      <label htmlFor="topic-description" className="block text-sm font-semibold text-[#153B56]">Description <span className="font-normal text-[#8A7E85]">(optional)</span>
        <textarea id="topic-description" maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will you study in this topic?" className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#FF6F96] focus:ring-4 focus:ring-[#FF6F96]/15" />
        <span className="mt-1 block text-right text-xs font-normal text-[#8A7E85]">{description.length}/500</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-[#FFF1F1] p-3 text-sm text-[#A43E5C]">{error}</p>}
    </form>
  </Modal>;
}

function FolderDialog({ subjectId, folder, deleting, onClose, onSaved }: { subjectId: string; folder?: FolderItem; deleting?: boolean; onClose: () => void; onSaved: (folder?: FolderItem) => void }) {
  const [name, setName] = useState(folder?.name ?? "");
  const [description, setDescription] = useState(folder?.description ?? "");
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); const normalized = name.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (!deleting && (!normalized || normalized.length > 100)) return setError("Use a folder name between 1 and 100 characters.");
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/subjects/${subjectId}/folders${folder ? `/${folder.id}` : ""}`, { method: deleting ? "DELETE" : folder ? "PATCH" : "POST", headers: { "Content-Type": "application/json", ...(folder ? { "If-Match": `"${folder.updatedAt}"` } : {}) }, body: JSON.stringify(deleting ? { confirm: true } : { name: normalized, description: description.trim() }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Could not save this folder."); onSaved(data.folder);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect. Please try again."); } finally { setSaving(false); }
  }
  return <Modal open onClose={onClose} action={deleting ? "delete" : folder ? "update" : "create"} alert={deleting} title={deleting ? "Delete Folder?" : folder ? "Edit Folder" : "Create Folder"} description={deleting ? folder?.topicCount ? `This folder contains ${folder.topicCount} topics. Deleting the folder will move all of its topics to Unfiled Topics. Your flashcards and study progress will be preserved.` : "This empty folder will be deleted." : folder ? "Update the folder name without affecting its topics." : "Organize your topics into a folder."} busy={saving} footer={<><button type="button" disabled={saving} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="submit" form="folder-form" disabled={saving || (!deleting && Boolean(folder) && name.trim() === folder?.name && description.trim() === folder?.description)} className={deleting ? modalDangerClass : modalPrimaryClass}>{saving ? "Saving…" : deleting ? "Delete Folder" : folder ? "Save Changes" : "Create Folder"}</button></>}>
    <form id="folder-form" onSubmit={submit} className="space-y-4">{deleting ? <p className="break-words font-semibold">{folder?.name}</p> : <label htmlFor="folder-name" className="block text-sm font-semibold text-[#153B56]">Folder Name *<input id="folder-name" autoComplete="off" autoFocus required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Prelims, Midterms, Finals" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 text-sm text-[#2F2930] outline-none transition-colors focus-visible:border-[#F05B87] focus-visible:ring-2 focus-visible:ring-[#F05B87]/20" /></label>}{!deleting && <label htmlFor="folder-description" className="block text-sm font-semibold text-[#153B56]">Description (Optional)<textarea id="folder-description" maxLength={500} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="What topics will you organize here?" className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] bg-white px-3.5 py-3 text-sm text-[#2F2930] outline-none transition-colors focus-visible:border-[#F05B87] focus-visible:ring-2 focus-visible:ring-[#F05B87]/20" /></label>}{error && <p role="alert" className="text-sm text-[#A43E5C]">{error}</p>}</form>
  </Modal>;
}

function MoveTopicDialog({ subjectId, topic, folders, onClose, onMoved }: { subjectId: string; topic: TopicItem; folders: FolderItem[]; onClose: () => void; onMoved: (destination: string) => void }) {
  const [destination, setDestination] = useState(topic.folderId ?? "");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function move() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/subjects/${subjectId}/topics/${topic.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "If-Match": `"${topic.updatedAt}"` }, body: JSON.stringify({ folderId: destination || null }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Could not move this topic.");
      onMoved(folders.find(folder => folder.id === destination)?.name ?? "Unfiled Topics");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect. Please try again."); } finally { setSaving(false); }
  }
  return <Modal open onClose={onClose} action="update" title="Move Topic" description="Choose where to organize this topic." busy={saving} footer={<><button type="button" disabled={saving} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="button" disabled={saving || destination === (topic.folderId ?? "")} onClick={move} className={modalPrimaryClass}>{saving ? "Moving..." : "Move Topic"}</button></>}><p className="break-words font-semibold">{topic.name}</p><label htmlFor="move-folder" className="mt-4 block text-sm font-semibold">Folder<select id="move-folder" value={destination} onChange={event => setDestination(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3"><option value="">Unfiled Topics</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>{error && <p role="alert" className="mt-3 text-sm text-[#A43E5C]">{error}</p>}</Modal>;
}

function DeleteTopicDialog({ subjectId, topic, otherTopics, onClose, onDeleted }: { subjectId: string; topic: TopicItem; otherTopics: TopicItem[]; onClose: () => void; onDeleted: (moved: number) => void }) {
  const [availableTopics, setAvailableTopics] = useState(otherTopics);
  const hasOtherTopics = otherTopics.length > 0;
  useEffect(() => {
    if (hasOtherTopics) return;
    let active = true;
    void fetch(`/api/subjects/${subjectId}/topics`, { cache: "no-store" }).then(response => response.json()).then(data => {
      if (active && Array.isArray(data.topics)) setAvailableTopics(data.topics.filter((item: TopicItem) => item.id !== topic.id));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [hasOtherTopics, subjectId, topic.id]);
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
          <option value="">Choose a topic…</option>{availableTopics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {!availableTopics.length && <span className="mt-2 block text-xs font-normal text-[#A43E5C]">Create another topic first. Flashcards cannot be deleted from this dialog.</span>}
      </label> : <p className="rounded-xl bg-[#FFF7F9] p-3 text-sm leading-6 text-[#756B72]">There are no flashcards to move. Only the topic will be deleted.</p>}
      {error && <p role="alert" className="rounded-xl bg-[#FFF1F1] p-3 text-sm text-[#A43E5C]">{error}</p>}
    </div>
  </Modal>;
}

function TopicCard({ topic, onEdit, onMove, onDelete }: { topic: TopicItem; onEdit: () => void; onMove: () => void; onDelete: () => void }) {
  return <article className="group min-w-0 rounded-2xl border border-[#F0E5E9] bg-white p-4 shadow-[0_2px_10px_rgba(92,49,66,.025)] transition hover:border-[#F3C4D3] hover:shadow-[0_8px_28px_rgba(92,49,66,.07)] sm:p-5">
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF0F5] text-[#E9577D]"><FolderOpen className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><h3 className="break-words font-bold text-[#153B56]">{topic.name}</h3>{topic.description && <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-[#756B72]">{topic.description}</p>}</div>
    </div>
    <div className="mt-3 space-y-3">
      <p className="text-sm font-medium text-[#756B72]">{topic.flashcardCount} {topic.flashcardCount === 1 ? "flashcard" : "flashcards"}</p>
      <MasteryProgressBar label="Mastery" ariaLabel={`${topic.name} mastery progress`} progress={topic.progress ?? topic.metrics?.masteryPercentage ?? 0} />
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Edit ${topic.name}`} onClick={onEdit} className="grid h-10 w-10 place-items-center rounded-lg text-[#8A6171] hover:bg-[#FFF0F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"><Pencil className="h-4 w-4" /></button>
        <button type="button" aria-label={`Move ${topic.name}`} onClick={onMove} className="grid h-11 w-11 place-items-center rounded-lg text-[#8A6171] hover:bg-[#FFF0F5] focus-visible:ring-2 focus-visible:ring-[#E9577D]"><FolderInput className="h-4 w-4" /></button><button type="button" aria-label={`Delete ${topic.name}`} onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-lg text-[#A43E5C] hover:bg-[#FFF1F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"><Trash2 className="h-4 w-4" /></button>
        <Link href={`/subjects/${topic.subjectId}/topics/${topic.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#FFF7F9] px-3 text-sm font-semibold text-[#C65380] transition hover:bg-[#FFE9F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">View topic <ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
      </div>
    </div>
  </article>;
}

export function TopicsSection({ subjectId, folderId }: { subjectId: string; folderId?: string }) {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<TopicItem | null>(null);
  const [moving, setMoving] = useState<TopicItem | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderDialog, setFolderDialog] = useState<{ folder?: FolderItem; deleting?: boolean } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const [response, folderResponse] = await Promise.all([fetch(`/api/subjects/${subjectId}/topics${folderId ? `?folderId=${folderId}` : ""}`, { cache: "no-store" }), fetch(`/api/subjects/${subjectId}/folders`, { cache: "no-store" })]);
      const data = await response.json().catch(() => ({}));
      const folderData = await folderResponse.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.topics)) throw new Error(data.error || "Topics could not be loaded.");
      if (!folderResponse.ok || !Array.isArray(folderData.folders)) throw new Error(folderData.error || "Folders could not be loaded.");
      setTopics(data.topics as TopicItem[]);
      setFolders(folderData.folders as FolderItem[]);
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Topics could not be loaded."); }
    finally { setLoading(false); }
  }, [subjectId, folderId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!folderId) return;
    const open = () => setEditor({ mode: "create", folderId: folderId === "unfiled" ? undefined : folderId });
    window.addEventListener("abii:add-folder-topic", open);
    return () => window.removeEventListener("abii:add-folder-topic", open);
  }, [folderId]);
  function saved(topic: TopicItem) {
    setTopics((current) => editor?.mode === "edit" ? current.map((item) => item.id === topic.id ? topic : item) : [...current, topic].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)));
    toast({ kind: "success", title: editor?.mode === "edit" ? "Topic updated" : "Topic created", message: `“${topic.name}” is ready.` });
    setEditor(null); void load(); router.refresh();
  }
  function removed(moved: number) {
    toast({ kind: "success", title: "Topic deleted", message: moved ? `${moved} flashcards were moved safely.` : "The empty topic was removed." });
    setDeleting(null); void load(); router.refresh();
  }
  async function reorder(folder: FolderItem, position: number) {
    try { const response = await fetch(`/api/subjects/${subjectId}/folders/${folder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "If-Match": `"${folder.updatedAt}"` }, body: JSON.stringify({ position }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); } catch (cause) { toast({ kind: "error", title: "Couldn’t move folder", message: cause instanceof Error ? cause.message : "Please try again." }); }
  }
  const query = search.trim().toLowerCase();
  const matching = (topic: TopicItem) => !query || topic.name.toLowerCase().includes(query) || topic.description.toLowerCase().includes(query);
  const cards = (items: TopicItem[]) => <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(topic => <TopicCard key={topic.id} topic={topic} onEdit={() => setEditor({ mode: "edit", topic })} onMove={() => setMoving(topic)} onDelete={() => setDeleting(topic)} />)}</div>;
  return <section aria-labelledby="topics-heading" className="min-w-0 space-y-5">
    {folderId && <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="topics-heading" className="text-lg font-bold text-[#153B56]">Topics</h2><p className="mt-1 text-sm text-[#71869A]">Manage and review topics in this folder.</p></div><button type="button" onClick={() => setEditor({ mode: "create", folderId: folderId === "unfiled" ? undefined : folderId })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FF6F96] px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Add Topic</button></div>}
    {!folderId && <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><h2 id="topics-heading" className="text-lg font-bold tracking-[-0.035em] text-[#153B56]">Folders &amp; Topics <span className="ml-1 text-sm font-medium text-[#8192A1]">{loading ? "…" : topics.length}</span></h2><p className="mt-1 text-sm text-[#71869A]">Organize your topics into folders to keep your study materials easy to find.</p></div>
      <button type="button" onClick={() => setFolderDialog({})} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#F0D5DE] px-4 text-sm font-semibold text-[#C65380] hover:bg-[#FFF7F9]"><FolderPlus aria-hidden="true" className="h-4 w-4" />New Folder</button>
    </div>}
    {!loading && !loadError && (topics.length > 0 || folders.length > 0) && <label className="block text-sm font-semibold text-[#153B56]">{folderId ? "Search topics" : "Search folders"}<input value={search} onChange={event => setSearch(event.target.value)} placeholder={folderId ? "Search topics..." : "Search folders..."} className="mt-1 block min-h-11 w-full rounded-xl border border-[#E8E2E5] px-3" /></label>}
    {loading ? <div role="status" aria-label="Loading topics" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} aria-hidden="true" className="h-36 animate-pulse rounded-2xl border border-[#F0E5E9] bg-white p-5"><div className="h-10 w-10 rounded-xl bg-[#FFF0F5]"/><div className="mt-4 h-4 w-2/3 rounded bg-[#F4E9ED]"/><div className="mt-3 h-3 w-1/3 rounded bg-[#F4E9ED]"/></div>)}</div>
      : loadError ? <div role="alert" className="rounded-2xl border border-[#F0C7D3] bg-white p-6 text-center"><p className="font-semibold text-[#153B56]">Topics couldn’t load.</p><p className="mt-1 text-sm text-[#756B72]">{loadError}</p><button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#F0D5DE] px-4 text-sm font-semibold text-[#C65380] hover:bg-[#FFF7F9]"><RefreshCw aria-hidden="true" className="h-4 w-4" />Try again</button></div>
      : folderId ? (topics.filter(matching).length ? cards(topics.filter(matching)) : topics.length ? <div className="rounded-xl border border-dashed p-6 text-center"><p>No matching topics found.</p><button onClick={() => setSearch("")} className="mt-2 min-h-11 text-sm font-semibold text-[#C65380] underline">Clear Search</button></div> : <div className="rounded-2xl border border-dashed border-[#E8D7DE] p-8 text-center"><p className="font-bold text-[#153B56]">No topics in this folder yet.</p><p className="mt-1 text-sm text-[#756B72]">Add your first topic to start organizing your lessons.</p><button onClick={() => setEditor({ mode: "create", folderId: folderId === "unfiled" ? undefined : folderId })} className="mt-4 min-h-11 rounded-full bg-[#FF6F96] px-5 text-sm font-semibold text-white">Add Topic</button></div>) : topics.length || folders.length ? <div className="space-y-4">{folders.map((folder, index) => { const folderMatch = query && folder.name.toLowerCase().includes(query); const items = topics.filter(topic => topic.folderId === folder.id && (folderMatch || matching(topic))); if (query && !folderMatch && !items.length) return null; const open = Boolean(query) || expanded[folder.id]; return <section key={folder.id} className="min-w-0 rounded-2xl border border-[#F0E5E9] bg-[#FFFCFD] p-3 sm:p-4"><div className="flex items-start gap-2"><button type="button" aria-expanded={open} aria-controls={`folder-${folder.id}`} onClick={() => setExpanded(current => ({ ...current, [folder.id]: !current[folder.id] }))} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left font-bold text-[#153B56]"><ChevronRight className={`h-5 w-5 shrink-0 ${open ? "rotate-90" : ""}`} /><FolderOpen className="h-5 w-5 shrink-0 text-[#E9577D]" /><span className="min-w-0 break-words">{folder.name}<span className="block text-xs font-normal text-[#71869A]">{folder.topicCount} topics · {folder.flashcardCount} flashcards</span></span></button><details className="relative"><summary aria-label={`Options for ${folder.name}`} className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-[#C65380]"><Ellipsis aria-hidden={true} className="h-5 w-5" /></summary><div className="absolute right-0 z-10 w-40 rounded-xl border bg-white p-1 shadow-lg">{[["Add Topic", () => setEditor({ mode: "create", folderId: folder.id })], ["Rename Folder", () => setFolderDialog({ folder })], ["Edit Description", () => setFolderDialog({ folder })], ["Move Folder Up", () => void reorder(folder, index - 1)], ["Move Folder Down", () => void reorder(folder, index + 1)], ["Delete Folder", () => setFolderDialog({ folder, deleting: true })]].map(([label, action], i) => <button key={String(label)} type="button" disabled={(i === 3 && index === 0) || (i === 4 && index === folders.length - 1)} onClick={action as () => void} className="block min-h-11 w-full rounded px-2 text-left text-sm hover:bg-[#FFF0F5] disabled:opacity-40">{label as string}</button>)}</div></details></div>{open && <div id={`folder-${folder.id}`} className="mt-3 space-y-3">{items.length ? cards(items) : <p className="text-sm text-[#71869A]">No topics yet. Add a topic to start organizing.</p>}<button type="button" onClick={() => setEditor({ mode: "create", folderId: folder.id })} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[#C65380] hover:bg-[#FFF0F5]">+ Add Topic</button></div>}</section>; })}{topics.filter(topic => !topic.folderId && matching(topic)).length > 0 && <section>{folders.length > 0 && <h3 className="mb-3 font-bold text-[#153B56]">Unfiled Topics</h3>}{cards(topics.filter(topic => !topic.folderId && matching(topic)))}</section>}{query && !folders.some(folder => folder.name.toLowerCase().includes(query) || topics.some(topic => topic.folderId === folder.id && matching(topic))) && !topics.some(topic => !topic.folderId && matching(topic)) && <div><p>No matching topics found.</p><button type="button" onClick={() => setSearch("")} className="min-h-11 text-[#C65380] underline">Clear search</button></div>}</div>
      : <div className="rounded-2xl border border-dashed border-[#E8D7DE] bg-[#FFFCFD] px-5 py-10 text-center"><span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF0F5] text-[#E9577D]"><BookOpen className="h-7 w-7" /></span><h3 className="mt-4 font-bold text-[#153B56]">A new way to organize this subject</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#756B72]">Create a topic for a chapter or idea, then add flashcards right inside it. Your existing subject cards remain under All Flashcards.</p><button type="button" onClick={() => setEditor({ mode: "create" })} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FF6F96] px-4 text-sm font-semibold text-white hover:bg-[#E9577D]"><Plus aria-hidden="true" className="h-4 w-4" />Create your first topic</button></div>}
    {editor && <TopicForm subjectId={subjectId} editor={editor} folders={folders} onClose={() => setEditor(null)} onSaved={saved} />}
    {folderDialog && <FolderDialog subjectId={subjectId} {...folderDialog} onClose={() => setFolderDialog(null)} onSaved={(createdFolder) => { if (!folderDialog.folder && createdFolder) setExpanded(current => ({ ...current, [createdFolder.id]: true })); toast({ kind: "success", title: folderDialog.deleting ? "Folder deleted" : folderDialog.folder ? "Folder renamed" : "Folder created", message: folderDialog.deleting ? "Your topics are now in Unfiled Topics." : "Your folder is ready." }); setFolderDialog(null); void load(); router.refresh(); }} />}
    {moving && <MoveTopicDialog subjectId={subjectId} topic={moving} folders={folders} onClose={() => setMoving(null)} onMoved={(destination) => { setMoving(null); toast({ kind: "success", title: "Topic moved", message: `Topic moved to ${destination}.` }); void load(); router.refresh(); }} />}
    {deleting && <DeleteTopicDialog subjectId={subjectId} topic={deleting} otherTopics={topics.filter((item) => item.id !== deleting.id)} onClose={() => setDeleting(null)} onDeleted={removed} />}
  </section>;
}
