"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Folder, FolderOpen, Info, MoreHorizontal, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { AddSubjectModal, SubjectsClient, type SubjectItem } from "@/components/subjects/subjects-client";
import { SubjectFolderCreateModal } from "@/components/subjects/subject-folder-create-modal";
import { Modal, modalCancelClass, modalDangerClass, modalPrimaryClass } from "@/components/ui/modal";
import { ModalButtonContent } from "@/components/ui/modal-button-content";
import { useToast } from "@/components/ui/toast-provider";
import { ScrollReveal } from "@/components/motion/scroll-reveal";

export type SubjectFolderSummary = { id: string; name: string; description: string; position: number; updatedAt: string; subjectCount: number; topicCount: number; flashcardCount: number };

export function SubjectFoldersOverview({ initialFolders, initialUnfiledCount, initialUnfiledSubjects, initialLayout }: {
  initialFolders: SubjectFolderSummary[];
  initialUnfiledCount: number;
  initialUnfiledSubjects: SubjectItem[];
  initialLayout: "grid" | "list";
}) {
  const [folders, setFolders] = useState(initialFolders);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<SubjectFolderSummary | false>(false);
  const [deleting, setDeleting] = useState<SubjectFolderSummary | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; folderName: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => setFolders(initialFolders), [initialFolders]);
  useEffect(() => {
    const term = query.trim();
    if (!term) { setResults([]); setSearching(false); return; }
    let active = true;
    setResults([]);
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/subjects?q=${encodeURIComponent(term)}`);
        const data = await response.json();
        if (active && response.ok) setResults(data.subjects ?? []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  function edit(folder: SubjectFolderSummary) {
    setForm(folder); setName(folder.name); setDescription(folder.description); setError(""); setMenu(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/subject-folders/${form.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "If-Match": `"${form.updatedAt}"` },
        body: JSON.stringify({ name, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFolders(current => current.map(folder => folder.id === form.id ? { ...folder, ...data.folder } : folder));
      toast({ kind: "success", title: "Folder updated", message: name });
      setForm(false); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save folder.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/subject-folders/${deleting.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json", "If-Match": `"${deleting.updatedAt}"` },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFolders(current => current.filter(folder => folder.id !== deleting.id));
      setDeleting(null);
      toast({ kind: "success", title: "Folder deleted", message: `${data.movedSubjectCount} subjects moved to Unfiled Subjects.` });
      router.refresh();
    } catch (cause) {
      toast({ kind: "error", title: "Could not delete folder", message: cause instanceof Error ? cause.message : "Try again." });
    } finally { setBusy(false); }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const shownFolders = folders.filter(folder => `${folder.name} ${folder.description}`.toLowerCase().includes(normalizedQuery));

  return <>
    <div className="space-y-5">
      <section aria-label="Study library controls" className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
        <label className="relative block min-w-0 sm:col-span-6">
          <span className="sr-only">Search folders and subjects</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search folders or subjects..." className="min-h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary" />
        </label>
        <button type="button" onClick={() => setAddingFolder(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-primary hover:bg-background sm:col-span-3"><Plus aria-hidden="true" className="h-4 w-4 shrink-0" />New Folder</button>
        <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover sm:col-span-3"><Plus aria-hidden="true" className="h-4 w-4 shrink-0" />New Subject</button>
      </section>

      {normalizedQuery && <ScrollReveal className="max-w-xl overflow-hidden rounded-xl border border-border bg-surface">
        {searching && <p role="status" className="px-4 py-3 text-sm text-muted">Searching…</p>}
        {results.map(result => <Link key={result.id} href={`/subjects/${result.id}`} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-background"><span className="min-w-0 truncate text-sm font-semibold text-foreground">{result.name}</span><span className="shrink-0 text-xs text-muted">{result.folderName}</span></Link>)}
        {!searching && !results.length && <p className="px-4 py-3 text-sm text-muted">No matching subjects. <button type="button" onClick={() => setQuery("")} className="font-semibold text-primary">Clear search</button></p>}
      </ScrollReveal>}

      <section aria-labelledby="subject-folders-heading" className="space-y-3">
        <div><h2 id="subject-folders-heading" className="text-lg font-bold text-foreground">Collections</h2><p className="mt-1 text-sm text-muted">Folders keep related subjects together.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shownFolders.map(folder => <ScrollReveal key={folder.id}><article className="relative min-h-[168px] rounded-2xl border border-border bg-surface p-5">
            <button type="button" aria-label={`Options for ${folder.name}`} onClick={() => setMenu(menu === folder.id ? null : folder.id)} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-lg text-primary hover:bg-secondary-surface"><MoreHorizontal aria-hidden="true" /></button>
            {menu === folder.id && <div className="absolute right-3 top-12 z-10 rounded-xl border border-border bg-surface p-1 shadow-lg"><button type="button" onClick={() => edit(folder)} className="block min-h-10 px-3 text-sm text-foreground hover:bg-secondary-surface">Edit Folder</button><button type="button" onClick={() => { setDeleting(folder); setMenu(null); }} className="block min-h-10 px-3 text-sm text-primary hover:bg-secondary-surface">Delete Folder</button></div>}
            <Link href={`/subjects/folders/${folder.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"><span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-secondary-surface text-primary"><Folder /></span><h3 className="mt-3 break-words pr-8 font-bold text-foreground">{folder.name}</h3>{folder.description && <p className="mt-1 break-words text-xs text-muted">{folder.description}</p>}<p className="mt-2 text-xs text-muted">{folder.subjectCount} subjects · {folder.topicCount} topics · {folder.flashcardCount} flashcards</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Open Folder <FolderOpen aria-hidden="true" className="h-4 w-4" /></span></Link>
          </article></ScrollReveal>)}
          {!normalizedQuery && folders.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-border p-6 text-sm text-muted">No folders yet. You can keep subjects unfiled or create a folder.</p>}
          {normalizedQuery && !shownFolders.length && <p className="col-span-full rounded-2xl border border-dashed border-border p-6 text-sm text-muted">No folders match this search.</p>}
        </div>
        {normalizedQuery && <button type="button" onClick={() => setQuery("")} className="text-sm font-semibold text-primary underline">Clear Search</button>}
      </section>

      <div aria-hidden="true" className="border-t border-border" />

      <section data-testid="unfiled-subjects" aria-labelledby="unfiled-subjects-heading" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0"><h2 id="unfiled-subjects-heading" className="text-lg font-bold text-foreground">Unfiled Subjects <span className="ml-1 text-sm font-medium text-muted">{initialUnfiledCount}</span></h2><p className="mt-1 text-sm text-muted">Subjects not assigned to a folder.</p></div>
          <p className="flex min-w-0 items-start gap-2 text-xs leading-5 text-muted sm:max-w-[310px]"><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Move subjects into folders to keep your study space organized.</span></p>
        </div>
        <SubjectsClient initialSubjects={initialUnfiledSubjects} initialLayout={initialLayout} subjectFolderId={null} subjectFolders={folders} embedded queryOverride={query} onClearSearch={() => setQuery("")} />
      </section>
    </div>
    {addingFolder && <SubjectFolderCreateModal onClose={() => setAddingFolder(false)} onCreated={folder => { setFolders(current => [...current, folder]); setAddingFolder(false); }} />}
    {adding && <AddSubjectModal subjectFolders={folders} onClose={() => setAdding(false)} onCreated={(subject: SubjectItem) => { toast({ kind: "success", title: "Subject created", message: `${subject.name} is ready for your flashcards.` }); setAdding(false); }} />}
    {form !== false && <Modal open onClose={() => { if (!busy) setForm(false); }} action="update" title="Edit Folder" description="Organize related subjects into one folder." busy={busy} footer={<><button type="button" disabled={busy} onClick={() => setForm(false)} className={modalCancelClass}>Cancel</button><button type="submit" form="sf-form" disabled={busy} aria-busy={busy} className={modalPrimaryClass}><ModalButtonContent loading={busy} label="Save Changes" loadingLabel="Saving Changes…" /></button></>}>
      <form id="sf-form" onSubmit={save} className="space-y-4"><label className="block text-sm font-semibold">Folder Name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. 1st Year — 1st Semester" className="mt-1.5 min-h-11 w-full rounded-xl border border-border px-4 outline-none focus:border-primary" /></label><label className="block text-sm font-semibold">Description (Optional)<textarea maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="What subjects will you keep here?" className="mt-1.5 min-h-20 w-full rounded-xl border border-border p-3 outline-none focus:border-primary" /></label>{error && <p role="alert" className="text-sm text-error-text">{error}</p>}</form>
    </Modal>}
    {deleting && <Modal open onClose={() => { if (!busy) setDeleting(null); }} action="delete" title="Delete Folder?" description={`This folder contains ${deleting.subjectCount} subjects. Deleting it will move those subjects to Unfiled Subjects. Your topics, flashcards, and study progress will remain safe.`} busy={busy} footer={<><button type="button" disabled={busy} onClick={() => setDeleting(null)} className={modalCancelClass}>Cancel</button><button type="button" disabled={busy} onClick={() => void remove()} aria-busy={busy} className={modalDangerClass}><ModalButtonContent loading={busy} label="Delete Folder" loadingLabel="Deleting Folder…" /></button></>}><p className="text-sm">{deleting.name}</p></Modal>}
  </>;
}
