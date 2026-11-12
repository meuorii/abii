"use client";

import { Check, LoaderCircle, Send } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { supportCategories, type SupportContactErrors } from "@/lib/support/validation";

type ContactValues = { name: string; email: string; category: string; message: string; website: string };
const emptyValues: ContactValues = { name: "", email: "", category: "", message: "", website: "" };

function makeRequestKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export function ContactForm() {
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<SupportContactErrors>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const busyRef = useRef(false);
  const requestKeyRef = useRef<string | null>(null);

  const update = (field: keyof ContactValues, value: string) => {
    setValues(current => ({ ...current, [field]: value }));
    if (field in errors) setErrors(current => ({ ...current, [field]: undefined }));
    setFeedback(null);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrors({});
    setFeedback(null);
    requestKeyRef.current ??= makeRequestKey();

    try {
      const response = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": requestKeyRef.current },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => ({})) as { message?: string; errors?: SupportContactErrors };
      if (!response.ok) {
        if (result.errors) setErrors(result.errors);
        setFeedback({ kind: "error", message: result.message || "We couldn't send your message right now. Please try again." });
        return;
      }
      requestKeyRef.current = null;
      setValues(emptyValues);
      setFeedback({ kind: "success", message: "Thanks for reaching out. Your message has been submitted to Abii support." });
    } catch {
      setFeedback({ kind: "error", message: "We couldn't send your message right now. Please try again." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted/80 focus:border-pink-active focus:ring-2 focus:ring-pink-active/20";
  const labelClass = "block text-sm font-semibold text-foreground";

  return <form onSubmit={submit} noValidate className="grid gap-5" aria-describedby="contact-feedback">
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label className={labelClass} htmlFor="support-name">Your name</label>
        <input id="support-name" name="name" autoComplete="name" required maxLength={80} value={values.name} onChange={event => update("name", event.target.value)} className={`${fieldClass} ${errors.name ? "border-red-500 focus:border-red-600 focus:ring-red-500/20" : ""}`} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "support-name-error" : undefined} />
        {errors.name && <p id="support-name-error" className="mt-1.5 text-sm text-red-700">{errors.name}</p>}
      </div>
      <div>
        <label className={labelClass} htmlFor="support-email">Email address</label>
        <input id="support-email" name="email" type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={event => update("email", event.target.value)} className={`${fieldClass} ${errors.email ? "border-red-500 focus:border-red-600 focus:ring-red-500/20" : ""}`} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "support-email-error" : undefined} />
        {errors.email && <p id="support-email-error" className="mt-1.5 text-sm text-red-700">{errors.email}</p>}
      </div>
    </div>
    <div>
      <label className={labelClass} htmlFor="support-category">What can we help you with?</label>
      <select id="support-category" name="category" required value={values.category} onChange={event => update("category", event.target.value)} className={`${fieldClass} ${errors.category ? "border-red-500 focus:border-red-600 focus:ring-red-500/20" : ""}`} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "support-category-error" : undefined}>
        <option value="" disabled>Select a support topic</option>
        {supportCategories.map(category => <option key={category}>{category}</option>)}
      </select>
      {errors.category && <p id="support-category-error" className="mt-1.5 text-sm text-red-700">{errors.category}</p>}
    </div>
    <div>
      <label className={labelClass} htmlFor="support-message">Your message</label>
      <textarea id="support-message" name="message" required minLength={10} maxLength={4000} rows={6} value={values.message} onChange={event => update("message", event.target.value)} placeholder="Tell us what happened or what you need help with..." className={`${fieldClass} min-h-36 resize-y leading-relaxed ${errors.message ? "border-red-500 focus:border-red-600 focus:ring-red-500/20" : ""}`} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "support-message-error support-message-count" : "support-message-count"} />
      <div className="mt-1.5 flex justify-between gap-4"><p id="support-message-error" className="text-sm text-red-700">{errors.message}</p><p id="support-message-count" className="ml-auto text-xs tabular-nums text-muted">{values.message.length}/4000</p></div>
    </div>
    <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
      <label htmlFor="support-website">Leave this field empty</label>
      <input id="support-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={event => update("website", event.target.value)} />
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-pink-primary px-6 py-3 text-sm font-semibold text-foreground transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-pink-accent active:scale-[.98] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-pink-active disabled:cursor-wait disabled:opacity-70 motion-reduce:transform-none">
        {busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Sending...</> : <>Send message <Send className="size-4" aria-hidden="true" /></>}
      </button>
      <p id="contact-feedback" role="status" aria-live="polite" className={`flex min-h-6 items-center gap-2 text-sm ${feedback?.kind === "error" ? "text-red-700" : "text-muted"}`}>
        {feedback?.kind === "success" && <Check className="size-4 shrink-0 text-green-700" aria-hidden="true" />}
        {feedback?.message}
      </p>
    </div>
  </form>;
}
