"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Ellipsis, FolderOpen, FolderPlus, LoaderCircle, Search } from "lucide-react";
import { Modal, modalCancelClass, modalDangerClass, modalPrimaryClass } from "@/components/ui/modal";
import { ModalButtonContent } from "@/components/ui/modal-button-content";
import { useToast } from "@/components/ui/toast-provider";
import type { FolderItem } from "./topics-section";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";
import { SkeletonRegion } from "@/components/ui/skeleton";
import { UnknownCollectionPlaceholder } from "@/components/ui/skeleton-collection";
import { isCollectionScopeLoaded } from "@/components/ui/collection-loading-state";

type Unfiled = { topicCount: number; flashcardCount: number };

export function FolderOverview({ subjectId }: { subjectId: string }) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [unfiled, setUnfiled] = useState<Unfiled>({ topicCount: 0, flashcardCount: 0 });
  const [loading, setLoading] = useState(true);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [loadErrorScope, setLoadErrorScope] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ folder?: FolderItem; deleting?: boolean } | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const loadedRef = useRef(false);
  const { toast } = useToast();

  const load = useCallback(async (background = false) => {
    controller.current?.abort();
    const currentController = new AbortController();
    controller.current = currentController;
    const currentRequest = ++requestId.current;
    if (!background || !loadedRef.current) setLoading(true);
    setLoadError("");
    setLoadErrorScope(null);
    try {
      const response = await fetch(`/api/subjects/${subjectId}/folders`, { cache: "no-store", signal: currentController.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.folders)) throw new Error(data.error || "Couldn't load topic folders. Try again.");
      if (currentRequest !== requestId.current) return;
      setFolders(data.folders);
      setUnfiled(data.unfiled ?? { topicCount: 0, flashcardCount: 0 });
      loadedRef.current = true;
      setLoadedScope(subjectId);
      setLoadErrorScope(null);
    } catch (cause) {
      if (currentController.signal.aborted || currentRequest !== requestId.current) return;
      setLoadError(cause instanceof Error ? cause.message : "Couldn't load topic folders. Try again.");
      setLoadErrorScope(subjectId);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadedRef.current = false;
    setFolders([]);
    setUnfiled({ topicCount: 0, flashcardCount: 0 });
    setQuery("");
    void load();
    return () => { controller.current?.abort(); requestId.current += 1; };
  }, [load]);

  function open(folder?: FolderItem, deleting = false) {
    setName(folder?.name ?? "");
    setDescription(folder?.description ?? "");
    setFormError("");
    setEditor({ folder, deleting });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setFormError("");
    try {
      const { folder, deleting } = editor;
      const response = await fetch(`/api/subjects/${subjectId}/folders${folder ? `/${folder.id}` : ""}`, {
        method: deleting ? "DELETE" : folder ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(folder ? { "If-Match": `"${folder.updatedAt}"` } : {}) },
        body: JSON.stringify(deleting ? { confirm: true } : { name, description }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Couldn't ${deleting ? "delete" : folder ? "update" : "create"} the folder. Please try again.`);

      if (deleting && folder) setFolders(current => current.filter(item => item.id !== folder.id));
      if (!deleting && !folder && data.folder) setFolders(current => [...current, data.folder as FolderItem]);
      if (deleting) toast({ kind: "success", title: "Folder deleted", message: "Its topics are now in Unfiled Topics." });
      else if (folder) toast({ kind: "success", title: "Folder updated", message: "Your folder changes have been saved." });
      else toast({ kind: "success", title: "Folder created", message: "Folder created! You can now add topics or move existing topics into it." });
      setEditor(null);
      void load(true);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Couldn't save the folder. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  const visible = folders.filter(folder => `${folder.name} ${folder.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pendingLabel = editor?.deleting ? "Deleting Folder…" : editor?.folder ? "Saving Changes…" : "Creating Folder…";
  const hasLoadedCurrentScope = isCollectionScopeLoaded(loadedScope, subjectId);
  const hasErrorForCurrentScope = loadErrorScope === subjectId;

  return <section className="min-w-0 space-y-5" aria-labelledby="topics-heading">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 id="topics-heading" className="text-lg font-bold text-[#153B56]">Folders &amp; Topics</h2><p className="mt-1 text-sm text-[#71869A]">Organize your topics into folders to keep your study materials easy to find.</p></div>
      <button type="button" onClick={() => open()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FF6F96] px-4 text-sm font-semibold text-white"><FolderPlus className="h-4 w-4"/>New Folder</button>
    </div>
    <label className="relative block"><span className="sr-only">Search folders</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B9BAA]"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search folders..." className="min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white pl-10 pr-3 text-sm"/></label>
    {hasErrorForCurrentScope && hasLoadedCurrentScope && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FFF1F1] p-3 text-sm text-[#A43E5C]"><span>{loadError}</span><button type="button" onClick={() => void load(true)} disabled={loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 font-semibold text-[#A43E5C] underline disabled:opacity-60"><LoaderCircle aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : "hidden"}`}/>Try again</button></div>}

    {!hasLoadedCurrentScope && !hasErrorForCurrentScope ? <SkeletonRegion label="Loading topic folders" className="rounded-2xl border border-[#F0E5E9] bg-white p-4"><UnknownCollectionPlaceholder className="space-y-4" /></SkeletonRegion>
      : !hasLoadedCurrentScope && hasErrorForCurrentScope ? <div role="alert" className="rounded-2xl border border-dashed border-[#E8D7DE] bg-[#FFFCFD] px-5 py-10 text-center"><h3 className="font-bold text-[#153B56]">Topic folders could not be loaded</h3><p className="mt-2 text-sm text-[#756B72]">{loadError}</p><button type="button" onClick={() => void load()} disabled={loading} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#FF6F96] px-4 font-semibold text-white disabled:opacity-60">{loading && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none"/>}{loading ? "Trying again…" : "Try again"}</button></div>
      : query.trim() && visible.length === 0 ? <div className="rounded-2xl border border-dashed border-[#E8D7DE] bg-[#FFFCFD] px-5 py-10 text-center"><span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF0F5] text-[#E9577D]"><Search className="h-7 w-7"/></span><h3 className="mt-4 font-bold text-[#153B56]">No matching folders found</h3><p className="mt-2 text-sm text-[#756B72]">Try another search term or clear your search.</p><button type="button" onClick={() => setQuery("")} className="mt-3 min-h-10 font-semibold text-[#C65380] underline">Clear search</button></div>
      : visible.length || unfiled.topicCount ? <StaggerContainer className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.04}>
        {visible.map((folder, index) => <StaggerItem key={folder.id} index={index}><article className="relative flex min-w-0 flex-col rounded-2xl border border-[#F0E5E9] bg-white p-4 transition hover:border-[#F3C4D3] hover:shadow-[0_8px_28px_rgba(92,49,66,.07)]"><details className="absolute right-2 top-2"><summary aria-label={`Options for ${folder.name}`} className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-[#C65380]"><Ellipsis className="h-5 w-5"/></summary><div className="absolute right-0 z-10 w-40 rounded-xl border bg-white p-1 shadow-lg"><button type="button" onClick={() => open(folder)} className="min-h-11 w-full rounded px-2 text-left text-sm hover:bg-[#FFF0F5]">Edit / Rename</button><button type="button" onClick={() => open(folder, true)} className="min-h-11 w-full rounded px-2 text-left text-sm text-[#A43E5C] hover:bg-[#FFF1F1]">Delete Folder</button></div></details><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF0F5] text-[#E9577D]"><FolderOpen className="h-5 w-5"/></span><h3 className="mt-3 break-words font-bold text-[#153B56]">{folder.name}</h3>{folder.description && <p className="mt-1 line-clamp-2 break-words text-sm text-[#756B72]">{folder.description}</p>}<p className="mt-2 text-sm text-[#71869A]">{folder.topicCount} {folder.topicCount === 1 ? "topic" : "topics"} · {folder.flashcardCount} {folder.flashcardCount === 1 ? "flashcard" : "flashcards"}</p><Link href={`/subjects/${subjectId}/folders/${folder.id}`} className="mt-3 inline-flex min-h-10 items-center font-semibold text-[#C65380]">Open Folder <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4"/></Link></article></StaggerItem>)}
        {!query.trim() && unfiled.topicCount > 0 && <StaggerItem index={visible.length}><article className="flex min-w-0 flex-col rounded-2xl border border-[#F0E5E9] bg-white p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF0F5] text-[#E9577D]"><FolderOpen className="h-5 w-5"/></span><h3 className="mt-3 break-words font-bold text-[#153B56]">Unfiled Topics</h3><p className="mt-2 text-sm text-[#71869A]">{unfiled.topicCount} {unfiled.topicCount === 1 ? "topic" : "topics"} · {unfiled.flashcardCount} {unfiled.flashcardCount === 1 ? "flashcard" : "flashcards"}</p><Link href={`/subjects/${subjectId}/folders/unfiled`} className="mt-3 inline-flex min-h-10 items-center font-semibold text-[#C65380]">View Topics <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4"/></Link></article></StaggerItem>}
      </StaggerContainer> : <ScrollReveal><div className="rounded-2xl border border-dashed border-[#E8D7DE] bg-[#FFFCFD] px-5 py-10 text-center"><span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF0F5] text-[#E9577D]"><FolderOpen className="h-7 w-7"/></span><h3 className="mt-4 font-bold text-[#153B56]">Keep your topics organized</h3><p className="mt-2 text-sm text-[#756B72]">Create a folder to group related topics and find lessons more easily.</p></div></ScrollReveal>}

    <Modal open={Boolean(editor)} onClose={() => !busy && setEditor(null)} action={editor?.deleting ? "delete" : editor?.folder ? "update" : "create"} alert={editor?.deleting} title={editor?.deleting ? "Delete Topic Folder?" : editor?.folder ? "Edit Topic Folder" : "Create a Topic Folder"} description={editor?.deleting ? editor.folder?.topicCount ? `Deleting ${editor.folder.name} moves its topics to Unfiled Topics. Their flashcards and study progress remain with the topics.` : `Delete the empty folder ${editor.folder?.name}? Your subject and other folders will stay.` : editor?.folder ? "Update this folder’s name or description to keep related topics organized." : "Group related topics into one folder to keep your lessons and flashcards organized."} busy={busy} footer={<><button type="button" disabled={busy} onClick={() => setEditor(null)} className={modalCancelClass}>Cancel</button><button type="submit" form="folder-overview-form" disabled={busy} className={`${editor?.deleting ? modalDangerClass : modalPrimaryClass} inline-flex min-w-0 items-center justify-center whitespace-nowrap`}>
      <ModalButtonContent loading={busy} label={editor?.deleting ? "Delete Folder" : editor?.folder ? "Save Changes" : "Create Folder"} loadingLabel={pendingLabel} />
    </button></>}>
      <form id="folder-overview-form" onSubmit={submit} className="space-y-4">{editor?.deleting ? <p className="break-words font-semibold">{editor.folder?.name}</p> : <><label htmlFor="topic-folder-name" className="block text-sm font-semibold">Folder Name (Required)<input id="topic-folder-name" required maxLength={100} value={name} onChange={event => { setName(event.target.value); setFormError(""); }} placeholder="e.g. Prelims, Midterms, Finals" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E8E2E5] px-3"/></label><label htmlFor="topic-folder-description" className="block text-sm font-semibold">Description (Optional)<textarea id="topic-folder-description" maxLength={500} rows={3} value={description} onChange={event => { setDescription(event.target.value); setFormError(""); }} placeholder="What topics will you organize in this folder?" className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] p-3"/></label></>}{formError && <p role="alert" className="text-sm text-[#A43E5C]">{formError}</p>}</form>
    </Modal>
  </section>;
}
