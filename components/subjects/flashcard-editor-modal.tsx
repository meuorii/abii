"use client";

import { useRef, useState, type FormEvent } from "react";
import { BookOpen, Check, ListOrdered, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { normalizeText, parseEnumeration } from "@/lib/quiz/normalize";
import { ENUM_MAX_ITEMS, ENUM_MIN_ITEMS, MAX_ENUM_ANSWER_LENGTH, MAX_ENUM_ITEM_LENGTH } from "@/lib/quiz/config";
import { notifyAchievementActivity } from "@/lib/badges/client-sync";
import { notifyStateChanged } from "@/components/notifications/notification-context";

export type EditableFlashcard = { id: string; topicId: string | null; topicName: string | null; flashcardType: "standard" | "items"; question: string; answer: string; hint: string; reviewed: boolean };
export type FlashcardTopicOption = { id: string; name: string };
export function FlashcardEditorModal({ subjectId, subjectName, topicId, topicOptions, onCreateTopic, initial, onClose, onSaved }: { subjectId: string; subjectName: string; topicId?: string; topicOptions: FlashcardTopicOption[]; onCreateTopic?: () => void; initial?: EditableFlashcard; onClose: () => void; onSaved: (card: EditableFlashcard, resetMastery: boolean) => void }) {
  const { toast } = useToast();
  const [type, setType] = useState<"standard" | "items">(initial?.flashcardType ?? "standard");
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [items, setItems] = useState(() => initial?.flashcardType === "items" ? parseEnumeration(initial.answer) : ["", ""]);
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [selectedTopicId, setSelectedTopicId] = useState(topicId ?? initial?.topicId ?? "");
  const submissionTopicId = topicId ?? selectedTopicId;
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"topic" | "question" | "answer" | "items" | "">("");
  const [saving, setSaving] = useState(false);
  const topicRef = useRef<HTMLSelectElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const itemsRef = useRef<HTMLInputElement>(null);

  function showError(message: string, field: typeof errorField) {
    setError(message); setErrorField(field);
    if (field === "topic") topicRef.current?.focus();
    else if (field === "question") questionRef.current?.focus();
    else if (field === "answer") answerRef.current?.focus();
    else if (field === "items") itemsRef.current?.focus();
  }

  function clearError() { setError(""); setErrorField(""); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedItems = items.map((item) => item.trim());
    const finalAnswer = type === "items" ? normalizedItems.join("\n") : answer.trim();
    if (!submissionTopicId || !topicOptions.some((topic) => topic.id === submissionTopicId)) { showError("Choose a topic for this flashcard.", "topic"); return; }
    if (!question.trim()) { showError("Add a question before creating your flashcard.", "question"); return; }
    if (!finalAnswer) { showError(type === "items" ? "Add the enumeration items before creating your flashcard." : "Add an answer before creating your flashcard.", type === "items" ? "items" : "answer"); return; }
    if (type === "items" && new Set(normalizedItems.filter(Boolean).map(normalizeText)).size !== normalizedItems.filter(Boolean).length) { showError("Each enumeration answer must be unique.", "items"); return; }
    if (type === "items" && (normalizedItems.length < ENUM_MIN_ITEMS || normalizedItems.length > ENUM_MAX_ITEMS || normalizedItems.some((item) => !item) || finalAnswer.length > MAX_ENUM_ANSWER_LENGTH)) { showError(`Use ${ENUM_MIN_ITEMS} to ${ENUM_MAX_ITEMS} unique items (${MAX_ENUM_ANSWER_LENGTH} characters maximum).`, "items"); return; }
    setSaving(true); clearError();
    try {
      const url = `/api/subjects/${subjectId}/flashcards${initial ? `/${initial.id}` : ""}`;
      const response = await fetch(url, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicId: submissionTopicId, flashcardType: type, question: question.trim(), answer: finalAnswer, hint: hint.trim() }) });
      const result = await response.json();
      if (!response.ok || !result.card) throw new Error(result.error || "Could not save flashcard.");
      if (!initial) { notifyAchievementActivity(); if (Array.isArray(result?.newlyUnlockedBadges) && result.newlyUnlockedBadges.length) notifyStateChanged(); }
      onSaved({ ...result.card, reviewed: Boolean(initial?.reviewed) && !result.masteryReset }, Boolean(result.masteryReset));
      const moved = Boolean(initial && initial.topicId !== submissionTopicId);
      toast({ kind: "success", title: moved ? "Flashcard Moved" : initial ? "Flashcard Updated" : "Flashcard Created", message: moved ? result.masteryReset ? "The flashcard moved. Because its question, answer, or type changed, its review history and mastery were reset." : "The flashcard moved to its new topic. Its review history and mastery were preserved." : initial ? result.masteryReset ? "Flashcard updated. Its review history and mastery were reset to reflect the changed study material." : "Flashcard updated! Your changes have been saved." : "Flashcard created! It’s ready for your next review." });
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Could not save flashcard."; setError(message); toast({ kind: "error", title: "Could not save flashcard", message }); }
    finally { setSaving(false); }
  }

  const lockedTopic = topicId ? topicOptions.find(topic => topic.id === topicId) : undefined;
  const typeDescription = type === "items" ? `One question, ${ENUM_MIN_ITEMS}–${ENUM_MAX_ITEMS} answers.` : "One question, one answer.";
  const typeLabel = (value: "standard" | "items", title: string, description: string, icon: React.ComponentType<{ className?: string }>) => {
    const Icon = icon;
    const selected = type === value;
    return <label className={`relative flex min-h-[92px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-hover ${selected ? "border-primary bg-secondary-surface" : "border-border bg-surface hover:bg-background"}`}>
      <input type="radio" name="flashcard-type" value={value} checked={selected} onChange={() => { setType(value); clearError(); }} aria-describedby="flashcard-type-help" className="sr-only" />
      <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-surface text-primary" : "bg-secondary-surface text-primary"}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{title}</span><span className="mt-0.5 block text-xs leading-4 text-muted">{description}</span></span>
      {selected && <Check aria-label="Selected" className="h-5 w-5 shrink-0 text-primary" />}
    </label>;
  };

  return <Modal open onClose={() => !saving && onClose()} action={initial ? "update" : "create"} title={initial ? "Edit Flashcard" : "Create a Flashcard"} description={initial ? "Update your flashcard's question, answer, or hint to keep your study material accurate." : "Turn important information into a question and answer you can practice later."} busy={saving} footer={<><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" form="flashcard-editor-form" disabled={saving} aria-busy={saving}>{saving ? initial ? "Saving Changes…" : "Creating Flashcard…" : initial ? "Save Changes" : "Create Flashcard"}</Button></>}>
    <form id="flashcard-editor-form" onSubmit={submit} className="grid grid-cols-4 gap-3">
      {topicId ? <div role="group" aria-label="Flashcard topic context" className="col-span-4 min-w-0 rounded-xl border border-border bg-background p-3.5">
        <div className="flex items-start gap-3"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-surface text-primary"><LockKeyhole className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Topic</p><p className="mt-1 break-words text-sm font-semibold text-foreground">{lockedTopic?.name ?? initial?.topicName ?? "Current topic"}</p><p className="mt-1 break-words text-xs text-muted">{subjectName}</p><p className="mt-1 text-xs text-muted">This flashcard belongs to the current topic.</p></div><LockKeyhole aria-label="Topic is locked" className="mt-1 h-4 w-4 shrink-0 text-muted" /></div>
      </div> : <label className="col-span-4 block min-w-0 text-[13px] font-semibold text-foreground">Topic (Required)
        <select ref={topicRef} required value={selectedTopicId} onChange={event => { setSelectedTopicId(event.target.value); clearError(); }} disabled={topicOptions.length === 0} aria-invalid={errorField === "topic"} aria-describedby={errorField === "topic" ? "flashcard-editor-error" : "topic-help"} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 disabled:bg-surface-hover">{topicOptions.length === 0 ? <option value="">Create a topic first</option> : <><option value="">Choose a topic…</option>{topicOptions.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</>}</select>
        <span id="topic-help" className="mt-1 block text-xs font-normal text-muted">Choose where this flashcard belongs.</span>
      </label>}

      <fieldset className="col-span-4 min-w-0" aria-describedby="flashcard-type-help">
        <legend className="text-[13px] font-semibold text-foreground">Flashcard Type</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-3">{typeLabel("standard", "Standard", "One question, one answer.", BookOpen)}{typeLabel("items", "Enumeration", "One question, multiple answers.", ListOrdered)}</div>
        <p id="flashcard-type-help" className="sr-only">{typeDescription} Use the arrow keys to change the selected type.</p>
      </fieldset>

      <label className="col-span-4 block min-w-0 text-[13px] font-semibold text-foreground">Question (Required)
        <textarea ref={questionRef} required maxLength={2000} rows={3} value={question} onChange={event => { setQuestion(event.target.value); clearError(); }} aria-invalid={errorField === "question"} aria-describedby={errorField === "question" ? "flashcard-editor-error" : "question-help"} placeholder="e.g. What is a linked list?" className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 font-normal" />
        <span id="question-help" className="mt-1 block text-xs font-normal text-muted">Enter the question you want to practice remembering.</span>
      </label>

      {type === "standard" ? <label className="col-span-4 block min-w-0 text-[13px] font-semibold text-foreground">Answer (Required)
        <textarea ref={answerRef} required maxLength={5000} rows={3} value={answer} onChange={event => { setAnswer(event.target.value); clearError(); }} aria-invalid={errorField === "answer"} aria-describedby={errorField === "answer" ? "flashcard-editor-error" : "answer-help"} placeholder="Enter the correct answer…" className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 font-normal" />
        <span id="answer-help" className="mt-1 block text-xs font-normal text-muted">Enter the correct answer for this question.</span>
      </label> : <fieldset aria-describedby={errorField === "items" ? "flashcard-editor-error" : "enumeration-help"} className="col-span-4 min-w-0 space-y-2">
        <legend className="text-[13px] font-semibold text-foreground">Enumeration Items * ({items.filter(Boolean).length}/{ENUM_MAX_ITEMS})</legend><p id="enumeration-help" className="text-xs text-muted">Enter each answer as a separate item. You need {ENUM_MIN_ITEMS} to {ENUM_MAX_ITEMS} unique items.</p>
        {items.map((item, index) => <div key={index} className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="w-5 shrink-0 text-right text-xs">{index + 1}.</span><input ref={index === 0 ? itemsRef : undefined} aria-label={`Enumeration item ${index + 1}`} value={item} maxLength={MAX_ENUM_ITEM_LENGTH} onChange={event => { setItems(current => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value)); clearError(); }} aria-invalid={errorField === "items"} aria-describedby={errorField === "items" ? "flashcard-editor-error" : undefined} className="h-10 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm" /><button type="button" aria-label={`Remove item ${index + 1}`} disabled={items.length <= ENUM_MIN_ITEMS} onClick={() => { setItems(current => current.filter((_, itemIndex) => itemIndex !== index)); clearError(); }} className="shrink-0 rounded-lg p-2 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:opacity-40"><Trash2 aria-hidden="true" className="h-4 w-4" /></button></div>)}
        <button type="button" disabled={items.length >= ENUM_MAX_ITEMS} onClick={() => { setItems(current => [...current, ""]); clearError(); }} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary disabled:opacity-40"><Plus aria-hidden="true" className="h-4 w-4" />Add item</button>
      </fieldset>}

      <label className="col-span-4 block min-w-0 text-[13px] font-semibold text-foreground">Hint (Optional)
        <textarea maxLength={1000} rows={2} value={hint} onChange={event => setHint(event.target.value)} placeholder="Optional: Add a clue to help you recall the answer." className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 font-normal" />
      </label>
      {!topicId && <p className="col-span-4 rounded-xl bg-background p-3 text-sm text-muted">Subject: {subjectName}</p>}
      {topicOptions.length === 0 && onCreateTopic && <button type="button" onClick={onCreateTopic} className="col-span-4 min-h-10 text-sm font-semibold text-primary underline">Create a topic</button>}
      {error && <p id="flashcard-editor-error" role="alert" className="col-span-4 text-sm text-error-text">{error}</p>}
    </form>
  </Modal>;
}
