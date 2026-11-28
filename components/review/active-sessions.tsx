"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock3, Play, Trash2 } from "lucide-react";
import { Modal, modalCancelClass, modalDangerClass } from "@/components/ui/modal";
import { ModalButtonContent } from "@/components/ui/modal-button-content";
import { useToast } from "@/components/ui/toast-provider";
import { QUIZ_TYPE_LABELS, type QuizMode } from "@/lib/quiz/types";
import type { ActiveQuizSummary } from "@/lib/quiz/types";
import { StaggerContainer, StaggerItem } from "@/components/motion/scroll-reveal";

function relativeDate(value: string) {
  const age = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function ActiveSessions({ sessions }: { sessions: ActiveQuizSummary[] }) {
  const [items, setItems] = useState(sessions);
  const [discarding, setDiscarding] = useState<ActiveQuizSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; kind: "resume" | "discard" } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  async function resume(session: ActiveQuizSummary) {
    setBusy(true); setPendingAction({ id: session.id, kind: "resume" }); setError("");
    try {
      const response = await fetch(`/api/quiz/${session.id}/resume`, { method: "POST" });
      const data = await response.json().catch(() => ({})) as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) {
        const message = data.error ?? "This quiz could not be resumed.";
        setItems((current) => current.filter((item) => item.id !== session.id)); setError(message);
        toast({ kind: "error", title: "Quiz unavailable", message }); router.refresh(); return;
      }
      router.push(`/review/quiz/${data.sessionId}`);
    } catch { setError("Could not connect. Your saved quiz answers are unchanged."); }
    finally { setBusy(false); setPendingAction(null); }
  }
  async function discard() {
    if (!discarding) return;
    setBusy(true); setPendingAction({ id: discarding.id, kind: "discard" });
    try {
      const response = await fetch(`/api/quiz/${discarding.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "This quiz could not be discarded.");
      setItems((current) => current.filter((item) => item.id !== discarding.id)); setDiscarding(null);
      toast({ kind: "success", title: "Quiz discarded", message: "Submitted answers remain in your study history." }); router.refresh();
    } catch (cause) { toast({ kind: "error", title: "Could not discard quiz", message: cause instanceof Error ? cause.message : "Please try again." }); }
    finally { setBusy(false); setPendingAction(null); }
  }
  return <>
    <section aria-labelledby="continue-learning-title">
      <div className="mb-4 flex items-start gap-3"><span className="mt-1 text-primary"><BookOpen className="h-6 w-6" aria-hidden="true" /></span><div><h2 id="continue-learning-title" className="text-lg font-bold text-foreground sm:text-xl">Continue Learning</h2><p className="mt-0.5 text-xs text-muted sm:text-sm">Pick up where you left off.</p></div></div>
      {error && <p role="status" className="mb-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-error-text">{error}</p>}
      {items.length ? <StaggerContainer className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((session, index) => <StaggerItem key={session.id} index={index}><article className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="truncate text-sm font-bold text-foreground">{session.subjectName}</h3><p className="mt-0.5 truncate text-xs text-muted">{session.scope === "all" ? "All Topics" : session.topicName ?? (session.scope === "subject" ? "All Topics" : "Topic")}</p>
        <p className="mt-3 text-xs font-semibold text-primary">{QUIZ_TYPE_LABELS[session.type as QuizMode]} · Round {session.currentRound}</p>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs"><span className="text-muted">{session.readyToFinish ? "Ready to finish" : "Questions answered"}</span><span className="font-bold tabular-nums text-foreground">{session.progress}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Quiz completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={session.progress}><div className="h-full rounded-full bg-primary" style={{ width: `${session.progress}%` }} /></div>
        <div className="mt-2 flex justify-between gap-2 text-[11px] text-muted"><span>{session.answeredCount} of {session.totalQuestions} answered</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true" />{relativeDate(session.lastActivityAt)}</span></div>
        <div className="mt-4 flex items-center justify-between gap-2"><button type="button" disabled={busy} onClick={() => void resume(session)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"><Play className="h-3.5 w-3.5" aria-hidden="true" />{pendingAction?.id === session.id && pendingAction.kind === "resume" ? "Resuming Review…" : "Resume Review"}</button><button type="button" disabled={busy} onClick={() => setDiscarding(session)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-error-text hover:bg-background disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Discard</button></div>
      </article></StaggerItem>)}</StaggerContainer> : <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-7 text-center"><p className="font-semibold text-foreground">You’re all caught up!</p><p className="mt-1 text-sm text-muted">No unfinished quizzes. Start a new review whenever you’re ready.</p><a href="/review/setup" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Start New Quiz</a></div>}
    </section>
    <Modal open={Boolean(discarding)} onClose={() => !busy && setDiscarding(null)} action="delete" title="Discard this unfinished quiz?" description="This will remove the unfinished session." busy={busy} alert footer={<><button type="button" disabled={busy} onClick={() => setDiscarding(null)} className={modalCancelClass}>Keep Session</button><button type="button" disabled={busy} onClick={() => void discard()} className={modalDangerClass}><ModalButtonContent loading={busy} label="Discard Quiz" loadingLabel="Discarding Quiz…" /></button></>}><p className="text-sm leading-6 text-muted">Answers you already submitted will remain in your study history.</p></Modal>
  </>;
}
