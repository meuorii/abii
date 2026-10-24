"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, modalCancelClass, modalPrimaryClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { normalizeText, parseEnumeration } from "@/lib/quiz/normalize";
import { ENUM_MAX_ITEMS, ENUM_MIN_ITEMS, MAX_ENUM_ANSWER_LENGTH, MAX_ENUM_ITEM_LENGTH } from "@/lib/quiz/config";

export type EditableFlashcard = { id: string; flashcardType: "standard" | "items"; question: string; answer: string; hint: string; reviewed: boolean };
export function FlashcardEditorModal({ subjectId, subjectName, topicId, initial, onClose, onSaved }: { subjectId: string; subjectName: string; topicId?: string; initial?: EditableFlashcard; onClose: () => void; onSaved: (card: EditableFlashcard, resetMastery: boolean) => void }) {
  const { toast } = useToast();
  const [type, setType] = useState<"standard" | "items">(initial?.flashcardType ?? "standard");
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [items, setItems] = useState(() => initial?.flashcardType === "items" ? parseEnumeration(initial.answer) : ["", ""]);
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedItems = items.map((item) => item.trim());
    const finalAnswer = type === "items" ? normalizedItems.join("\n") : answer.trim();
    if (!question.trim() || !finalAnswer) { setError("Question and answer are required."); return; }
    if (type === "items" && (normalizedItems.length < ENUM_MIN_ITEMS || normalizedItems.length > ENUM_MAX_ITEMS || normalizedItems.some((item) => !item) || new Set(normalizedItems.map(normalizeText)).size !== normalizedItems.length || finalAnswer.length > MAX_ENUM_ANSWER_LENGTH)) { setError(`Use ${ENUM_MIN_ITEMS} to ${ENUM_MAX_ITEMS} unique items (${MAX_ENUM_ANSWER_LENGTH} characters maximum).`); return; }
    setSaving(true); setError("");
    try {
      const url = `/api/subjects/${subjectId}/flashcards${initial ? `/${initial.id}` : ""}`;
      const response = await fetch(url, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flashcardType: type, question: question.trim(), answer: finalAnswer, hint: hint.trim(), ...(!initial && topicId ? { topicId } : {}) }) });
      const result = await response.json();
      if (!response.ok || !result.card) throw new Error(result.error || "Could not save flashcard.");
      onSaved({ ...result.card, reviewed: Boolean(initial?.reviewed) && !result.masteryReset }, Boolean(result.masteryReset));
      toast({ kind: "success", title: initial ? "Flashcard updated" : "Flashcard created", message: initial ? "Your changes have been saved." : "Your new flashcard has been added." });
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Could not save flashcard."; setError(message); toast({ kind: "error", title: "Could not save flashcard", message }); }
    finally { setSaving(false); }
  }

  return <Modal open onClose={onClose} action={initial ? "update" : "create"} title={initial ? "Update this flashcard" : "Create a new flashcard"} description={initial ? "Make changes to the content and keep your flashcard up to date." : "Turn what you’ve learned into a flashcard and make your study sessions more effective!"} busy={saving} footer={<><button type="button" disabled={saving} onClick={onClose} className={modalCancelClass}>Cancel</button><button type="submit" form="flashcard-editor-form" disabled={saving} className={modalPrimaryClass}>{saving ? "Saving…" : initial ? "Save Changes" : "Create Flashcard"}</button></>}>
    <form id="flashcard-editor-form" onSubmit={submit} className="space-y-3">
      <label className="block text-[13px] font-semibold text-[#2F2930]">Flashcard Type<select value={type} onChange={(event) => setType(event.target.value as "standard" | "items")} className="mt-1.5 h-11 w-full rounded-xl border border-[#E8E2E5] bg-white px-3"><option value="standard">Standard</option><option value="items">Enumeration</option></select></label>
      <label className="block text-[13px] font-semibold text-[#2F2930]">Question *<textarea required maxLength={2000} rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] px-3 py-2.5 font-normal" /></label>
      {type === "standard" ? <label className="block text-[13px] font-semibold text-[#2F2930]">Answer *<textarea required maxLength={5000} rows={3} value={answer} onChange={(event) => setAnswer(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] px-3 py-2.5 font-normal" /></label> : <fieldset className="space-y-2"><legend className="text-[13px] font-semibold text-[#2F2930]">Enumeration Items * ({items.filter(Boolean).length}/{ENUM_MAX_ITEMS})</legend>{items.map((item, index) => <div key={index} className="flex items-center gap-2"><span className="w-5 text-right text-xs">{index + 1}.</span><input aria-label={`Enumeration item ${index + 1}`} value={item} maxLength={MAX_ENUM_ITEM_LENGTH} onChange={(event) => setItems((current) => current.map((value, i) => i === index ? event.target.value : value))} className="h-10 min-w-0 flex-1 rounded-xl border border-[#E8E2E5] px-3 text-sm" /><button type="button" aria-label={`Remove item ${index + 1}`} disabled={items.length <= ENUM_MIN_ITEMS} onClick={() => setItems((current) => current.filter((_, i) => i !== index))} className="p-2 text-[#B8435D] disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div>)}<button type="button" disabled={items.length >= ENUM_MAX_ITEMS} onClick={() => setItems((current) => [...current, ""])} className="inline-flex items-center gap-1 text-sm font-semibold text-[#D94E7B] disabled:opacity-40"><Plus className="h-4 w-4" />Add item</button></fieldset>}
      <label className="block text-[13px] font-semibold text-[#2F2930]">Hint (optional)<textarea maxLength={1000} rows={2} value={hint} onChange={(event) => setHint(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E8E2E5] px-3 py-2.5 font-normal" /></label>
      <div className="rounded-xl bg-[#FFF7F9] p-3 text-sm text-[#756B72]">Subject: {subjectName}</div>{error && <p role="alert" className="text-sm text-[#B84352]">{error}</p>}
    </form>
  </Modal>;
}
