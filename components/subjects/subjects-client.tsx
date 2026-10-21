"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TypeProgress } from "@/lib/quiz/types";
import { MasteryPills } from "@/components/review/review-setup";

export type SubjectItem = {
  id: string;
  name: string;
  flashcardCount: number;
  progress: number;
  masteredCount: number;
  typeMastery: TypeProgress;
};

const subjectIconChoices = ["▦", "⚗", "▤", "◈", "✿", "⌘"];

function subjectIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("math")) return "▦";
  if (normalized.includes("sci")) return "⚗";
  if (normalized.includes("english") || normalized.includes("language")) return "▤";
  if (normalized.includes("history")) return "✿";
  if (normalized.includes("filipino")) return "◈";
  return subjectIconChoices[name.length % subjectIconChoices.length];
}

function AddSubjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (subject: SubjectItem) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a subject name to continue.");
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const result = (await response.json()) as { subject?: SubjectItem; error?: string };
      if (!response.ok || !result.subject) {
        setError(result.error || "We couldn’t create that subject. Please try again.");
        return;
      }
      onCreated(result.subject);
    } catch {
      setError("You seem to be offline. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#2F2930]/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="add-subject-title" className="relative my-auto w-full max-w-[460px] overflow-hidden rounded-[24px] border border-[#F0DCE3] bg-white shadow-[0_24px_80px_rgba(47,41,48,0.2)]">
        <div className="relative overflow-hidden border-b border-[#F4E7EC] bg-[#FFF7F9] px-6 pb-5 pt-6 sm:px-7">
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close dialog" className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#756B72] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">×</button>
          <div className="relative z-10 max-w-[70%]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C65380]">GROW YOUR LIBRARY</p>
            <h2 id="add-subject-title" className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-[#2F2930]">Add a subject</h2>
            <p className="mt-2 text-sm leading-5 text-[#756B72]">Give your study cards a home. You can add flashcards next.</p>
          </div>
          <div className="pointer-events-none absolute -bottom-3 right-1 h-[142px] w-[142px] opacity-90">
            <Image src="/dashboard-hero/my-subjects.png" alt="" fill sizes="142px" className="object-contain object-bottom" />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-7">
          <div>
            <label htmlFor="subject-name" className="mb-2 block text-sm font-semibold text-[#2F2930]">Subject name</label>
            <input
              ref={inputRef}
              id="subject-name"
              name="name"
              value={name}
              onChange={(event) => { setName(event.target.value); if (error) setError(""); }}
              maxLength={100}
              autoComplete="off"
              placeholder="e.g. Biology, World History"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "subject-form-error" : "subject-name-hint"}
              className="min-h-12 w-full rounded-xl border border-[#E8DDE2] bg-white px-4 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A79AA1] hover:border-[#D9B9C5] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20"
            />
            {error ? <p id="subject-form-error" role="alert" className="mt-2 text-sm text-[#B83F68]">{error}</p> : <p id="subject-name-hint" className="mt-2 text-xs text-[#8A7D84]">Choose a name that’s easy to recognize.</p>}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-[#E8E2E5] px-5 text-sm font-semibold text-[#756B72] transition-colors hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FF6F96] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{saving ? "Creating…" : "Create subject"}<span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function SubjectsClient({ initialSubjects }: { initialSubjects: SubjectItem[] }) {
  const router = useRouter();
  const [subjects, setSubjects] = useState(initialSubjects);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const filteredSubjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return subjects;
    return subjects.filter((subject) => subject.name.toLocaleLowerCase().includes(normalized));
  }, [subjects, query]);

  function handleCreated(subject: SubjectItem) {
    setSubjects((current) => [...current, subject].sort((a, b) => a.name.localeCompare(b.name)));
    setQuery("");
    setModalOpen(false);
    setNotice(`${subject.name} was added.`);
    router.refresh();
  }

  return (
    <>
      <section aria-labelledby="my-subjects-heading">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#9A7C89]">YOUR LIBRARY</p>
            <h2 id="my-subjects-heading" className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-[#2F2930]">My Subjects <span className="ml-1 align-middle text-sm font-medium tracking-normal text-[#9A8C93]">{subjects.length}</span></h2>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative min-w-0 flex-1 sm:w-[230px]">
              <label htmlFor="subject-search" className="sr-only">Search subjects</label>
              <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-[#8B9BAA]">⌕</span>
              <input id="subject-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects..." className="h-11 w-full rounded-full border border-[#E8E2E5] bg-white pl-10 pr-4 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A79AA1] focus:border-[#E9577D] focus:ring-4 focus:ring-[#FF9FBA]/20" />
            </div>
            <button type="button" onClick={() => { setNotice(""); setModalOpen(true); }} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FF6F96] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"><span aria-hidden="true" className="text-lg leading-none">＋</span> Add Subject</button>
          </div>
        </div>

        {notice && <p role="status" className="mb-4 rounded-xl border border-[#CFE8D8] bg-[#EAF8F0] px-4 py-3 text-sm text-[#35664B]">{notice}</p>}

        {subjects.length === 0 ? (
          <div className="relative overflow-hidden rounded-[22px] border border-dashed border-[#E8C8D3] bg-[#FFFCFD] px-5 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-xl text-center">
              <div className="relative mx-auto h-32 w-32 sm:h-40 sm:w-40">
                <Image src="/dashboard-hero/my-subjects.png" alt="Abii is ready to help you get started" fill sizes="160px" className="object-contain" />
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-[#2F2930]">Your first subject starts here.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#756B72]">Add a subject to begin creating flashcards and building your knowledge.</p>
              <button type="button" onClick={() => setModalOpen(true)} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6F96] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2"><span aria-hidden="true">＋</span> Add Subject</button>
            </div>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E8E2E5] bg-white px-5 py-12 text-center">
            <p className="text-base font-semibold text-[#2F2930]">No subjects match “{query.trim()}”.</p>
            <p className="mt-2 text-sm text-[#756B72]">Try a different name or clear your search.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-[#C65380] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">Clear search</button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredSubjects.map((subject) => (
              <li key={subject.id}>
                <Link href={`/subjects/${subject.id}`} aria-label={`Open ${subject.name}`} className="group flex min-h-[148px] flex-col justify-between rounded-[17px] border border-[#E8E2E5] bg-white p-4 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#E8B0C2] hover:shadow-[0_8px_24px_rgba(47,41,48,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-[22px] text-[#E9577D]">{subjectIcon(subject.name)}</span>
                    <span className="min-w-0 flex-1 pt-1">
                      <span className="flex min-w-0 items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-[15px] font-semibold text-[#2F2930]">{subject.name}</span>
                        {subject.flashcardCount > 0 && subject.masteredCount === subject.flashcardCount && <span title="Mastered" aria-label="Mastered" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F7C6D6] bg-[#FFF0F5] px-2 py-1 text-[10px] font-bold text-[#D94675]">✓ Mastered</span>}
                      </span>
                      <span className="mt-1.5 block text-xs text-[#8192A1]">{subject.flashcardCount} {subject.flashcardCount === 1 ? "flashcard" : "flashcards"}</span>
                    </span>
                    <span aria-hidden="true" className="pt-1 text-lg leading-none text-[#7C91A3] transition-colors group-hover:text-[#E9577D]">›</span>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <div role="progressbar" aria-label={`${subject.name} mastery progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={subject.progress} className="h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#F0F1F4]">
                      <div className="h-full rounded-full bg-[#E9577D] transition-[width]" style={{ width: `${subject.progress}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs font-semibold tabular-nums text-[#657B8E]">{subject.progress}%</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[#8192A1]">{subject.masteredCount}/{subject.flashcardCount} cards mastered</span>

                  </div>
                  <div className="mt-2 flex items-center gap-2" aria-label={`${subject.name} question type completion`}>
                    <MasteryPills progress={subject.typeMastery} className="flex flex-wrap gap-1" />
                  </div>
                  <span className="sr-only">Progress is the percentage of flashcards mastered across every applicable question type and Mixed / Random.</span>
                </Link>
              </li>
            ))}
            {!query.trim() && <li>
              <button type="button" onClick={() => setModalOpen(true)} className="flex min-h-[148px] w-full flex-col items-center justify-center rounded-[17px] border border-dashed border-[#E8B8C8] bg-[#FFFCFD] p-5 text-center transition-colors hover:border-[#E9577D] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">
                <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFE8EF] text-2xl leading-none text-[#E9577D]">＋</span>
                <span className="mt-3 text-sm font-semibold text-[#2F2930]">Add a new subject</span>
                <span className="mt-1 text-xs text-[#8192A1]">Expand your learning journey.</span>
              </button>
            </li>}
          </ul>
        )}
      </section>
      {modalOpen && <AddSubjectModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </>
  );
}


