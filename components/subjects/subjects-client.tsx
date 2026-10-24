"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TypeProgress } from "@/lib/quiz/types";
import { useRouter } from "next/navigation";
import { Modal, modalCancelClass, modalPrimaryClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { BookOpen, Plus, Search, ArrowUpRight } from "lucide-react";
import { ListChecks, PenLine, CheckCircle2, Shuffle } from "lucide-react";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";

export type SubjectItem = {
  id: string;
  name: string;
  flashcardCount: number;
  topicCount: number;
  progress: number;
  masteredCount: number;
  completedRequirements?: number;
  totalRequirements?: number;
  usableCount?: number;
  typeMastery: TypeProgress;
};

type SubjectLayout = "grid" | "list";

type SubjectsClientProps = {
  initialSubjects: SubjectItem[];
  initialLayout: SubjectLayout;
};

function AddSubjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (subject: SubjectItem) => void }) {
 const [name,setName]=useState(""); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const router=useRouter();
 async function handleSubmit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const trimmedName=name.trim(); if(!trimmedName){setError("Please enter a subject name.");return;} setSaving(true);setError(""); try { const response=await fetch("/api/subjects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:trimmedName})}); const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data?.error||data?.message||"Could not create subject."); const raw=data?.subject??data?.data?.subject??data; const subjectId=String(raw?.id??raw?._id??""); if(!subjectId)throw new Error("The subject was created, but its details could not be loaded. Please refresh."); onCreated({id:subjectId,name:String(raw?.name??trimmedName),flashcardCount:Number(raw?.flashcardCount??0),topicCount:0,progress:Number(raw?.progress??0),masteredCount:Number(raw?.masteredCount??0),typeMastery:raw?.typeMastery??{"multiple-choice":{done:0,total:0},identification:{done:0,total:0},"true-false":{done:0,total:0},random:{done:0,total:0}}}); router.refresh();onClose(); } catch(cause){setError(cause instanceof Error?cause.message:"Something went wrong. Please try again.");}finally{setSaving(false);} }
 return <Modal open onClose={onClose} action="create" title="Create a subject" description="Give your study materials a place to belong." busy={saving} footer={<><button type="button" onClick={onClose} disabled={saving} className={modalCancelClass}>Cancel</button><button type="submit" form="create-subject-form" disabled={saving} className={modalPrimaryClass}>{saving?"Creating?":"Create Subject"}</button></>}><form id="create-subject-form" onSubmit={handleSubmit} className="space-y-3"><label htmlFor="subject-name" className="block text-[13px] font-semibold text-[#2F2930]">Subject Name <span className="text-[#F04469]">*</span></label><input id="subject-name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Biology" className="min-h-12 w-full rounded-xl border border-[#E8E2E5] bg-white px-4 text-sm text-[#2F2930] outline-none placeholder:text-[#A49AA0] focus:border-[#FF6F96] focus:ring-4 focus:ring-[#FF6F96]/15"/>{error&&<p role="alert" className="text-sm text-[#C65363]">{error}</p>}</form></Modal>;
}

const masteryIndicators = [
  { key: "multiple-choice", label: "Multiple Choice" },
  { key: "identification", label: "Identification" },
  { key: "true-false", label: "True or False" },
  { key: "random", label: "Mixed / Random" },
] as const;

function QuestionTypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: (typeof masteryIndicators)[number]["key"];
  className?: string;
}) {
  const Icon = type === "multiple-choice" ? ListChecks : type === "identification" ? PenLine : type === "true-false" ? CheckCircle2 : Shuffle;
  return <Icon className={className} aria-hidden="true" />;
}

