"use client";

import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Modal, modalCancelClass, modalPrimaryClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { normalizeText, parseEnumeration } from "@/lib/quiz/normalize";
import { ENUM_MAX_ITEMS, ENUM_MIN_ITEMS, MAX_ENUM_ANSWER_LENGTH, MAX_ENUM_ITEM_LENGTH } from "@/lib/quiz/config";
import { notifyAchievementActivity } from "@/lib/badges/client-sync";

export type EditableFlashcard = { id: string; topicId: string | null; topicName: string | null; flashcardType: "standard" | "items"; question: string; answer: string; hint: string; reviewed: boolean };
export type FlashcardTopicOption = { id: string; name: string };
export function FlashcardEditorModal({ subjectId, subjectName, topicId, topicOptions, onCreateTopic, initial, onClose, onSaved }: { subjectId: string; subjectName: string; topicId?: string; topicOptions: FlashcardTopicOption[]; onCreateTopic?: () => void; initial?: EditableFlashcard; onClose: () => void; onSaved: (card: EditableFlashcard, resetMastery: boolean) => void }) {
  const { toast } = useToast();
  const [type, setType] = useState<"standard" | "items">(initial?.flashcardType ?? "standard");
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [items, setItems] = useState(() => initial?.flashcardType === "items" ? parseEnumeration(initial.answer) : ["", ""]);
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [selectedTopicId, setSelectedTopicId] = useState(initial?.topicId ?? topicId ?? "");
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
    if (!selectedTopicId || !topicOptions.some((topic) => topic.id === selectedTopicId)) { showError("Choose a topic for this flashcard.", "topic"); return; }
    if (!question.trim()) { showError("Add a question before creating your flashcard.", "question"); return; }
    if (!finalAnswer) { showError(type === "items" ? "Add the enumeration items before creating your flashcard." : "Add an answer before creating your flashcard.", type === "items" ? "items" : "answer"); return; }
    if (type === "items" && new Set(normalizedItems.filter(Boolean).map(normalizeText)).size !== normalizedItems.filter(Boolean).length) { showError("Each enumeration answer must be unique.", "items"); return; }
    if (type === "items" && (normalizedItems.length < ENUM_MIN_ITEMS || normalizedItems.length > ENUM_MAX_ITEMS || normalizedItems.some((item) => !item) || finalAnswer.length > MAX_ENUM_ANSWER_LENGTH)) { showError(`Use ${ENUM_MIN_ITEMS} to ${ENUM_MAX_ITEMS} unique items (${MAX_ENUM_ANSWER_LENGTH} characters maximum).`, "items"); return; }
    setSaving(true); clearError();
    try {
      const url = `/api/subjects/${subjectId}/flashcards${initial ? `/${initial.id}` : ""}`;
      const response = await fetch(url, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topicId: selectedTopicId, flashcardType: type, question: question.trim(), answer: finalAnswer, hint: hint.trim() }) });
      const result = await response.json();
      if (!response.ok || !result.card) throw new Error(result.error || "Could not save flashcard.");
      if (!initial) notifyAchievementActivity();
      onSaved({ ...result.card, reviewed: Boolean(initial?.reviewed) && !result.masteryReset }, Boolean(result.masteryReset));
      const moved = Boolean(initial && initial.topicId !== selectedTopicId);
      toast({ kind: "success", title: moved ? "Flashcard Moved" : initial ? "Flashcard Updated" : "Flashcard Created", message: moved ? result.masteryReset ? "The flashcard moved. Because its question, answer, or type changed, its review history and mastery were reset." : "The flashcard moved to its new topic. Its review history and mastery were preserved." : initial ? result.masteryReset ? "Flashcard updated. Its review history and mastery were reset to reflect the changed study material." : "Flashcard updated! Your changes have been saved." : "Flashcard created! It’s ready for your next review." });
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Could not save flashcard."; setError(message); toast({ kind: "error", title: "Could not save flashcard", message }); }
    finally { setSaving(false); }
  }

  return <Modal open onClose={() => !saving && onClose()} action={initial ? "update" : "create"} title={initial ? "Edit Flashcard" : "Create a Flashcard"} description={initial ? "Update your flashcard's question, answer, or hint to keep your study material accurate." : "Turn important information into a question and answer you can practice later."} busy={saving} footer={<><button type="button" disabled={saving} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="submit" form="flashcard-editor-form" disabled={saving} className={modalPrimaryClass}>{saving ? <><LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"/>{initial ? "Saving Changes…" : "Creating Flashcard…"}</> : initial ? "Save Changes" : "Create Flashcard"}</button></>}>
    <form id="flashcard-editor-form" onSubmit={submit} className="space-y-3">
      <label className="block text-[13px] font-semibold text-[#2F2930]">Topic (Required)<select ref={topicRef} required value={selectedTopicId} onChange={(event) => { setSelectedTopicId(event.target.value); clearError(); }} disabled={topicOptions.length === 0} aria-invalid={errorField === "topic"} aria-describedby={errorField === "topic" ? "flashcard-editor-error" : "topic-help"} className="mt-1.5 h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3 disabled:bg-[#F4F2F4]">{topicOptions.length === 0 ? <option value="">Create a topic first</option> : <><option value="">Choose a topic…</option>{topicOptions.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</>}</select><span id="topic-help" className="mt-1 block text-xs font-normal text-[#756B72]">Choose where this flashcard belongs.</span></label>
      <label className="block text-[13px] font-semibold text-[#2F2930]">Flashcard Type<select value={type} onChange={(event) => { setType(event.target.value as "standard" | "items"); clearError(); }} className="mt-1.5 h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3"><option value="standard">Standard Flashcard</option><option value="items">Enumeration Flashcard</option></select><span className="mt-1 block text-xs font-normal text-[#756B72]">{type === "items" ? `A question that requires ${ENUM_MIN_ITEMS} to ${ENUM_MAX_ITEMS} answer items, separated by commas, semicolons, or new lines.` : "A question with one answer."}</span></label>
      <label className="block text-[13px] font-semibold text-[#2F2930]">Question (Required)<textarea ref={questionRef} required maxLength={2000} rows={3} value={question} onChange={(event) => { setQuestion(event.target.value); clearError(); }} aria-invalid={errorField === "question"} aria-describedby={errorField === "question" ? "flashcard-editor-error" : "question-help"} placeholder="e.g. What is a linked list?" className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] px-3 py-2.5 font-normal" /><span id="question-help" className="mt-1 block text-xs font-normal text-[#756B72]">Enter the question you want to practice remembering.</span></label>
      {type === "standard" ? <label className="block text-[13px] font-semibold text-[#2F2930]">Answer (Required)<textarea ref={answerRef} required maxLength={5000} rows={3} value={answer} onChange={(event) => { setAnswer(event.target.value); clearError(); }} aria-invalid={errorField === "answer"} aria-describedby={errorField === "answer" ? "flashcard-editor-error" : "answer-help"} className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] px-3 py-2.5 font-normal" /><span id="answer-help" className="mt-1 block text-xs font-normal text-[#756B72]">Enter the correct answer for this question.</span></label> : <fieldset aria-describedby={errorField === "items" ? "flashcard-editor-error" : "enumeration-help"} className="space-y-2"><legend className="text-[13px] font-semibold text-[#2F2930]">Enumeration Items * ({items.filter(Boolean).length}/{ENUM_MAX_ITEMS})</legend><p id="enumeration-help" className="text-xs text-[#756B72]">Enter each answer as a separate item. You need {ENUM_MIN_ITEMS} to {ENUM_MAX_ITEMS} unique items.</p>{items.map((item, index) => <div key={index} className="flex items-center gap-2"><span className="w-5 text-right text-xs">{index + 1}.</span><input ref={index === 0 ? itemsRef : undefined} aria-label={`Enumeration item ${index + 1}`} value={item} maxLength={MAX_ENUM_ITEM_LENGTH} onChange={(event) => { setItems(current => current.map((value, i) => i === index ? event.target.value : value)); clearError(); }} aria-invalid={errorField === "items"} aria-describedby={errorField === "items" ? "flashcard-editor-error" : undefined} className="h-10 min-w-0 flex-1 rounded-xl border border-[#E8E2E5] px-3 text-sm" /><button type="button" aria-label={`Remove item ${index + 1}`} disabled={items.length <= ENUM_MIN_ITEMS} onClick={() => { setItems((current) => current.filter((_, i) => i !== index)); clearError(); }} className="p-2 text-[#B8435D] disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div>)}<button type="button" disabled={items.length >= ENUM_MAX_ITEMS} onClick={() => { setItems((current) => [...current, ""]); clearError(); }} className="inline-flex items-center gap-1 text-sm font-semibold text-[#D94E7B] disabled:opacity-40"><Plus className="h-4 w-4" />Add item</button></fieldset>}
      <label className="block text-[13px] font-semibold text-[#2F2930]">Hint (Optional)<textarea maxLength={1000} rows={2} value={hint} onChange={(event) => setHint(event.target.value)} placeholder="Optional: Add a clue to help you recall the answer." className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] px-3 py-2.5 font-normal" /></label>
      <div className="rounded-xl bg-[#FFF7F9] p-3 text-sm text-[#756B72]">Subject: {subjectName}{selectedTopicId && <span className="block mt-1">Topic: {topicOptions.find((topic) => topic.id === selectedTopicId)?.name ?? "Selected topic"}</span>}</div>{topicOptions.length === 0 && onCreateTopic && <button type="button" onClick={onCreateTopic} className="min-h-10 text-sm font-semibold text-[#C65380] underline">Create a topic</button>}{error && <p id="flashcard-editor-error" role="alert" className="text-sm text-[#B84352]">{error}</p>}
    </form>
  </Modal>;
}