function TypeMasteryIndicators({ mastery }: { mastery: TypeProgress }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Mastery by question type">
      {masteryIndicators.map(({ key, label }) => {
        const progress = mastery?.[key];
        const done = progress?.done ?? 0;
        const total = progress?.total ?? 0;
        const complete = total > 0 && done >= total;

        return (
          <span
            key={key}
            title={`${label}: ${done} of ${total} mastered`}
            aria-label={`${label}: ${done} of ${total} mastered`}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
              complete
                ? "border-[#F7C6D6] bg-[#FFF0F5] text-[#D94675]"
                : "border-[#E7E7EB] bg-[#F3F3F5] text-[#A0A0AA]"
            }`}
          >
            <QuestionTypeIcon type={key} className="h-4 w-4" />
          </span>
        );
      })}
    </div>
  );
}

export function SubjectsClient({ initialSubjects, initialLayout }: SubjectsClientProps) {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectItem[]>(initialSubjects);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [layout] = useState<SubjectLayout>(initialLayout);
  const [notice, setNotice] = useState("");

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return subjects;
    return subjects.filter((subject) => subject.name.toLowerCase().includes(normalizedQuery));
  }, [subjects, query]);

  function handleCreated(subject: SubjectItem) {
    setSubjects((current) => {
      if (current.some((item) => item.id === subject.id)) return current;
      return [...current, subject].sort((a, b) => a.name.localeCompare(b.name));
    });
    setNotice(`“${subject.name}” was created successfully.`);
    toast({ kind: "success", title: "Subject created", message: `${subject.name} is ready for your flashcards.` });
    window.setTimeout(() => setNotice(""), 3500);
  }

  return (
    <>
      <section aria-label="Manage subjects" className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#2F2930]">All subjects</h2>
            <p className="mt-1 text-sm text-[#756B72]">
              {subjects.length} {subjects.length === 1 ? "subject" : "subjects"} to organize your learning.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#FF6F96] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:self-auto"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add subject
          </button>
        </div>

        {notice ? (
          <p role="status" className="rounded-xl border border-[#CDE9D8] bg-[#EAF8F0] px-4 py-3 text-sm font-medium text-[#286747]">
            {notice}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search subjects</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B9097]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subjects..."
              className="min-h-11 w-full rounded-xl border border-[#E8E2E5] bg-white pl-10 pr-4 text-sm text-[#2F2930] outline-none transition placeholder:text-[#A49AA0] focus:border-[#FF6F96] focus:ring-4 focus:ring-[#FF6F96]/10"
            />
          </label>

        </div>

        {filteredSubjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E8D7DE] bg-white px-5 py-12 text-center sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0F5] text-2xl text-[#E9577D]" aria-hidden="true"><BookOpen className="h-7 w-7" /></div>
            <h3 className="mt-4 text-base font-bold text-[#2F2930]">
              {query.trim() ? "No matching subjects" : "Your study space starts here"}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#756B72]">
              {query.trim()
                ? "Try another search term or clear your search."
                : "Create your first subject to keep your flashcards organized."}
            </p>
            {query.trim() ? (
              <button type="button" onClick={() => setQuery("")} className="mt-4 text-sm font-semibold text-[#D94F7B] hover:underline">
                Clear search
              </button>
            ) : (
              <button type="button" onClick={() => setIsModalOpen(true)} className="mt-4 rounded-xl bg-[#FF6F96] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#E9577D]">
                Add your first subject
              </button>
            )}
          </div>
        ) : (
          <div className={layout === "grid" ? "grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" : "flex flex-col gap-3"}>
            {filteredSubjects.map((subject) => (
              <Link
                key={subject.id}
                href={`/subjects/${subject.id}`}
                className={`group block rounded-2xl border border-[#F0E5E9] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#F3C4D3] hover:shadow-[0_8px_28px_rgba(92,49,66,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 ${
                  layout === "grid" ? "p-5 sm:p-6" : "p-4 sm:flex sm:items-center sm:gap-5 sm:p-5"
                }`}
              >
                <div className={`flex min-w-0 items-start gap-3 ${layout === "list" ? "sm:flex-1" : ""}`}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F5] text-lg text-[#D85E86] transition group-hover:bg-[#FFE5EE]" aria-hidden="true"><BookOpen className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 break-words font-bold text-[#2F2930] group-hover:text-[#C65380]">{subject.name}</h3>
                    <p className="mt-1 text-sm text-[#756B72]">
                      {subject.topicCount} {subject.topicCount === 1 ? "topic" : "topics"} <span aria-hidden="true">·</span> {subject.flashcardCount} {subject.flashcardCount === 1 ? "flashcard" : "flashcards"}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 text-[#B5A7AE] transition group-hover:translate-x-0.5 group-hover:text-[#D85E86]" aria-hidden="true" />
                </div>

                <div className={`${layout === "grid" ? "mt-4" : "mt-4 sm:mt-0 sm:w-[42%] sm:max-w-xs"}`}>
                  <MasteryProgressBar label="Mastery" ariaLabel={`${subject.name} mastery progress`} progress={subject.progress} />
                  <TypeMasteryIndicators mastery={subject.typeMastery} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isModalOpen ? (
        <AddSubjectModal onClose={() => setIsModalOpen(false)} onCreated={handleCreated} />
      ) : null}
    </>
  );
}

